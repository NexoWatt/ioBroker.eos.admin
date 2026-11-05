'use strict';
// Exercise the shipped TSX save method. Controller I/O is a synthetic boundary;
// this verifies error propagation, not transactionality of several DB writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src-admin/src/components/SystemSettings/index.tsx');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'SystemSettingsDialog');
assert.ok(declaration);
const save = declaration.members.find(node => node.name?.getText(source) === 'onSave');
assert.ok(save);
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function fixture(failure) {
    const alerts = [];
    const closes = [];
    const writes = [];
    const encryptions = [];
    let updates = 0;
    class Component {
        setState(update, callback) {
            this.state = { ...this.state, ...update };
            if (callback) this.finished = Promise.resolve().then(callback);
        }
    }
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(`class SaveDialog extends Component { ${save.getText(source)} }\nmodule.exports = SaveDialog;`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
        module, Component, SOME_PASSWORD: '__SOME_PASSWORD__', CHAT_SETTINGS_OBJECT_ID: 'synthetic.ai',
        AdminUtils: { clone }, alert: text => alerts.push(text),
        window: { alert: text => alerts.push(text), location: { reload() { throw new Error('Unexpected reload'); } } },
    }, { timeout: 1000 });
    const instance = new module.exports();
    const config = { _id: 'system.config', common: { siteName: 'Existing customer', expertMode: false, language: 'de', activeRepo: [] } };
    instance.state = {
        systemConfig: clone(config), systemCertificates: { native: {} }, systemCredentials: [],
        systemRepositories: { native: { repositories: {} } },
        systemLicenses: { native: { login: 'new-test-login', password: 'synthetic-new-password' } },
        saveError: false, saving: false,
    };
    instance.originalConfig = JSON.stringify(config);
    instance.originalCredentials = '[]';
    instance.originalCredentialObjects = {};
    instance.props = {
        t: text => text,
        onClose: value => closes.push(value),
        expertModeFunc() { throw new Error('Unexpected expert-mode change'); },
        socket: {
            async getSystemConfig() { return clone(config); },
            async setSystemConfig() { throw new Error('Unexpected system config overwrite'); },
            async getObject(id) {
                if (id === 'system.repositories') return { native: { repositories: {} } };
                if (id === 'system.licenses') return { native: { login: 'old-test-login', password: 'synthetic-encrypted-old', licenses: [] } };
                throw new Error('Unexpected object read');
            },
            async encrypt(value) {
                encryptions.push(value);
                if (failure === 'encrypt') throw new Error('Synthetic encryption failure');
                return 'synthetic-encrypted-new';
            },
            async setObject(id, object) {
                if (id === 'system.licenses' && failure === 'write') throw new Error('Synthetic write failure');
                writes.push({ id, object: clone(object) });
            },
            async updateLicenses() {
                updates++;
                if (failure === 'update') throw new Error('Synthetic refresh failure');
            },
        },
    };
    return { instance, alerts, closes, writes, encryptions, updates: () => updates };
}

for (const failure of ['encrypt', 'write', 'update']) {
    test(`System save keeps edits open and reports failure after ${failure} rejection`, async () => {
        const f = fixture(failure);
        f.instance.onSave();
        await f.instance.finished;
        assert.equal(f.instance.state.saving, false);
        assert.equal(f.instance.state.saveError, true);
        assert.equal(f.closes.length, 0);
        assert.ok(!f.alerts.includes('Settings saved'));
        assert.equal(f.instance.state.systemLicenses.native.login, 'new-test-login');
        if (failure === 'encrypt') {
            assert.equal(f.writes.some(write => write.id === 'system.licenses'), false);
            assert.equal(f.updates(), 0);
        }
    });
}

test('System save confirms only after encrypted license credential write and refresh complete', async () => {
    const f = fixture();
    f.instance.onSave();
    await f.instance.finished;
    assert.equal(f.instance.state.saving, false);
    assert.equal(f.instance.state.saveError, false);
    assert.deepEqual(f.alerts, ['Settings saved']);
    assert.equal(f.closes.length, 1);
    assert.equal(f.updates(), 1);
    const write = f.writes.find(item => item.id === 'system.licenses');
    assert.equal(write.object.native.password, 'synthetic-encrypted-new');
    assert.notEqual(write.object.native.password, f.instance.state.systemLicenses.native.password);
});
