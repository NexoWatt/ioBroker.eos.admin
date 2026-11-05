'use strict';
// Execute the current Web implementation with installed runtime modules. Only
// controller persistence is synthetic; this is not a live-controller test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const ts = require('typescript');
const express = require('express');
const { createOAuth2Server } = require('../build/lib/vendor/webserver');
const { EosSessionSecurity } = require('../src/lib/eosSessionSecurity');
const { registerLicenseRoutes } = require('../src/lib/eosLicenseHttp');
const sourcePath = path.resolve(__dirname, '../src/lib/web.ts');
const buildPath = path.resolve(__dirname, '../build/lib/web.js');
const webRequire = createRequire(buildPath);
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, {
    exports: exportsObject, module: { exports: exportsObject }, __dirname: path.dirname(buildPath),
    Buffer, URL, console, process,
    require: name => name === '@iobroker/adapter-core' ? { I18n: { getTranslatedObject() { return {}; } } } : webRequire(name),
}, { filename: sourcePath, timeout: 5000 });
const Web = exportsObject.default;
const fixture = require('./fixtures/controller-7.2.5-group-view.json');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const log = { debug() {}, info() {}, warn() {}, error() {} };
function groupRows(groups) {
    const rows = [];
    const map = vm.runInNewContext(`(${fixture.view.map})`, {
        emit(id, value) { rows.push({ id, value }); },
    }, { timeout: 1000 });
    groups.forEach(map);
    return rows;
}
function group(id, members, name = { en: 'Arbitrary display name', de: 'Anzeigename' }) {
    return { _id: id, type: 'group', common: { name, members, acl: {} } };
}
function webFixture(rows, settings = {}) {
    return Object.assign(Object.create(Web.prototype), {
        publicPath: '/', settings: { auth: true, secure: true, ...settings },
        adapter: { log, async getObjectViewAsync() { return { rows: clone(rows) }; } },
    });
}

test('controller translated view keys resolve canonical admin membership for any username', async () => {
    const documents = clone(fixture.groups);
    documents[0].common.members.push('system.user.facility-manager');
    documents[1].common.members.push('system.user.facility-manager', 'system.user.admin');
    const web = webFixture(groupRows(documents));
    for (const user of ['system.user.admin', 'system.user.facility-manager']) {
        const access = await web.getEosAccessForUserId(user);
        assert.equal(access.role, 'admin');
        assert.deepEqual(Array.from(access.groups), ['system.group.administrator', 'system.group.user']);
        assert.equal(web.getEosRoleCapabilities(access.role).licenseAdministration, true);
    }
});

test('configured service and installer groups use canonical IDs; display text cannot elevate privileges', async () => {
    const rows = groupRows([
        group('system.group.partner-maintenance', ['system.user.partner']),
        group('system.group.installer', ['system.user.electrician']),
        group('system.group.user', ['system.user.customer'], 'system.group.administrator'),
    ]);
    const web = webFixture(rows, { eosSecurityAdminGroups: ['system.group.partner-maintenance'] });
    assert.equal((await web.getEosAccessForUserId('system.user.partner')).role, 'admin');
    const installer = await web.getEosAccessForUserId('system.user.electrician');
    assert.equal(installer.role, 'installer');
    assert.equal(web.getEosRoleCapabilities(installer.role).licenseAdministration, false);
    assert.equal((await web.getEosAccessForUserId('system.user.customer')).role, 'enduser');
    assert.equal((await web.getEosAccessForUserId(null)).role, 'enduser');
});

test('role context rejects malformed views and duplicate IDs instead of returning partial roles', async () => {
    const good = groupRows([group('system.group.administrator', ['system.user.facility-manager'])])[0];
    const invalid = [
        null, {}, { id: 'system.group.administrator', value: null },
        { id: 'system.group.administrator', value: { type: 'group', common: { members: ['system.user.facility-manager'] } } },
        ...['', 'system.group.', 'system.user.administrator', 17, `system.group.${'x'.repeat(1024)}`]
            .map(id => ({ id: 'Administrator', value: group(id, ['system.user.facility-manager']) })),
        { id: 'Administrator', value: { ...group('system.group.other', []), type: 'user' } },
        { id: 'Administrator', value: group('system.group.other', 'system.user.facility-manager') },
        { ...clone(good), id: 'Different display name for the same group' },
    ];
    for (const row of invalid) {
        await assert.rejects(webFixture([good, row]).getEosAccessForUserId('system.user.facility-manager'),
            /EOS_SECURITY_GROUPS_UNAVAILABLE/);
    }
    for (const rows of [null, {}, Array.from({ length: 1025 }, (_, i) => ({ value: group(`system.group.g${i}`, []) }))]) {
        await assert.rejects(webFixture(rows).getEosAccessForUserId('system.user.admin'), /EOS_SECURITY_GROUPS_UNAVAILABLE/);
    }
    const unavailable = webFixture([]);
    unavailable.adapter.getObjectViewAsync = async () => { throw new Error('Synthetic DB failure'); };
    await assert.rejects(unavailable.getEosAccessForUserId('system.user.admin'), /EOS_SECURITY_GROUPS_UNAVAILABLE/);
});

