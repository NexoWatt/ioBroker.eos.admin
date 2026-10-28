'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '..');
const backend = require('../src/lib/eosNewsSecurity.js');
const ts = fs.readFileSync(path.join(root, 'src-admin/src/helpers/eosNewsSecurity.ts'), 'utf8');
const frontend = vm.runInNewContext(stripTypeScriptTypes(ts).replace('export function', 'function') + '\n({matchesObjectCount})');
const cases = [[4, '> 3', true], [3, '>= 3', true], [2, '<3', true], [2, '<= 2', true],
    [3, '== 3', true], [3, '=== 3', true], [3, '!= 4', true], [3, '!== 4', true],
    [3, '> 4', false], [4, '< 3', false], [3, '== 4', false], [3, '!= 3', false],
    [0, ' >= 0 ', true], [3, '>= 9007199254740992', false], [NaN, '> 0', false],
    ['3', '== 3', false], [-1, '> 0', false], [3, {}, false], [3, null, false],
    [3, '> -1', false], [3, '>= 03', false], [3, '>= 1.5', false], [3, '>= 1e0', false],
    [3, '>= 1 || true', false], [3, '; globalThis.eosAuditMarker = true; true', false],
    [3, '>= 1\n; throw 1', false], [3, '> ' + '1'.repeat(10000), false]];
test('backend and frontend compare data and reject executable/malformed conditions', () => {
    for (const [count, expression, expected] of cases) {
        assert.equal(backend.matchesObjectCount(count, expression), expected);
        assert.equal(frontend.matchesObjectCount(count, expression), expected);
    }
    assert.equal(globalThis.eosAuditMarker, undefined);
});
test('shipped frontend expression has the same outcomes and contains no news eval', () => {
    const expression = '(' + backend.matchesObjectCount.toString() + ')(context.noObjects,message["number-of-objects"])';
    let found = 0;
    for (const file of fs.readdirSync(path.join(root, 'adminWww/assets')).filter(name => /^bootstrap-.*\.js$/.test(name))) {
        const bundle = fs.readFileSync(path.join(root, 'adminWww/assets', file), 'utf8');
        assert.ok(!/eval\([^\n;]*number-of-objects/.test(bundle));
        if (!bundle.includes(expression)) continue;
        assert.ok(bundle.includes('showIt&&message["number-of-objects"]!==undefined&&(showIt='));
        found++;
        for (const [count, condition, expected] of cases) {
            const context = { context: { noObjects: count }, message: { 'number-of-objects': condition } };
            assert.equal(vm.runInNewContext(expression, context, { timeout: 100 }), expected);
            assert.equal(context.eosAuditMarker, undefined);
        }
    }
    assert.ok(found > 0, 'Actual shipped bootstrap must include the safe expression');
});
test('actual shipped news method refuses marker and preserves numeric behavior', async () => {
    const built = fs.readFileSync(path.join(root, 'build/main.js'), 'utf8');
    const start = built.indexOf('  async registerNewsNotifications(messages, lastMessageId) {');
    const end = built.indexOf('\n  /**', start);
    assert.ok(start > 0 && end > start);
    const sandbox = { _nodeOs: { platform: () => 'linux' }, process: { version: 'v24.22.1' }, _eosNewsSecurity: backend };
    const method = vm.runInNewContext('({' + built.slice(start, end) + '}).registerNewsNotifications', sandbox);
    let notifications = 0, queries = 0;
    const adapter = { getObjectViewAsync: async () => ({ rows: [] }), getForeignObjectAsync: async () => null,
        getNpmVersion: async () => '11.9.0', log: { info() {} },
        getObjectListAsync: async options => { assert.equal(options.include_docs, false); queries++; return { rows: [{}, {}] }; },
        registerNotification: async () => { notifications++; } };
    const msg = condition => ({ id: 'audit', class: 'info', title: { en: 'test' }, content: { en: 'test' }, 'number-of-objects': condition });
    await method.call(adapter, [msg('; globalThis.eosAuditMarker = true; true'), msg('>= 2'), msg('> 100'), msg(''), msg(false), msg(0), msg(null)]);
    assert.equal(sandbox.eosAuditMarker, undefined);
    assert.equal(notifications, 1);
    assert.equal(queries, 1);
});
test('Node index validates bounded schema and strips unused data', () => {
    assert.throws(() => backend.validateNodeReleaseIndex({}), /SCHEMA/);
    assert.throws(() => backend.validateNodeReleaseIndex(new Array(5001)), /SCHEMA/);
    assert.deepEqual(backend.validateNodeReleaseIndex([{ version: 'v24.22.1', npm: '11.9.0', extra: 'discard' }, null,
        { version: {}, npm: '11.9.0' }, { version: 'v1.2.3', npm: 'bad' }]), [{ version: 'v24.22.1', npm: '11.9.0' }]);
    const source = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');
    assert.ok(source.includes("allowedHosts: ['nodejs.org'], maxBytes: 2_097_152, budgetMs: 5000"));
    assert.ok(!source.includes('axios'));
});
