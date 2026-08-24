#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { NexoWattStableUpdateManager, isNexoWattRepositoryEntry } = require('../build/lib/eosAutoUpdate.js');

const copy = value => JSON.parse(JSON.stringify(value));

function createFixture() {
    const objects = new Map();
    const states = new Map();
    const objectWrites = [];
    const stateWrites = [];
    const refresh = [];

    objects.set('system.adapter.eos-admin.0', {
        _id: 'system.adapter.eos-admin.0',
        common: { name: 'eos-admin', version: '7.10.2' },
        native: {
            eosNexoWattAutoUpdate: true,
            eosNexoWattAutoUpdateState: {
                previousPolicies: {},
                lastSync: 1,
            },
        },
    });
    objects.set('system.config', {
        _id: 'system.config',
        common: {
            activeRepo: ['stable'],
            adapterAutoUpgrade: { repositories: { stable: false }, defaultPolicy: 'none' },
        },
        native: {},
    });
    objects.set('system.repositories', {
        _id: 'system.repositories',
        native: {
            repositories: {
                stable: {
                    json: {
                        'eos-admin': { name: 'eos-admin', version: '7.10.2', meta: 'https://github.com/NexoWatt/ioBroker.eos-admin' },
                        'nexowatt-ui': { name: 'nexowatt-ui', version: '0.8.202', publisher: 'NexoWatt' },
                        'nexowatt-beta': { name: 'nexowatt-beta', version: '1.0.0-beta.1', publisher: 'NexoWatt' },
                        admin: { name: 'admin', version: '7.7.0', publisher: 'ioBroker' },
                    },
                },
            },
        },
    });
    objects.set('system.adapter.eos-admin', {
        _id: 'system.adapter.eos-admin',
        common: { name: 'eos-admin', version: '7.10.2', automaticUpgrade: 'patch' },
        native: {},
    });
    objects.set('system.adapter.nexowatt-ui', {
        _id: 'system.adapter.nexowatt-ui',
        common: { name: 'nexowatt-ui', version: '0.8.202' },
        native: {},
    });
    objects.set('system.adapter.admin', {
        _id: 'system.adapter.admin',
        common: { name: 'admin', version: '7.7.0', automaticUpgrade: 'minor' },
        native: {},
    });

    const adapter = {
        namespace: 'eos-admin.0',
        host: 'eos-host',
        log: { debug() {}, info() {}, warn() {}, error() {} },
        getForeignObjectAsync: async id => copy(objects.get(id) || null),
        setForeignObjectAsync: async (id, object) => {
            objectWrites.push(id);
            objects.set(id, copy(object));
        },
        getObjectViewAsync: async () => ({
            rows: [...objects.entries()]
                .filter(([id]) => /^system\.adapter\.[^.]+$/.test(id))
                .map(([id, value]) => ({ id, value: copy(value) })),
        }),
        getStateAsync: async id => copy(states.get(id) || null),
        setStateAsync: async (id, value, ack) => {
            const state = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'val')
                ? { ...value }
                : { val: value, ack: Boolean(ack) };
            stateWrites.push(id);
            states.set(id, copy(state));
        },
        sendToHostAsync: async (...args) => { refresh.push(args); },
    };

    return { adapter, objects, states, objectWrites, stateWrites, refresh };
}

(async () => {
    assert.equal(isNexoWattRepositoryEntry('nexowatt-ui', { publisher: 'NexoWatt' }), true);
    assert.equal(isNexoWattRepositoryEntry('admin', { publisher: 'ioBroker' }), false);

    const fixture = createFixture();
    const manager = new NexoWattStableUpdateManager(fixture.adapter);

    const enabled = await manager.reconcile('test');
    assert.equal(enabled.enabled, true);
    assert.equal(enabled.repository, 'stable');
    assert.deepEqual(enabled.managedAdapters, ['eos-admin', 'nexowatt-ui']);
    assert.equal(fixture.objects.get('system.adapter.eos-admin').common.automaticUpgrade, 'major');
    assert.equal(fixture.objects.get('system.adapter.nexowatt-ui').common.automaticUpgrade, 'major');
    assert.equal(fixture.objects.get('system.adapter.admin').common.automaticUpgrade, 'minor');
    assert.equal(fixture.objects.get('system.config').common.adapterAutoUpgrade.repositories.stable, true);
    assert.equal(fixture.states.get('info.nexowattStableUpdatesEnabled').val, true);
    assert.ok(JSON.parse(fixture.states.get('info.nexowattStableUpdatesState').val).lastSync > 1);

    // Regression guard for 7.10.1: runtime status must never be persisted into
    // system.adapter.eos-admin.0.native, because that restarts the running adapter.
    assert.equal(fixture.objectWrites.includes('system.adapter.eos-admin.0'), false);

    // A second reconciliation may refresh state timestamps, but must not rewrite
    // unchanged adapter policies or system.config.
    const objectWriteCount = fixture.objectWrites.length;
    await manager.reconcile('repeat');
    assert.equal(fixture.objectWrites.length, objectWriteCount);

    // A manual user change while EOS management is active must not be overwritten on disable.
    fixture.objects.get('system.adapter.nexowatt-ui').common.automaticUpgrade = 'minor';
    const disabled = await manager.setEnabled(false);
    assert.equal(disabled.enabled, false);
    assert.equal(fixture.objects.get('system.adapter.eos-admin').common.automaticUpgrade, 'patch');
    assert.equal(fixture.objects.get('system.adapter.nexowatt-ui').common.automaticUpgrade, 'minor');
    assert.equal(fixture.objects.get('system.adapter.admin').common.automaticUpgrade, 'minor');
    assert.equal(fixture.objects.get('system.config').common.adapterAutoUpgrade.repositories.stable, false);
    assert.equal(fixture.states.get('info.nexowattStableUpdatesEnabled').val, false);
    assert.equal(fixture.objectWrites.includes('system.adapter.eos-admin.0'), false);
    manager.stop();

    // Startup must only schedule reconciliation. It must not modify repository or
    // adapter objects while the HTTP server is serving the first browser assets.
    const startupFixture = createFixture();
    const startupManager = new NexoWattStableUpdateManager(startupFixture.adapter);
    await startupManager.start();
    assert.deepEqual(startupFixture.objectWrites, []);
    startupManager.stop();

    console.log('[NexoWatt EOS auto update] OK (restart-safe state persistence, delayed startup, stable-only scope, third-party isolation and restore)');
})().catch(error => {
    console.error(error.stack || error);
    process.exit(1);
});