test('role context ignores presentation key type and orders distinct identities deterministically', async () => {
    const rows = groupRows([
        group('system.group.z', ['system.user.operator'], { en: 'Same name' }),
        group('system.group.a', ['system.user.operator'], { en: 'Same name' }),
    ]);
    rows[0].id = { en: 'Translated view key' };
    rows[1].id = 123;
    assert.deepEqual(Array.from((await webFixture(rows).getEosAccessForUserId('system.user.operator')).groups),
        ['system.group.a', 'system.group.z']);
});

test('real OAuth tokens authenticate role context and protected license status via cookie and bearer', async t => {
    const sessions = new Map();
    const users = Object.fromEntries(['manager', 'installer', 'customer'].map(name => [
        `system.user.${name}`, { type: 'user', common: { enabled: true, password: 'synthetic-test-hash' }, native: {} },
    ]));
    const rows = groupRows([
        group('system.group.administrator', ['system.user.manager']),
        group('system.group.user', ['system.user.manager', 'system.user.customer']),
        group('system.group.installer', ['system.user.installer']),
    ]);
    const web = webFixture(rows);
    Object.assign(web.adapter, {
        config: {},
        getSession(id, callback) { callback(clone(sessions.get(id))); },
        setSession(id, _ttl, value, callback) { sessions.set(id, clone(value)); callback?.(null); },
        async destroySession(id) { sessions.delete(id); },
        async getForeignObjectAsync(id) { return clone(users[id]); },
        checkPassword(name, password, callback) {
            callback(!!users[`system.user.${name}`] && password === 'synthetic-test-passphrase', `system.user.${name}`);
        },
    });
    const security = new EosSessionSecurity(web.adapter);
    const app = express();
    app.use(express.urlencoded({ extended: false, limit: '20kb' }));
    security.bindOAuthModel(createOAuth2Server(web.adapter, {
        app, secure: true, accessLifetime: 60, refreshLifetime: 120, noBasicAuth: true,
        authorizationCode: false, dynamicClientRegistration: false,
    }));
    app.get('/nexowatt/security/context', (req, res) => {
        void web.sendEosSecuritySession(req, res).catch(() => res.status(503).json({ role: 'unknown' }));
    });
    registerLicenseRoutes(app, {
        service: { async status() { return { installed: false, uuid: 'synthetic-system' }; } },
        secure: true,
        authorize: async req => {
            const access = await web.getEosRequestAccess(req);
            return !!access.userId && access.role === 'admin'
                && !(await web.getEosFirstLoginPasswordState(access.userId, access.role)).required;
        },
        jsonParser: express.json({ limit: '20kb', strict: true }),
        pagePath: '/unused', scriptPath: '/unused',
    });
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(async () => { security.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [name, role] of [['manager', 'admin'], ['installer', 'installer'], ['customer', 'enduser']]) {
        const login = await fetch(`${base}/oauth/token`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: 'ioBroker', grant_type: 'password', username: name, password: 'synthetic-test-passphrase' }),
            signal: AbortSignal.timeout(5000),
        });
        assert.equal(login.status, 200);
        const token = (await login.json()).access_token;
        for (const headers of [{ cookie: `access_token=${token}` }, { Authorization: `Bearer ${token}` }]) {
            const context = await fetch(`${base}/nexowatt/security/context`, { headers, signal: AbortSignal.timeout(5000) });
            assert.equal(context.status, 200);
            const result = await context.json();
            assert.equal(result.authenticated, true);
            assert.equal(result.role, role);
            assert.equal(result.capabilities.licenseAdministration, role === 'admin');
            const license = await fetch(`${base}/nexowatt/license/status`, { headers, signal: AbortSignal.timeout(5000) });
            assert.equal(license.status, role === 'admin' ? 200 : 403);
        }
    }
    const denied = await fetch(`${base}/nexowatt/license/status`, { signal: AbortSignal.timeout(5000) });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error, 'LICENSE_ADMIN_REQUIRED');
});
