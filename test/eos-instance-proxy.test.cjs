'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { stripTypeScriptTypes, createRequire } = require('node:module');
const express = require('express');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/instanceProxy.ts'), 'utf8');
const loaded = import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64'));
const access = crypto.randomBytes(24).toString('base64url');

function request(port, pathname, options = {}) {
    return new Promise((resolve, reject) => {
        const req = (options.ca ? https : http).request({ host: '127.0.0.1', port, path: pathname, method: options.method || 'GET', headers: options.headers || {}, ca: options.ca, rejectUnauthorized: true }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(new Error('test request deadline')));
        req.end(options.body);
    });
}
async function listen(server, host = '127.0.0.1') {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, host, resolve); });
    return server.address().port;
}
async function fixture(t, handler = (req, res) => res.end('ok'), options = {}) {
    const { InstanceProxy } = await loaded;
    const target = options.tls ? https.createServer(options.tls, handler) : http.createServer(handler);
    const targetPort = await listen(target);
    const objects = {
        'system.user.operator': { type: 'user', common: { enabled: true }, native: {} },
        'system.user.admin': { type: 'user', common: { enabled: true }, native: {} },
        'system.group.administrator': { type: 'group', common: { members: ['system.user.operator'] } },
        'system.adapter.nexowatt-ui.0': { type: 'instance', common: { host: 'testhost', enabled: true, adminTab: { proxy: true } }, native: { bind: '127.0.0.1', port: targetPort, secure: Boolean(options.tls) } },
    };
    const sessions = new Map([[`a:${access}`, { user: 'operator', aExp: Date.now() + 60000 }]]);
    const adapter = { host: 'testhost', namespace: 'eos-admin.0', config: { auth: true, secure: Boolean(options.frontTls) }, log: { debug() {} },
        getSession: (id, callback) => callback(sessions.get(id)), getForeignObjectAsync: async id => objects[id] };
    const proxy = new InstanceProxy(adapter, options.prefix || '/admin/');
    const app = express();
    app.use(proxy.hideAuthorization);
    app.use((req, res, next) => proxy.matches(req.url) ? next() : express.json()(req, res, next));
    app.use(proxy.handleRequest);
    app.use((_req, res) => res.status(404).send('other'));
    const server = options.frontTls ? https.createServer(options.frontTls, app) : http.createServer(app);
    proxy.attach(server);
    const port = await listen(server);
    t.after(async () => {
        proxy.close(); server.closeAllConnections(); target.closeAllConnections();
        await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => target.close(resolve))]);
    });
    return { proxy, adapter, objects, sessions, server, target, port, targetPort,
        headers: { cookie: `access_token=${access}`, origin: `${options.frontTls ? 'https' : 'http'}://127.0.0.1:${port}` } };
}

test('Admin8 proxy forwards selected instance request body and target authorization, never Admin credentials or caller forwarding headers', async t => {
    let observed;
    const f = await fixture(t, (req, res) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            observed = { url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() };
            res.setHeader('set-cookie', ['nw_session=example; HttpOnly; SameSite=Lax; Domain=untrusted.example; Path=/', 'access_token=other; Path=/']);
            res.setHeader('service-worker-allowed', '/');
            res.end('accepted');
        });
    });
    const response = await request(f.port, '/admin/proxy/nexowatt-ui.0/api/login?instance=0', { method: 'POST',
        headers: { ...f.headers, authorization: 'Bearer target-example', cookie: `${f.headers.cookie}; refresh_token=refresh-example; nw_session=example`, 'content-type': 'application/json', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'attacker.invalid', 'x-forwarded-prefix': '/escape/', forwarded: 'host=attacker.invalid' },
        body: JSON.stringify({ user: 'operator', password: 'synthetic-only' }) });
    assert.equal(response.status, 200);
    assert.equal(observed.url, '/api/login?instance=0');
    assert.deepEqual(JSON.parse(observed.body), { user: 'operator', password: 'synthetic-only' });
    assert.equal(observed.headers.authorization, 'Bearer target-example');
    assert.equal(observed.headers.cookie, 'nw_session=example');
    assert.equal(observed.headers['x-forwarded-prefix'], '/admin/proxy/nexowatt-ui.0');
    assert.equal(observed.headers['x-forwarded-proto'], 'http');
    assert.equal(observed.headers.forwarded, undefined);
    assert.equal(response.headers['service-worker-allowed'], undefined);
    assert.deepEqual(response.headers['set-cookie'], ['nw_session=example; HttpOnly; SameSite=Lax; Path=/admin/proxy/nexowatt-ui.0/']);
});

