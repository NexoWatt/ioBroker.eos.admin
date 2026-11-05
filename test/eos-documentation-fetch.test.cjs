'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const transport = import('../src-admin/src/helpers/documentationFetch.ts');
async function server(handler, run) {
    const instance = http.createServer(handler);
    instance.listen(0, '127.0.0.1');
    await once(instance, 'listening');
    const base = `http://127.0.0.1:${instance.address().port}/`;
    try { await run(base); } finally { instance.closeAllConnections(); await new Promise(resolve => instance.close(resolve)); }
}
const failure = code => error => { assert.equal(error.code, code); return true; };
test('documentation accepts bounded UTF-8 and refuses HTTP errors and redirects', async () => {
    const { fetchDocumentation } = await transport;
    let targetHits = 0;
    await server((req, res) => {
        if (req.url === '/missing') { res.writeHead(404); res.end('no'); }
        else if (req.url === '/redirect') { res.writeHead(302, { Location: '/target' }); res.end(); }
        else if (req.url === '/target') { targetHits++; res.end('target'); }
        else { res.end('# Grüße 🌍'); }
    }, async base => {
        assert.equal(await fetchDocumentation('ok', base, new AbortController().signal), '# Grüße 🌍');
        await assert.rejects(fetchDocumentation('missing', base, new AbortController().signal), failure('HTTP_ERROR'));
        await assert.rejects(fetchDocumentation('redirect', base, new AbortController().signal), failure('NETWORK_ERROR'));
        assert.equal(targetHits, 0, 'redirect target must not be requested');
    });
});
test('documentation rejects unsafe origins and already-cancelled work before I/O', async () => {
    const { fetchDocumentation } = await transport;
    for (const url of ['http://remote.example/doc', 'javascript:alert(1)', 'data:text/plain,text', 'https://user:password@example.com/doc']) {
        await assert.rejects(fetchDocumentation(url, 'https://admin.example/', new AbortController().signal), failure('UNSAFE_URL'));
    }
    const controller = new AbortController(); controller.abort();
    await assert.rejects(fetchDocumentation('/doc', 'https://admin.example/', controller.signal), failure('ABORTED'));
});
test('documentation bounds declared and streamed response sizes', async () => {
    const { fetchDocumentation, DOCUMENTATION_MAX_BYTES } = await transport;
    assert.equal(DOCUMENTATION_MAX_BYTES, 2 * 1024 * 1024);
    await server((req, res) => {
        if (req.url === '/declared') { res.writeHead(200, { 'Content-Length': DOCUMENTATION_MAX_BYTES + 1 }); res.flushHeaders(); }
        else { res.writeHead(200, { 'Transfer-Encoding': 'chunked' }); res.end(Buffer.alloc(DOCUMENTATION_MAX_BYTES + 1, 65)); }
    }, async base => {
        await assert.rejects(fetchDocumentation('declared', base, new AbortController().signal), failure('TOO_LARGE'));
        await assert.rejects(fetchDocumentation('streamed', base, new AbortController().signal), failure('TOO_LARGE'));
    });
});
test('documentation aborts a live streaming body at one total five-second deadline', { timeout: 8000 }, async () => {
    const { fetchDocumentation, DOCUMENTATION_TIMEOUT_MS } = await transport;
    assert.equal(DOCUMENTATION_TIMEOUT_MS, 5000);
    let closed = false;
    await server((req, res) => {
        res.writeHead(200, { 'Transfer-Encoding': 'chunked' }); res.flushHeaders();
        const timer = setInterval(() => res.write('data\n'), 40);
        res.on('close', () => { clearInterval(timer); closed = true; });
    }, async base => {
        const start = performance.now();
        await assert.rejects(fetchDocumentation('slow', base, new AbortController().signal), failure('TIMEOUT'));
        const elapsed = performance.now() - start;
        assert.ok(elapsed >= 4800 && elapsed < 6500, `deadline observed at ${elapsed}ms`);
        await delay(50); assert.equal(closed, true, 'transport must close, not just abandon a promise');
    });
});
test('caller cancellation aborts body reading without waiting for deadline', { timeout: 2000 }, async () => {
    const { fetchDocumentation } = await transport;
    let closed = false;
    await server((req, res) => { res.writeHead(200); res.write('start'); res.on('close', () => { closed = true; }); }, async base => {
        const controller = new AbortController();
        const pending = fetchDocumentation('cancel', base, controller.signal);
        setTimeout(() => controller.abort(), 40);
        await assert.rejects(pending, failure('ABORTED'));
        await delay(40); assert.equal(closed, true);
    });
});
