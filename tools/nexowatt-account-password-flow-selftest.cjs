#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const built = fs.readFileSync(path.join(root, 'build/lib/web.js'), 'utf8');
const accountUi = fs.readFileSync(path.join(root, 'adminWww/js/eos-account-management.js'), 'utf8');
const firstLoginUi = fs.readFileSync(path.join(root, 'adminWww/js/eos-role-bootstrap.js'), 'utf8');

function methodSlice(startMarker, endMarker) {
    const start = built.indexOf(startMarker);
    const end = built.indexOf(endMarker, start + startMarker.length);
    assert(start >= 0 && end > start, `method block not found: ${startMarker}`);
    return built.slice(start, end);
}

const methods = [
    methodSlice('    normalizeEosUserId(value) {', '    normalizeEosAdapterName(value) {'),
    methodSlice('    async readEosCurrentUser(req) {', '    getEosConfiguredRoleGroups(...keys) {'),
    methodSlice('    async getEosRequestAccess(req) {', '    getEosRoleCapabilities(role) {'),
    methodSlice('    validateEosFirstLoginPassword(password, passwordRepeat, userId) {', '    getEosPasswordUserName(userId) {'),
    methodSlice('    getEosPasswordUserName(userId) {', '    async destroyEosRequestSessions(req) {'),
    methodSlice('    async saveEosFirstLoginPassword(req, res) {', '    isEosPasswordlessFirstLoginEnabled() {'),
    methodSlice('    async resetEosAccountPassword(req, res) {', '    async getEosHistoryInstances() {'),
    methodSlice('    isEosSameOriginWrite(req) {', '    async saveEosBasicSettings(req, res) {'),
].join('\n');

const sandbox = { module: { exports: null }, URL, Set, console, EOS_PASSWORD_SERVICE_USER: 'system.user.admin' };
vm.runInNewContext(`module.exports = class Harness {\n${methods}\n}`, sandbox);
const Harness = sandbox.module.exports;

function responseMock() {
    return {
        statusCode: 200,
        payload: null,
        headers: {},
        clearedCookies: [],
        setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.payload = value; return this; },
        clearCookie(name) { this.clearedCookies.push(name); },
    };
}

function requestMock(body = {}, headers = {}) {
    return {
        body,
        headers: {
            host: '192.168.10.124:8081',
            origin: 'http://192.168.10.124:8081',
            'sec-fetch-site': 'same-origin',
            ...headers,
        },
        query: {},
        socket: { remoteAddress: '192.168.10.50' },
    };
}

async function resetScenario(requesterRole, targetRole, targetGroups) {
    const harness = new Harness();
    const writes = [];
    const metadata = {};
    harness.getEosRequestAccess = async () => ({ userId: requesterRole === 'admin' ? 'system.user.admin' : 'system.user.installer', role: requesterRole });
    harness.normalizeEosUserId = value => String(value || '').startsWith('system.user.') ? String(value) : `system.user.${value}`;
    harness.getEosAccessForUserId = async () => ({ role: targetRole, groups: targetGroups });
    harness.getEosInstallerGroups = () => ['system.group.installer', 'system.group.installateur'];
    harness.getEosEndUserGroups = () => ['system.group.endkunde', 'system.group.user'];
    harness.adapter = {
        setPasswordAsync: async (user, password) => writes.push([`system.user.${user}`, password]),
        checkPasswordAsync: async (user, password) => [password === 'nexowatt', `system.user.${user}`],
        getForeignObjectAsync: async id => ({ _id: id, common: { enabled: true, password: '$hash' }, native: { keep: true, nexowattEosAccount: {} } }),
        extendForeignObjectAsync: async (id, patch) => {
            metadata.id = id;
            metadata.native = patch.native;
        },
        log: { warn: () => undefined, info: () => undefined },
    };
    harness.invalidateEosPasswordClaimsForUser = () => undefined;
    const res = responseMock();
    await harness.resetEosAccountPassword(
        requestMock({ user: targetRole === 'installer' ? 'system.user.installer-target' : 'system.user.user' }, { 'x-nexowatt-eos-account-reset': '1' }),
        res,
    );
    return { res, writes, metadata };
}

