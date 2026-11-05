'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, symlink, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { gzipSync } = require('node:zlib');
const { EosUiSessionRegistry } = require('../build/lib/eosUiSessionRegistry.js');
const { createLocalLogFiles, createRemoteLogFiles, searchLogFiles, MAX_LOG_FILE_BYTES } = require('../build/lib/logSearch.js');

const identity = { user: 'system.user.service', socketId: 'socket-1', epoch: 'epoch-1', mayExecute: true };

test('Admin 8 GUI capability is bound to live socket, identity, role and security epoch', () => {
    let now = 1000;
    const sessions = new EosUiSessionRegistry(() => now);
    for (const change of [{ user: 'system.user.other' }, { epoch: 'epoch-2' }, { socketId: 'other' }, { mayExecute: false }]) {
        const token = sessions.issue('page', identity, 120);
        assert.match(token, /^[a-f0-9]{48}$/);
        assert.equal(sessions.get(token, () => identity).user, identity.user);
        assert.equal(sessions.get(token, () => ({ ...identity, ...change })), undefined);
    }
    const token = sessions.issue('page', identity, 120);
    assert.equal(sessions.get(token, () => undefined), undefined);
    const expired = sessions.issue('page', identity, 120);
    now += 120001;
    assert.equal(sessions.get(expired, () => identity), undefined);
});

test('GUI subscription bounds and explicit revocation cannot be bypassed by renewals', () => {
    const sessions = new EosUiSessionRegistry(() => 1000, 2);
    const first = sessions.issue('page-1', identity, 120);
    sessions.issue('page-2', identity, 120);
    assert.equal(sessions.issue('page-3', identity, 120), undefined);
    const replacement = sessions.issue('page-1', identity, 120);
    assert.equal(sessions.get(first, () => identity), undefined);
    assert.ok(sessions.get(replacement, () => identity));
    sessions.unsubscribe('page-1');
    assert.equal(sessions.get(replacement, () => identity), undefined);
    sessions.clear();
    assert.equal(sessions.size, 0);
    assert.equal(sessions.issue('page', { ...identity, user: '' }, 120), undefined);
    assert.equal(sessions.issue('page', identity, Infinity), undefined);
});

