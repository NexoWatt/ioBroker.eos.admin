'use strict';
// Executes exact, reviewed controller method excerpts with in-memory transport.
// No user database, real password, external host or production service is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const repo = path.resolve(__dirname, '../../../..');
const fixture = require(path.join(repo, 'test/fixtures/controller-7.2.5-group-view.json'));
const { EosSessionSecurity: Fixed } = require(path.join(repo, 'src/lib/eosSessionSecurity.js'));
const oldModule = { exports: {} };
vm.runInThisContext(`(function(require, module, exports) {\n${fs.readFileSync(path.join(__dirname, 'eos-session-8.0.0.js.txt'), 'utf8')}\n})`)(require, oldModule, oldModule.exports);
const Old = oldModule.exports.EosSessionSecurity;
const { OAuth2Model } = require(path.join(path.dirname(require.resolve('@iobroker/webserver/package.json')), 'build/lib/oauth2-model.js'));
const clone = value => JSON.parse(JSON.stringify(value));
const log = { debug() {}, info() {}, warn() {}, error() {} };
function replayClass(file) {
    const source = `class UpstreamReplay {\n${fs.readFileSync(path.join(__dirname, file), 'utf8')}\n}`;
    return vm.runInThisContext(`(() => {\n${stripTypeScriptTypes(source, { mode: 'transform' })}\nreturn UpstreamReplay;\n})()`);
}
async function exercise(Security, rows) {
    let credentialChecks = 0;
    const adapter = {
        config: {}, log,
        getSession(_id, cb) { cb(null); },
        setSession(_id, _ttl, _data, cb) { cb?.(null); },
        async getForeignObjectAsync(id) {
            return id === 'system.user.admin' ? { _id: id, type: 'user', common: { enabled: true, password: 'synthetic-fixture-hash' }, native: {} } : null;
        },
        async getObjectViewAsync() { return { rows: clone(rows) }; },
        checkPassword(user, password, cb) {
            credentialChecks++;
            cb(user === 'admin' && password === 'synthetic-fixture-password', 'system.user.admin');
        },
    };
    const security = new Security(adapter);
    const model = new OAuth2Model(adapter, { noBasicAuth: true });
    security.bindOAuthModel(model);
    try {
        const user = await model.getUser('admin', 'synthetic-fixture-password');
        return { authenticated: user?.id === 'admin', credentialChecks };
    } finally {
        security.stop();
    }
}
(async () => {
    const FileReplay = replayClass('controller-file-view.ts.txt');
    const RedisReplay = replayClass('controller-redis-view.ts.txt');
    const params = { startkey: 'system.group.', endkey: 'system.group.\u9999' };
    const file = new FileReplay();
    file.dataset = Object.fromEntries(clone(fixture.groups).map(group => [group._id, group]));
    file.log = log;
    const fileResult = file._applyView(fixture.view, clone(params));
    const redis = new RedisReplay();
    redis.log = log;
    redis.scripts = { filter: 'synthetic-filter-hash' };
    redis.objNamespace = 'cfg.o.';
    redis.setNamespace = 'cfg.s.';
    redis.client = {
        async evalsha(_sha, _count, _namespace, start, end, type) {
            assert.equal(type, 'group');
            // Only Redis transport is replaced. Row construction remains the
            // exact controller implementation, including translated names.
            return [fixture.groups.filter(group => group._id >= start && group._id <= end).map(group => JSON.stringify(group)), '0'];
        },
    };
    const redisResult = await redis._applyViewFunc(fixture.view, clone(params), {});
    const results = [];
    for (const [backend, result] of [['controller-file-view', fileResult], ['controller-redis-view', redisResult]]) {
        const before = await exercise(Old, result.rows);
        const after = await exercise(Fixed, result.rows);
        assert.deepEqual(before, { authenticated: false, credentialChecks: 0 });
        assert.deepEqual(after, { authenticated: true, credentialChecks: 1 });
        results.push({ backend, rows: result.rows.map(row => ({ emittedKey: row.id, canonicalId: row.value._id })), before, after });
    }
    console.log(JSON.stringify({ node: process.version, controller: fixture.source, webserver: require('@iobroker/webserver/package.json').version,
        scope: 'Exact official view methods and shipped OAuth model; in-memory DB/credential transport, not a live controller or appliance', results }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