(async () => {
    // Authenticated request identities are normalized to the real ioBroker user object id.
    const accessHarness = new Harness();
    accessHarness.getEosAccessForUserId = async userId => ({ userId, role: userId === 'system.user.admin' ? 'admin' : 'enduser' });
    const directAdmin = await accessHarness.getEosRequestAccess({ user: 'admin' });
    assert.equal(directAdmin.userId, 'system.user.admin');
    assert.equal(directAdmin.role, 'admin');
    const objectAdmin = await accessHarness.getEosRequestAccess({ user: { id: 'system.user.admin' } });
    assert.equal(objectAdmin.userId, 'system.user.admin');
    assert.equal(objectAdmin.role, 'admin');

    // Admin/Service can reset an explicitly managed End User and Installer account.
    const adminEndUser = await resetScenario('admin', 'enduser', ['system.group.endkunde']);
    assert.equal(adminEndUser.res.statusCode, 200);
    assert.deepEqual(adminEndUser.writes, [['system.user.user', 'nexowatt']]);
    assert.equal(adminEndUser.metadata.native.nexowattEosAccount.forcePasswordChange, true);
    assert.equal(adminEndUser.metadata.native.nexowattEosAccount.passwordResetMode, 'initial-password');
    assert.equal(adminEndUser.metadata.native.nexowattPasswordChangeRequired, true);

    const adminInstaller = await resetScenario('admin', 'installer', ['system.group.installer']);
    assert.equal(adminInstaller.res.statusCode, 200);
    assert.deepEqual(adminInstaller.writes, [['system.user.installer-target', 'nexowatt']]);

    // Installer may never reset another installer account.
    const installerDenied = await resetScenario('installer', 'installer', ['system.group.installer']);
    assert.equal(installerDenied.res.statusCode, 403);
    assert.equal(installerDenied.res.payload.error, 'permissionError');
    assert.equal(installerDenied.writes.length, 0);

    // First-login password save must write the real account and clear every force-change flag.
    const harness = new Harness();
    const passwordWrites = [];
    let metadata;
    let sessionsDestroyed = false;
    harness.getEosRequestAccess = async () => ({ userId: 'system.user.user', role: 'enduser' });
    harness.getEosFirstLoginPasswordState = async () => ({ required: true, initialized: false, minLength: 10, version: 1 });
    harness.getEosFirstLoginPasswordMinLength = () => 10;
    harness.destroyEosRequestSessions = async () => { sessionsDestroyed = true; };
    harness.adapter = {
        setPasswordAsync: async (user, password) => passwordWrites.push([`system.user.${user}`, password]),
        checkPasswordAsync: async (user, password) => [password === 'NexoWatt2025!', `system.user.${user}`],
        getForeignObjectAsync: async id => ({ _id: id, common: { enabled: true, password: '$hash' }, native: { nexowattEosAccount: {} } }),
        extendForeignObjectAsync: async (id, patch) => { metadata = { id, native: patch.native }; },
        log: { info: () => undefined },
    };
    const acceptedPassword = harness.validateEosFirstLoginPassword(
        'NexoWatt2025!',
        'NexoWatt2025!',
        'system.user.user',
    );
    assert.equal(acceptedPassword.valid, true);
    assert.equal(acceptedPassword.password, 'NexoWatt2025!');
    const saveRes = responseMock();
    await harness.saveEosFirstLoginPassword(
        requestMock(
            { password: 'NexoWatt2025!', passwordRepeat: 'NexoWatt2025!' },
            { 'x-nexowatt-eos-first-login': '1' },
        ),
        saveRes,
    );
    assert.equal(saveRes.statusCode, 200);
    assert.equal(saveRes.payload.success, true);
    assert.equal(saveRes.payload.logoutRequired, true);
    assert.deepEqual(passwordWrites, [['system.user.user', 'NexoWatt2025!']]);
    assert.equal(metadata.native.nexowattEosAccount.passwordInitialized, true);
    assert.equal(metadata.native.nexowattEosAccount.forcePasswordChange, false);
    assert.equal(metadata.native.nexowattPasswordChangeRequired, false);
    assert.equal(metadata.native.eosFirstLoginRequired, false);
    assert.equal(sessionsDestroyed, true);
    assert.deepEqual(saveRes.clearedCookies.sort(), ['access_token', 'connect.sid', 'refresh_token'].sort());

    // Same-origin logic must support direct access and a reverse proxy without accepting cross-site writes.
    const originHarness = new Harness();
    assert.equal(originHarness.isEosSameOriginWrite(requestMock()), true);
    assert.equal(originHarness.isEosSameOriginWrite(requestMock({}, {
        host: '127.0.0.1:8081',
        origin: 'https://eos.example.test',
        'x-forwarded-host': 'eos.example.test',
        'sec-fetch-site': 'same-origin',
    })), true);
    assert.equal(originHarness.isEosSameOriginWrite(requestMock({}, {
        origin: 'https://attacker.example',
        'sec-fetch-site': 'cross-site',
    })), false);

    // Browser writes must preserve the authenticated session cookie.
    assert.match(accountUi, /nexowatt\/account\/reset/);
    assert.match(accountUi, /method:\s*'POST',\s*credentials:\s*'include'/);
    assert.match(firstLoginUi, /nexowatt\/account\/first-password/);
    assert.match(firstLoginUi, /method:\s*'POST',\s*credentials:\s*'include'/);

    console.log('[NexoWatt EOS account password flow] OK: Admin/Installer permissions, initial password reset, personal password save, session and origin checks verified.');
})().catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
