#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src-admin/public/js/eos-manual-write-policy.js'), 'utf8');
const sandbox = { window: {}, globalThis: null, console, Map, Promise, Error, String, Object, Boolean, setTimeout, clearTimeout };
sandbox.globalThis = sandbox.window;
vm.runInNewContext(source, sandbox, { filename: 'eos-manual-write-policy.js' });
const policy = {
    getWriteBehavior: sandbox.window.NEXOWATT_EOS_GET_WRITE_BEHAVIOR,
    isExpertOnlyState: sandbox.window.NEXOWATT_EOS_IS_EXPERT_ONLY_STATE,
    toBoolean: sandbox.window.NEXOWATT_EOS_COERCE_BOOLEAN,
    writeManualState: sandbox.window.NEXOWATT_EOS_WRITE_MANUAL_STATE,
};
const fail = message => { throw new Error(`[NexoWatt EOS manual write policy selftest] ${message}`); };

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

    let calls = 0;
    let lastState;
    const socket = { setState: async (_id, value) => { calls++; lastState = value; await new Promise(resolve => setTimeout(resolve, 5)); } };
    const first = policy.writeManualState(socket, 'test.switch', true);
    const second = policy.writeManualState(socket, 'test.switch', false);
    if (first !== second) fail('parallel writes for the same state were not deduplicated');
    await first;
    if (calls !== 1) fail(`expected one socket write, got ${calls}`);
    if (!lastState || lastState.val !== true || lastState.ack !== false || lastState.q !== 0) fail('manual write state envelope is invalid');

    console.log('[NexoWatt EOS manual write policy selftest] OK');
})().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
