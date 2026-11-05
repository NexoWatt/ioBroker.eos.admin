'use strict';
// Real Admin8/WebServer3.4/OAuth dependencies and emitted backend; controller
// persistence is an in-memory boundary. This is not a live ioBroker installation.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { gzipSync } = require('node:zlib');
const express = require('express');
const { createOAuth2Server } = require('../build/lib/vendor/webserver');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const webFile = path.resolve(__dirname, '../build/lib/web.js');
const webRequire = createRequire(webFile);
const webExports = {};
vm.runInNewContext(fs.readFileSync(webFile, 'utf8'), {
    exports: webExports, module: { exports: webExports }, __dirname: path.dirname(webFile),
    Buffer, URL, console, process,
    // Adapter-core resolves a real js-controller at import time; only that controller
    // bootstrap is replaced. All Web helpers and OAuth packages below are installed code.
    require: name => name === '@iobroker/adapter-core' ? { I18n: { getTranslatedObject() { return {}; } } } : webRequire(name),
}, { filename: webFile, timeout: 5000 });
const Web = webExports.default;
const { EosSessionSecurity } = require('../build/lib/eosSessionSecurity');
const { hasEosUrlCredentials } = require('../build/lib/eosRequestSecurity');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const log = { debug() {}, info() {}, warn() {}, error() {} };
const controllerGroupView = require('./fixtures/controller-7.2.5-group-view.json');
function groupRows(documents) {
    const rows = [];
    const map = vm.runInNewContext(`(${controllerGroupView.view.map})`, {
        emit(id, value) { rows.push({ id, value }); },
    }, { timeout: 1000 });
    documents.forEach(map);
    return rows;
}
function webFixture() {
    return Object.assign(Object.create(Web.prototype), {
        publicPath: '/admin/', systemLanguage: 'en', settings: { auth: true, secure: true },
        adapter: { config: { ssoActive: true, oidcIssuer: 'https://unused.invalid', oidcClientId: 'unused' }, log },
    });
}
function response() {
    return { statusCode: 200, headers: {}, body: undefined,
        status(code) { this.statusCode = code; return this; },
        header(key, value) { this.headers[key] = value; return this; },
        send(body) { this.body = body; return this; } };
}
test('Admin8 serialized log buffers validate bytes and transfer size before conversion', () => {
    assert.equal(Web.toBuffer('safe').toString(), 'safe');
    assert.equal(Web.toBuffer({ type: 'Buffer', data: [65, 0, 255] }).toString('hex'), '4100ff');
    for (const payload of [null, 5, {}, { type: 'Other', data: [] }, { type: 'Buffer', data: [-1] },
        { type: 'Buffer', data: [256] }, { type: 'Buffer', data: ['65'] }, { type: 'Buffer', data: [1.5] }]) {
        assert.throws(() => Web.toBuffer(payload), /Invalid serialized log buffer/);
    }
    assert.throws(() => Web.toBuffer(Buffer.alloc(32 * 1024 * 1024 + 1)), /transfer limit/);
});
test('serialized and compressed logs render escaped text and ignore forged size metadata', async () => {
    const web = webFixture();
    for (const payload of [
        { data: { type: 'Buffer', data: [...Buffer.from('<script>marker</script>')] }, size: 0 },
        { data: gzipSync('<script>marker</script>'), size: 0, gz: true },
    ]) {
        const res = response(); await web.sendRemoteLog('test.log', payload, res);
        assert.equal(res.statusCode, 200); assert.equal(res.headers['Content-Type'], 'text/html');
        assert.ok(res.body.includes('&lt;script&gt;marker&lt;/script&gt;')); assert.ok(!res.body.includes('<script>marker'));
    }
    const res = response(); await web.sendRemoteLog('test.log', { data: 'x'.repeat(2 * 1024 * 1024 + 1), size: 1 }, res);
    assert.equal(res.headers['Content-Type'], 'text/plain');
    await assert.rejects(web.sendRemoteLog('test.log', { data: { type: 'Buffer', data: [300] } }, response()), /Invalid serialized/);
});
test('Admin8 public path survives login, iframe socket info and escaped 404 details', () => {
    const web = webFixture();
    assert.equal(web.loginPage, '/admin/index.html?login');
    const html = web.withInfoJs('tab.html', '<html><head></head><body>ui</body></html>');
    assert.ok(html.includes('<head><script src="/admin/_socket/info.js"></script>'));
    assert.equal(web.withInfoJs('tab.html', html), html, 'no duplicate injection');
    assert.equal(web.withInfoJs('data.json', 'safe'), 'safe');
    const page = web.get404Page('File %s not found', '<img src=x onerror=marker>$&');
    assert.ok(page.includes('&lt;img')); assert.ok(!page.includes('<img src=x')); assert.ok(page.includes('href="/admin/"'));
});
test('configured external SSO cannot become active through Admin8 config', () => {
    assert.equal(webFixture().getOidcConfig(), undefined);
});
test('proxy revocation and shutdown are wired to the Web lifecycle', () => {
    const web = webFixture(); let invalidations = 0; let proxyClosed = 0; let serverClosed = 0;
    web.instanceProxy = { invalidate() { invalidations++; }, close() { proxyClosed++; } };
    web.adapter.setState = async () => {};
    web.server = { server: { close() { serverClosed++; } } };
    web.invalidateProxySessions(); web.close();
    assert.equal(invalidations, 1); assert.equal(proxyClosed, 1); assert.equal(serverClosed, 1);
});
async function oauthFixture(t) {
    const sessions = new Map();
    const users = { 'system.user.operator': { type: 'user', common: { enabled: true, password: 'fixture-hash' }, native: {} } };
    const groups = groupRows([{ _id: 'system.group.eos-installer', type: 'group', common: { name: { en: 'EOS Installer', de: 'EOS Installateur' }, members: ['system.user.operator'], acl: {} } }]);
    const adapter = { config: {}, log,
        getSession(id, callback) { callback(clone(sessions.get(id))); },
        setSession(id, _ttl, value, callback) { sessions.set(id, clone(value)); callback?.(null); },
        async destroySession(id) { sessions.delete(id); },
        async getForeignObjectAsync(id) { return clone(users[id]); },
        async getObjectViewAsync() { return { rows: clone(groups) }; },
        checkPassword(name, password, callback) { callback(name === 'operator' && password === 'fixture-passphrase', `system.user.${name}`); },
    };
    const security = new EosSessionSecurity(adapter);
    const app = express();
    app.use((req, res, next) => hasEosUrlCredentials(req.query) ? res.status(400).json({ error: 'credentialsInUrlForbidden' }) : next());
    app.use(express.urlencoded({ extended: false, limit: '20kb' }));
    const model = createOAuth2Server(adapter, { app, secure: true, accessLifetime: 60, refreshLifetime: 120, noBasicAuth: true,
        authorizationCode: false, dynamicClientRegistration: false });
    security.bindOAuthModel(model);
    app.get('/identity', (req, res) => req.user ? res.json({ user: req.user }) : res.status(401).json({ error: 'notAuthenticated' }));
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(async () => { security.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = async values => {
        const res = await fetch(`${base}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: 'ioBroker', ...values }), signal: AbortSignal.timeout(5000) });
        return { status: res.status, headers: res.headers, body: await res.json() };
    };
    const login = () => token({ grant_type: 'password', username: 'operator', password: 'fixture-passphrase' });
    return { token, login, base, users, groups, sessions, model };
}
test('installed Admin8 OAuth password grant, token proof, cookie and refresh are compatible', async t => {
    const serverRequire = createRequire(require.resolve('../build/lib/vendor/webserver/package.json'));
    assert.equal(serverRequire('oauth2-server/package.json').name, '@node-oauth/oauth2-server');
    assert.equal(serverRequire('oauth2-server/package.json').version, '5.3.1');
    assert.equal(require('../build/lib/vendor/webserver/package.json').version, '3.4.0');
    const f = await oauthFixture(t); const first = await f.login();
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(typeof first.body.access_token, 'string'); assert.equal(typeof first.body.refresh_token, 'string');
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert.ok(first.headers.get('set-cookie').includes(flag));
    assert.equal(f.sessions.get(`a:${first.body.access_token}`).nexowattEosSessionV1.fingerprint.length, 64);
    const identity = await fetch(`${f.base}/identity`, { headers: { cookie: `access_token=${first.body.access_token}` } });
    assert.equal(identity.status, 200); assert.equal((await identity.json()).user, 'operator');
    const refreshed = await f.token({ grant_type: 'refresh_token', refresh_token: first.body.refresh_token });
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
    assert.notEqual(refreshed.body.refresh_token, first.body.refresh_token);
    assert.ok(f.sessions.get(`a:${refreshed.body.access_token}`).nexowattEosSessionV1);
    assert.equal(f.sessions.has(`r:${first.body.refresh_token}`), false);
    const replay = await f.token({ grant_type: 'refresh_token', refresh_token: first.body.refresh_token });
    assert.ok(replay.status >= 400 && replay.status < 500);
});
test('installed Admin8 OAuth denies bad credentials, unbound minting and URL tokens', async t => {
    const f = await oauthFixture(t);
    const bad = await f.token({ grant_type: 'password', username: 'operator', password: 'wrong' });
    assert.ok(bad.status >= 400 && bad.status < 500);
    assert.equal(f.sessions.size, 0);
    await assert.rejects(f.model.generateTokens('operator'), /REAUTHENTICATION/);
    const first = await f.login(); assert.equal(first.status, 200);
    const urlToken = await fetch(`${f.base}/identity?token=${first.body.access_token}`);
    assert.equal(urlToken.status, 400); assert.equal((await urlToken.json()).error, 'credentialsInUrlForbidden');
});
test('installed Admin8 OAuth accepts official controller standard groups and rejects duplicate identities', async t => {
    const f = await oauthFixture(t);
    f.groups.splice(0, f.groups.length, ...groupRows(clone(controllerGroupView.groups)));
    const first = await f.login();
    assert.equal(first.status, 200, JSON.stringify(first.body));
    f.groups.push(clone(f.groups[0]));
    f.groups.at(-1).id = 'Another display key for the same object';
    const duplicate = await f.login();
    assert.ok(duplicate.status >= 400 && duplicate.status < 500);
    const refresh = await f.token({ grant_type: 'refresh_token', refresh_token: first.body.refresh_token });
    assert.ok(refresh.status >= 400 && refresh.status < 500);
});
test('Admin8 OAuth invalidates cookie and refresh capability after credential/ACL changes', async t => {
    for (const mutate of [
        f => { f.users['system.user.operator'].common.password = 'changed-fixture-hash'; },
        f => { f.users['system.user.operator'].common.enabled = false; },
        f => { f.groups[0].value.common.members = []; },
        f => { f.groups[0].value.common.acl = { object: { read: false } }; },
        f => { f.groups[0].value._id = 'system.group.replaced'; },
    ]) {
        const f = await oauthFixture(t); const first = await f.login(); assert.equal(first.status, 200);
        mutate(f);
        const denied = await fetch(`${f.base}/identity`, { headers: { cookie: `access_token=${first.body.access_token}` } });
        assert.equal(denied.status, 401);
        const refresh = await f.token({ grant_type: 'refresh_token', refresh_token: first.body.refresh_token });
        assert.ok(refresh.status >= 400 && refresh.status < 500);
    }
});