test('missing/expired/resource-scoped sessions and disabled/forced-reset users fail closed; names grant no administrator membership', async t => {
    let hits = 0;
    const f = await fixture(t, (_req, res) => { hits++; res.end('ok'); });
    const route = '/admin/proxy/nexowatt-ui.0/';
    assert.equal((await request(f.port, route)).status, 401);
    f.sessions.set(`a:${access}`, { user: 'admin', aExp: Date.now() + 60000 });
    assert.equal((await request(f.port, route, { headers: f.headers })).status, 403);
    for (const session of [{ user: 'operator', aExp: 0 }, { user: 'operator', aExp: Date.now() + 60000, aud: 'mcp' }, { user: 'operator', aExp: Date.now() + 60000, clientId: 'external' }]) {
        f.sessions.set(`a:${access}`, session);
        assert.equal((await request(f.port, route, { headers: f.headers })).status, 401);
    }
    f.sessions.set(`a:${access}`, { user: 'operator', aExp: Date.now() + 60000 });
    f.objects['system.user.operator'].common.enabled = false;
    assert.equal((await request(f.port, route, { headers: f.headers })).status, 401);
    f.objects['system.user.operator'].common.enabled = true;
    for (const flag of ['nexowattPasswordChangeRequired', 'eosPasswordChangeRequired', 'nexowattFirstLoginPending', 'eosFirstLoginRequired']) {
        f.objects['system.user.operator'].native = { [flag]: true };
        assert.equal((await request(f.port, route, { headers: f.headers })).status, 401);
    }
    assert.equal(hits, 0);
});

test('each request rechecks actual administrator membership and instance opt-in without a stale decision cache', async t => {
    const f = await fixture(t);
    const route = '/admin/proxy/nexowatt-ui.0/';
    assert.equal((await request(f.port, route, { headers: f.headers })).status, 200);
    f.objects['system.group.administrator'].common.members = [];
    assert.equal((await request(f.port, route, { headers: f.headers })).status, 403);
    f.objects['system.group.administrator'].common.members = ['system.user.operator'];
    f.objects['system.adapter.nexowatt-ui.0'].common.adminTab.proxy = false;
    assert.equal((await request(f.port, route, { headers: f.headers })).status, 404);
    f.objects['system.adapter.nexowatt-ui.0'].common.adminTab.proxy = true;
    f.objects['system.adapter.nexowatt-ui.0'].native.port = `${f.targetPort}bad`;
    assert.equal((await request(f.port, route, { headers: f.headers })).status, 404);
});

test('encoded separators, traversal, credentials in query and cross-origin mutations never reach a target', async t => {
    let hits = 0;
    const f = await fixture(t, (_req, res) => { hits++; res.end('ok'); });
    for (const tail of ['/%2e%2e/private', '/..%2fprivate', '/%252e%252e/private', '//evil', '/%5cprivate', '/?access_token=example']) {
        assert.equal((await request(f.port, `/admin/proxy/nexowatt-ui.0${tail}`, { headers: f.headers })).status, 400);
    }
    assert.equal((await request(f.port, '/admin/proxy/nexowatt-ui.0/api', { method: 'POST', headers: { cookie: f.headers.cookie, origin: 'https://evil.invalid' } })).status, 403);
    assert.equal((await request(f.port, '/admin/proxy/nexowatt-ui.0/api', { method: 'POST', headers: { cookie: f.headers.cookie } })).status, 403);
    assert.equal(hits, 0);
});

test('local redirects and cookies without Path remain inside the selected instance', async t => {
    const f = await fixture(t, (_req, res) => { res.writeHead(302, { location: '/login', 'set-cookie': 'nw_session=example; HttpOnly' }); res.end(); });
    const result = await request(f.port, '/admin/proxy/nexowatt-ui.0/start', { headers: f.headers });
    assert.equal(result.headers.location, '/admin/proxy/nexowatt-ui.0/login');
    assert.equal(result.headers['set-cookie'][0], 'nw_session=example; HttpOnly; SameSite=Lax; Path=/admin/proxy/nexowatt-ui.0/');
    const slash = await request(f.port, '/admin/proxy/nexowatt-ui.0?x=1', { headers: f.headers });
    assert.equal(slash.status, 301);
    assert.equal(slash.headers.location, '/admin/proxy/nexowatt-ui.0/?x=1');
});

// Test-only fixture uses the controller's already locked dependency. No installed
// OpenSSL binary, stored key, controller startup or runtime proxy dependency.
function certificate(altNames = [{ type: 7, ip: '127.0.0.1' }, { type: 2, value: 'localhost' }]) {
    const controllerRequire = createRequire(require.resolve('@iobroker/js-controller-common-db'));
    const forge = controllerRequire('node-forge');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = pair.privateKey.export({ format: 'pem', type: 'pkcs1' });
    const cert = forge.pki.createCertificate();
    cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: 'pem', type: 'spki' }));
    cert.serialNumber = `01${crypto.randomBytes(15).toString('hex')}`;
    cert.validity.notBefore = new Date(Date.now() - 60000);
    cert.validity.notAfter = new Date(Date.now() + 3600000);
    const subject = [{ name: 'commonName', value: 'localhost' }];
    cert.setSubject(subject); cert.setIssuer(subject);
    cert.setExtensions([{ name: 'basicConstraints', cA: true }, { name: 'subjectAltName', altNames }]);
    cert.sign(forge.pki.privateKeyFromPem(key), forge.md.sha256.create());
    return { key, cert: forge.pki.certificateToPem(cert) };
}