async function fixture(t) {
    const directory = await mkdtemp(join(tmpdir(), 'eos-admin8-log-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    return { directory, prefix: 'iobroker', extension: '.log', source: 'controller-config' };
}

test('Admin 8 log search reads matching local and compressed logs', async t => {
    const location = await fixture(t);
    const raw = '2026-11-04 12:00:00.000  - info: demo.0 (123) normal\n2026-11-04 12:01:00.000  - error: demo.0 (123) failed\n';
    await writeFile(join(location.directory, 'iobroker.2026-11-04.log'), raw);
    const result = await searchLogFiles({ files: createLocalLogFiles(location), hours: 24, level: 'error', now: new Date('2026-11-04T13:00:00').getTime() });
    assert.equal(result.lines.length, 1);
    assert.match(result.lines[0], /failed/);
    await writeFile(join(location.directory, 'iobroker.2026-11-03.log.gz'), gzipSync(raw));
    const lines = [];
    assert.equal(await createLocalLogFiles(location).readLines('iobroker.2026-11-03.log.gz', line => lines.push(line)), true);
    assert.equal(lines.length, 2);
});

test('Log file reads reject traversal, symbolic links and oversized expansion', async t => {
    const location = await fixture(t);
    const files = createLocalLogFiles(location);
    await assert.rejects(files.readLines('../iobroker.2026-11-04.log', () => {}), /Invalid log file path/);
    const outside = join(location.directory, 'outside.log');
    await writeFile(outside, 'secret');
    await symlink(outside, join(location.directory, 'iobroker.2026-11-04.log'));
    await assert.rejects(files.readLines('iobroker.2026-11-04.log', () => {}));
    await writeFile(join(location.directory, 'iobroker.2026-11-04.log.gz'), gzipSync(Buffer.alloc(MAX_LOG_FILE_BYTES + 1, 120)));
    await assert.rejects(files.readLines('iobroker.2026-11-04.log.gz', () => {}), /limit/i);
});

test('Remote log files are limited to validated listed basenames', async () => {
    const calls = [];
    const files = createRemoteLogFiles(async (command, payload) => {
        calls.push([command, payload]);
        if (command === 'getLogFiles') return { list: [
            { fileName: 'log/host/file/iobroker.2026-11-04.log', size: 100 },
            { fileName: 'log/host/file/../../iobroker.2026-11-04.log', size: 100 },
            { fileName: 'log/host/file/iobroker.2026-11-03.log', size: MAX_LOG_FILE_BYTES + 1 },
        ] };
        return { data: Buffer.from('safe\n') };
    });
    assert.deepEqual(await files.list(), ['iobroker.2026-11-04.log']);
    await assert.rejects(files.readLines('../secret', () => {}), /Unlisted/);
    const lines = [];
    await files.readLines('iobroker.2026-11-04.log', line => lines.push(line));
    assert.deepEqual(lines, ['safe']);
    assert.equal(calls.filter(([command]) => command === 'getLogFile').length, 1);
});

function emittedAdminMethod(name, globals = {}) {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const module = { exports: {}, parent: {} };
    const sandbox = {
        ...globals, module, exports: module.exports, __dirname: join(__dirname, '../build'),
        process: { env: {}, version: process.version },
        require(request) {
            if (request === 'node:fs') return { readFileSync: () => '{"name":"iobroker.eos-admin"}' };
            if (request.startsWith('node:')) return require(request);
            if (request === '@iobroker/adapter-core') return { Adapter: class { on() {} }, commonTools: {}, I18n: { getTranslatedObject: text => ({ en: text }) } };
            if (request === './lib/eosUiSessionRegistry') return require('../build/lib/eosUiSessionRegistry.js');
            return {};
        },
    };
    vm.runInNewContext(fs.readFileSync(join(__dirname, '../build/main.js'), 'utf8'), sandbox, { timeout: 5000, filename: 'build/main.js' });
    const method = module.exports({})[name];
    assert.equal(typeof method, 'function', `Actual emitted ${name} exists`);
    return method;
}

test('Shipped Admin 8 GUI requests require the authenticated sender and suppress revoked in-flight results', () => {
    const lookup = emittedAdminMethod('getUiSession');
    const responder = emittedAdminMethod('buildPushResponder', { UI_PUSH_MESSAGE_TYPE: 'pushedAnswer' });
    const sessions = new EosUiSessionRegistry();
    const token = sessions.issue('page', identity, 120);
    let current = identity;
    const replies = [], pushes = [];
    const adapter = {
        namespace: 'eos-admin.0', uiPushSessions: sessions,
        getUiIdentity: () => current,
        getUiSession(message) { return lookup.call(this, message); },
        sendTo: (...args) => replies.push(args),
        sendToUI: async value => { pushes.push(value); },
    };
    const message = { from: 'system.adapter.eos-admin.0', user: identity.user, command: 'admin:searchLogs', callback: { id: 1 }, message: { uiSession: token, requestId: 'search-1' } };
    assert.ok(adapter.getUiSession(message));
    assert.equal(adapter.getUiSession({ ...message, from: 'system.adapter.foreign.0' }), undefined);
    assert.equal(adapter.getUiSession({ ...message, user: 'system.user.guest' }), undefined);
    assert.equal(adapter.getUiSession({ ...message, user: undefined }), undefined);
    const respond = responder.call(adapter, message);
    assert.equal(replies.length, 1);
    current = undefined;
    respond({ lines: ['protected diagnostic'] });
    assert.equal(pushes.length, 0);
});

test('Shipped EOS socket authorization refuses startup if the Admin 8 dispatcher contract changes', () => {
    const install = emittedAdminMethod('installEosSocketCommandGuard', { ERROR_PERMISSION: 'permissionError', webServer: undefined });
    assert.throws(() => install.call({}, {}), /EOS_SOCKET_PERMISSION_API_UNAVAILABLE/);
    assert.throws(() => install.call({}, { commands: { _checkPermissions: true } }), /EOS_SOCKET_PERMISSION_API_UNAVAILABLE/);
});

test('Controller search replies validate shape, size and values before browser delivery', () => {
    const { validateLogSearchResult, MAX_LOG_RESPONSE_BYTES } = require('../build/lib/logSearch.js');
    const valid = { lines: ['diagnostic'], truncated: false, files: 1, until: Date.now() };
    assert.deepEqual(validateLogSearchResult(valid), valid);
    for (const invalid of [null, { ...valid, lines: [42] }, { ...valid, files: 65 }, { ...valid, until: Infinity },
        { ...valid, truncated: 'false' }, { ...valid, lines: Array(300).fill('x'.repeat(16384)) }]) {
        assert.equal(validateLogSearchResult(invalid), undefined);
    }
    assert.ok(MAX_LOG_RESPONSE_BYTES < 8 * 1024 * 1024);
});


test('Legacy OS-password RPC is disabled for every EOS role and never reflects supplied credentials', () => {
    const handler = emittedAdminMethod('processNotificationsGui');
    const replies = [];
    const adapter = { sendTo: (...args) => replies.push(args) };
    for (const user of ['system.user.admin', 'system.user.install', 'system.user.guest', undefined]) {
        handler.call(adapter, { command: 'admin:setPassword', from: 'system.adapter.eos-admin.0', user,
            callback: { id: 1 }, message: { login: 'root', oldPassword: 'UNTRUSTED_SECRET_MARKER', password: 'replacement', passwordRepeat: 'replacement' } });
    }
    assert.equal(replies.length, 4);
    for (const reply of replies) {
        assert.equal(reply[2].status, 410);
        assert.equal(reply[2].error, 'EOS_OS_PASSWORD_MANAGEMENT_DISABLED');
        assert.doesNotMatch(JSON.stringify(reply), /UNTRUSTED_SECRET_MARKER|replacement/);
    }
    handler.call(adapter, { command: 'admin:getNotificationSchema', from: 'system.adapter.eos-admin.0', callback: { id: 2 }, message: {} });
    const schema = replies.at(-1)[2].schema;
    assert.match(schema.items._info.text.en, /operating-system administrator/);
    assert.doesNotMatch(JSON.stringify(schema), /sendto|oldPassword|passwordRepeat/);
});

test('Shipped startup has no OS credential-probing helper or standalone su test program', () => {
    const fs = require('node:fs');
    const built = fs.readFileSync(join(__dirname, '../build/main.js'), 'utf8');
    assert.doesNotMatch(built, /checkWellKnownPasswords|setLinuxPassword|checkLinuxPass|testPassword/);
    for (const name of ['checkLinuxPass', 'testPassword']) {
        assert.equal(fs.existsSync(join(__dirname, `../build/lib/${name}.js`)), false);
        assert.equal(fs.existsSync(join(__dirname, `../src/lib/${name}.ts`)), false);
    }
    assert.match(built, /setPasswordAsync/, 'ioBroker account credential provisioning remains available');
});

test('Malformed fetch metadata is rejected without coercing untrusted header objects', () => {
    const { isEosSameOriginRequest } = require('../build/lib/eosRequestSecurity.js');
    let coerced = false;
    const headers = { host: 'eos.local:8188', origin: 'https://eos.local:8188' };
    for (const value of [['same-origin'], null, 42, { toString() { coerced = true; return 'same-origin'; } }]) {
        assert.equal(isEosSameOriginRequest({ ...headers, 'sec-fetch-site': value }, 'https:'), false);
    }
    assert.equal(coerced, false);
    assert.equal(isEosSameOriginRequest({ ...headers, 'sec-fetch-site': 'same-origin' }, 'https:'), true);
});

test('License storage reports both primary write failure and cleanup failures without losing either', async () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const writeError = Object.assign(new Error('synthetic write failure'), { code: 'EIO' });
    const closeError = Object.assign(new Error('synthetic close failure'), { code: 'EIO' });
    const unlinkError = Object.assign(new Error('synthetic cleanup failure'), { code: 'EACCES' });
    const module = { exports: {} };
    let closes = 0, removals = 0;
    const sandbox = { module, exports: module.exports, Buffer, process,
        require(name) {
            if (name === 'node:fs/promises') return {
                open: async () => ({ writeFile: async () => { throw writeError; }, close: async () => { closes++; throw closeError; } }),
                unlink: async () => { removals++; throw unlinkError; },
            };
            return require(name);
        },
    };
    vm.runInNewContext(fs.readFileSync(join(__dirname, '../build/lib/eosLicenseCore.js'), 'utf8'), sandbox, { timeout: 5000 });
    const store = new module.exports.EncryptedLicenseStore({ directory: join(tmpdir(), 'synthetic-eos-license'), uuid: '550e8400-e29b-41d4-a716-446655440000' });
    await assert.rejects(store._atomicWrite(Buffer.from('synthetic')), error => {
        assert.equal(error.name, 'AggregateError');
        assert.equal(error.errors.length, 3);
        assert.equal(error.errors[0], writeError);
        assert.equal(error.errors[1], closeError);
        assert.equal(error.errors[2], unlinkError);
        return true;
    });
    assert.equal(closes, 1);
    assert.equal(removals, 1);
});
