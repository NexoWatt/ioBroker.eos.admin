'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const safety = import('../src-admin/src/helpers/configExpressionSafety.ts');
test('alias parser validates syntax without running statements or sample values', async () => {
    const { validateAliasSyntax } = await safety;
    globalThis.__eosAliasExecuted = false;
    for (const expression of ['val / 5 + 21', 'return val * 2;', 'JSON.parse(val)', 'globalThis.__eosAliasExecuted = true; return val;', 'while(true){} return val;']) assert.equal(validateAliasSyntax(expression), null, expression);
    assert.equal(globalThis.__eosAliasExecuted, false);
    assert.notEqual(validateAliasSyntax('return )'), null);
    assert.notEqual(validateAliasSyntax('x'.repeat(4097)), null);
    assert.notEqual(validateAliasSyntax('('.repeat(100) + 'val' + ')'.repeat(100)), null);
    assert.notEqual(validateAliasSyntax(2), null);
    delete globalThis.__eosAliasExecuted;
});
test('static custom schemas remain available without executing values', async () => {
    const { validateStaticCustomSchema } = await safety;
    const schema = { type: 'panel', items: { enabled: { type: 'checkbox', default: false }, count: { type: 'number', default: 2, min: 0, max: 10 }, hidden: { type: 'text', hidden: true } } };
    assert.deepEqual(validateStaticCustomSchema(schema), { ok: true });
    assert.equal(validateStaticCustomSchema(null).ok, false);
    assert.equal(validateStaticCustomSchema([]).ok, false);
});
test('custom executable fields and alternate vendor interpolation paths are blocked', async () => {
    const { validateStaticCustomSchema } = await safety;
    for (const field of ['func', 'defaultFunc', 'hidden', 'disabled', 'validator', 'calculateFunc', 'condition']) {
        assert.equal(validateStaticCustomSchema({ items: { field: { [field]: '_socket.setState("x",1)' } } }).ok, false, field);
    }
    for (const text of ['${_socket.setState("x",1)}', '`; globalThis.pwned=true; //']) assert.equal(validateStaticCustomSchema({ items: { x: { label: text } } }).ok, false);
    assert.equal(validateStaticCustomSchema({ items: { x: { onChange: { calculateFunc: { func: 'return true' } } } } }).ok, false);
    for (const type of ['custom', 'selectSendTo']) {
        assert.equal(validateStaticCustomSchema({ type: 'panel', items: { x: { type, url: 'https://example.invalid/component.js', command: 'options' } } }).ok, false);
    }
    assert.equal(validateStaticCustomSchema({ items: { x: { onChangeDependsOn: [{ onChange: { calculateFunc: 'return true' } }] } } }).ok, false);
    assert.equal(validateStaticCustomSchema({ items: { x: { confirmDependsOn: [{ confirm: { condition: 'return true' } }] } } }).ok, false);
    for (const item of [
        { type: 'staticText', format: 'html', text: '<img src=x onerror=alert(1)>' },
        { type: 'staticInfo', html: true, data: '<img src=x onerror=alert(1)>' },
        { type: 'textSendTo', container: 'html', command: 'html' },
        { type: 'state', control: 'html', oid: 'test.value' },
    ]) assert.equal(validateStaticCustomSchema({ items: { x: item } }).ok, false);
    assert.equal(validateStaticCustomSchema({ items: { format: { type: 'text' }, html: { type: 'checkbox', default: false } } }).ok, true);
});
test('schema bounds and own-data validation reject pollution, getters, cycles and oversized values', async () => {
    const { validateStaticCustomSchema } = await safety;
    assert.equal(validateStaticCustomSchema(JSON.parse('{"__proto__":{"polluted":true}}')).ok, false);
    assert.equal(validateStaticCustomSchema({ x: Infinity }).ok, false);
    let read = false; const getter = {}; Object.defineProperty(getter, 'x', { get() { read = true; return 1; } });
    assert.equal(validateStaticCustomSchema(getter).ok, false); assert.equal(read, false);
    const cycle = {}; cycle.x = cycle; assert.equal(validateStaticCustomSchema(cycle).ok, false);
    assert.equal(validateStaticCustomSchema({ text: 'x'.repeat(65537) }).ok, false);
    assert.equal(validateStaticCustomSchema({ items: Array(10001).fill(null) }).ok, false);
});
test('vendored syntax parser matches reviewed integrity and license provenance', () => {
    const base = path.join(__dirname, '../src-admin/src/vendor/acorn');
    const provenance = JSON.parse(fs.readFileSync(path.join(base, 'PROVENANCE.json'), 'utf8'));
    assert.equal(provenance.version, '8.17.0'); assert.equal(provenance.license, 'MIT');
    for (const [file, expected] of Object.entries(provenance.sha256)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(base, file))).digest('hex'), expected);
});