test('HTTPS target rejects an untrusted certificate and accepts an explicitly trusted certificate without disabling verification', async t => {
    const cert = certificate();
    let hits = 0;
    const f = await fixture(t, (_req, res) => { hits++; res.end('tls-ok'); }, { tls: cert });
    const route = '/admin/proxy/nexowatt-ui.0/';
    assert.equal((await request(f.port, route, { headers: f.headers })).status, 502);
    assert.equal(hits, 0);
    assert.equal(typeof tls.setDefaultCACertificates, 'function');
    const original = tls.getCACertificates('default');
    try {
        tls.setDefaultCACertificates([...original, cert.cert.toString()]);
        assert.equal((await request(f.port, route, { headers: f.headers })).body, 'tls-ok');
        assert.equal(hits, 1);
    } finally { tls.setDefaultCACertificates(original); }
});

test('SSE stays streamed and is closed immediately when proxy sessions are invalidated', async t => {
    const f = await fixture(t, (_req, res) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: ready\n\n'); });
    const req = http.get({ host: '127.0.0.1', port: f.port, path: '/admin/proxy/nexowatt-ui.0/events', headers: f.headers });
    const incoming = await new Promise((resolve, reject) => { req.on('response', resolve); req.on('error', reject); });
    const data = await new Promise(resolve => incoming.once('data', resolve));
    assert.match(data.toString(), /ready/);
    const closed = new Promise(resolve => { incoming.once('aborted', resolve); incoming.once('close', resolve); });
    f.proxy.invalidate();
    await closed;
});

test('WebSocket upgrades use the proxy before unrelated Admin websocket listeners and revoke active tunnels', { timeout: 10000 }, async t => {
    const f = await fixture(t);
    let otherUpgrade = 0;
    f.server.on('upgrade', () => { otherUpgrade++; });
    f.target.on('upgrade', (_req, socket) => {
        socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
        socket.on('data', bytes => socket.write(bytes));
        socket.on('end', () => socket.end());
    });
    const socket = net.createConnection(f.port, '127.0.0.1');
    t.after(() => socket.destroy());
    await new Promise(resolve => socket.once('connect', resolve));
    socket.write(`GET /admin/proxy/nexowatt-ui.0/socket HTTP/1.1\r\nHost: 127.0.0.1:${f.port}\r\nOrigin: http://127.0.0.1:${f.port}\r\nCookie: ${f.headers.cookie}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`);
    const first = await new Promise(resolve => socket.once('data', resolve));
    assert.match(first.toString(), /101 Switching Protocols/);
    assert.equal(otherUpgrade, 0);
    socket.write('harmless-fixture-bytes');
    const echo = await new Promise(resolve => socket.once('data', resolve));
    assert.equal(echo.toString(), 'harmless-fixture-bytes');
    const closed = new Promise(resolve => socket.once('close', resolve));
    f.proxy.invalidate();
    await closed;
});

test('HTTPS Admin entry forwards to a local HTTP adapter and marks the scoped application cookie Secure', async t => {
    const cert = certificate();
    let observed;
    const f = await fixture(t, (req, res) => { observed = req.headers; res.setHeader('set-cookie', 'nw_session=example; HttpOnly'); res.end('http-local'); }, { frontTls: cert });
    const result = await request(f.port, '/admin/proxy/nexowatt-ui.0/api', { ca: cert.cert, headers: f.headers });
    assert.equal(result.body, 'http-local');
    assert.equal(observed['x-forwarded-proto'], 'https');
    assert.match(result.headers['set-cookie'][0], /; Secure;/);
});

test('trusted HTTPS certificate with a mismatched hostname is rejected', async t => {
    const cert = certificate([{ type: 2, value: 'elsewhere.invalid' }]);
    let hits = 0;
    const f = await fixture(t, (_req, res) => { hits++; res.end('bad'); }, { tls: cert });
    const original = tls.getCACertificates('default');
    try {
        tls.setDefaultCACertificates([...original, cert.cert]);
        assert.equal((await request(f.port, '/admin/proxy/nexowatt-ui.0/', { headers: f.headers })).status, 502);
        assert.equal(hits, 0);
    } finally { tls.setDefaultCACertificates(original); }
});

test('a stalled authorization database times out without forwarding and a subsequent request recovers', async t => {
    let hits = 0;
    const f = await fixture(t, (_req, res) => { hits++; res.end('ok'); });
    const original = f.adapter.getSession;
    let delayed;
    f.adapter.getSession = (_id, callback) => { delayed = callback; };
    const started = Date.now();
    assert.equal((await request(f.port, '/admin/proxy/nexowatt-ui.0/', { headers: f.headers })).status, 503);
    assert.ok(Date.now() - started >= 1900 && Date.now() - started < 4000);
    assert.equal(hits, 0);
    delayed(null);
    f.adapter.getSession = original;
    assert.equal((await request(f.port, '/admin/proxy/nexowatt-ui.0/', { headers: f.headers })).status, 200);
});
