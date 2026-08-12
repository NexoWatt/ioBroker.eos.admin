#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src-admin/public/js/eos-manual-write-policy.js'), 'utf8');
const sandbox = { window: {}, globalThis: null, console, Map, Promise, Error, String, Object, Boolean, Number, JSON, Array, setTimeout, clearTimeout };
sandbox.globalThis = sandbox.window;
vm.runInNewContext(source, sandbox, { filename: 'eos-manual-write-policy.js' });
const w = sandbox.window;
const policy = {
    getWriteBehavior: w.NEXOWATT_EOS_GET_WRITE_BEHAVIOR,
    isExpertOnlyState: w.NEXOWATT_EOS_IS_EXPERT_ONLY_STATE,
    toBoolean: w.NEXOWATT_EOS_COERCE_BOOLEAN,
    writeManualState: w.NEXOWATT_EOS_WRITE_MANUAL_STATE,
    resolveEditorType: w.NEXOWATT_EOS_RESOLVE_EDITOR_TYPE,
    prepareEditorValue: w.NEXOWATT_EOS_PREPARE_EDITOR_VALUE,
    coerceWriteValue: w.NEXOWATT_EOS_COERCE_WRITE_VALUE,
    getDirectWriteValue: w.NEXOWATT_EOS_GET_DIRECT_WRITE_VALUE,
    normalizeStates: w.NEXOWATT_EOS_NORMALIZE_STATES,
};
const fail = message => { throw new Error(`[NexoWatt EOS manual write policy selftest] ${message}`); };
const equal = (actual, expected, message) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
};

(async () => {
    for (const [name, fn] of Object.entries(policy)) if (typeof fn !== 'function') fail(`missing ${name}`);
    const state = (id, common, item = { data: {} }, expert = false) => policy.getWriteBehavior(id, { type: 'state', common }, item, expert);
    if (state('x.read', { write: false, type: 'number' }) !== 'readonly') fail('read-only state became writable');
    if (state('ocpp.0.availability', { write: true, type: 'boolean', role: 'switch' }, { data: { switch: true } }) !== 'switch') fail('availability switch must be directly operable');
    if (state('ocpp.0.hardReset', { write: true, type: 'boolean', role: 'button' }, { data: { button: true } }, false) !== 'expert-only') fail('hard reset must be expert-only');
    if (state('ocpp.0.hardReset', { write: true, type: 'boolean', role: 'button' }, { data: { button: true } }, true) !== 'button') fail('hard reset must work in expert mode');
    if (state('ess.ctrl.chargePowerW', { write: true, type: 'number', role: 'level.power' }, { data: {} }, false) !== 'expert-only') fail('charge power must be expert-only');
    if (state('ess.ctrl.chargePowerW', { write: true, type: 'number', role: 'level.power' }, { data: {} }, true) !== 'dialog') fail('charge power must use dialog in expert mode');
    if (state('test.temperatureSetpoint', { write: true, type: 'number', role: 'level.temperature' }) !== 'dialog') fail('normal scalar value must use dialog');
    if (state('test.flag', { write: true, type: 'boolean', role: 'state' }) !== 'switch') fail('writable boolean must toggle');
    if (!policy.toBoolean('true') || policy.toBoolean('false') || policy.toBoolean(null)) fail('boolean coercion is not deterministic');

    const explicitObj = { type: 'state', common: { write: true, type: 'number', role: 'level.power', custom: { nexowatt: { manualWriteExpertOnly: false } } } };
    if (policy.getWriteBehavior('custom.safePower', explicitObj, { data: {} }, false) !== 'dialog') fail('explicit safe override ignored');


    if (state('test.mode', { write: true, type: 'number', role: 'switch.mode', states: { 0: 'Auto', 1: 'On', 2: 'Off' } }, { data: { switch: true } }) !== 'dialog') fail('multi-state mode must use selector dialog');
    if (state('test.binaryMode', { write: true, type: 'number', role: 'switch.mode', states: { 0: 'Off', 1: 'On' } }, { data: { switch: true } }) !== 'switch') fail('two-state mode should remain a switch');
    const explicitDialog = { type: 'state', common: { write: true, type: 'boolean', role: 'switch', custom: { nexowatt: { manualWriteControl: 'dialog' } } } };
    if (policy.getWriteBehavior('custom.booleanDialog', explicitDialog, { data: { switch: true } }, false) !== 'dialog') fail('explicit dialog control ignored');

    // Complete editor type coverage.
    equal(policy.resolveEditorType({ common: { type: 'number' } }, 12), 'number', 'number editor');
    equal(policy.resolveEditorType({ common: { type: 'boolean' } }, false), 'boolean', 'boolean editor');
    equal(policy.resolveEditorType({ common: { type: 'object' } }, { a: 1 }), 'json', 'object editor');
    equal(policy.resolveEditorType({ common: { type: 'array' } }, [1, 2]), 'json', 'array editor');
    equal(policy.resolveEditorType({ common: { type: 'mixed' } }, 4), 'number', 'mixed number editor');
    equal(policy.resolveEditorType({ common: { type: 'mixed' } }, { a: 1 }), 'json', 'mixed object editor');
    equal(policy.resolveEditorType({ common: { type: 'number', states: { 0: 'Off', 1: 'On' } } }, 0), 'states', 'states editor');

    // Scalar and structured value coercion.
    equal(policy.coerceWriteValue({ common: { write: true, type: 'number', min: 0, max: 100 } }, '23,5', 'number', 'number', 0), 23.5, 'decimal comma conversion');
    equal(policy.coerceWriteValue({ common: { write: true, type: 'boolean' } }, 'false', 'boolean', 'boolean', true), false, 'boolean conversion');
    equal(policy.coerceWriteValue({ common: { write: true, type: 'number', states: { 0: 'Off', 1: 'On' } } }, '1', 'states', 'number', 0), 1, 'typed enum conversion');
    equal(policy.coerceWriteValue({ common: { write: true, type: 'object' } }, '{"a":1}', 'json', 'object', null), '{"a":1}', 'object JSON scalar conversion');
    equal(policy.coerceWriteValue({ common: { write: true, type: 'array' } }, '[1,2]', 'json', 'array', null), '[1,2]', 'array JSON scalar conversion');
    let invalidNumber = false;
    try { policy.coerceWriteValue({ common: { write: true, type: 'number' } }, 'not-a-number', 'number', 'number', 0); } catch { invalidNumber = true; }
    if (!invalidNumber) fail('invalid number was silently converted');

    // Type-correct direct controls.
    equal(policy.getDirectWriteValue('x', { common: { type: 'boolean' } }, { data: {} }, 'switch', false), true, 'boolean switch');
    equal(policy.getDirectWriteValue('x', { common: { type: 'number', min: 0, max: 100 } }, { data: {} }, 'switch', 0), 100, 'number switch max');
    equal(policy.getDirectWriteValue('x', { common: { type: 'number', states: { 0: 'Aus', 1: 'Ein' } } }, { data: {} }, 'switch', 0), 1, 'number states switch');
    equal(policy.getDirectWriteValue('x', { common: { type: 'string', states: { OFF: 'Aus', ON: 'Ein' } } }, { data: {} }, 'switch', 'OFF'), 'ON', 'string states switch');
    equal(policy.getDirectWriteValue('x', { common: { type: 'number', role: 'button' } }, { data: { button: true } }, 'button', 0), 1, 'number trigger');


    // Legacy and mixed metadata coverage.
    equal(policy.resolveEditorType({ common: { type: ['number', 'string'] } }, 12), 'number', 'multi-type current number editor');
    equal(policy.resolveEditorType({ common: { type: ['number', 'string'] } }, 'auto'), 'string', 'multi-type current string editor');
    equal(policy.resolveEditorType({ common: { type: 'number', states: '0:Aus;1:Ein' } }, 0), 'states', 'legacy string states editor');
    const emptyNumber = policy.prepareEditorValue({ common: { write: true, read: false, type: 'number' } }, null, null);
    if (emptyNumber.value !== '' || emptyNumber.valid !== false) fail('write-only number must require an explicit value');
    const emptyObject = policy.prepareEditorValue({ common: { write: true, read: false, type: 'object' } }, null, null);
    if (emptyObject.value !== '{}' || emptyObject.valid !== true) fail('write-only object editor initialization invalid');
    equal(policy.getDirectWriteValue('x', { common: { type: 'string' } }, { data: {} }, 'switch', 'OFF'), 'ON', 'string token switch casing');
    equal(policy.getDirectWriteValue('x', { common: { type: 'number', role: 'button', def: 42 } }, { data: { button: true } }, 'button', null), 42, 'button default command value');
    let unsupportedStructured = false;
    try { await policy.writeManualState({ setState: async () => undefined }, 'test.object', { a: 1 }); } catch { unsupportedStructured = true; }
    if (!unsupportedStructured) fail('non-scalar StateValue was accepted');

    // Writes are queued, never silently deduplicated/dropped.
    let calls = 0;
    const states = [];
    const socket = { setState: async (_id, value) => { calls++; states.push(value); await new Promise(resolve => setTimeout(resolve, 5)); } };
    const first = policy.writeManualState(socket, 'test.switch', true);
    const second = policy.writeManualState(socket, 'test.switch', false);
    if (first === second) fail('parallel writes must be queued, not deduplicated');
    await Promise.all([first, second]);
    if (calls !== 2) fail(`expected two queued socket writes, got ${calls}`);
    equal(states.map(s => s.val), [true, false], 'queued write order');
    if (states.some(s => s.ack !== false || s.q !== 0)) fail('manual write state envelope is invalid');

    console.log('[NexoWatt EOS manual write policy selftest] OK');
})().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
