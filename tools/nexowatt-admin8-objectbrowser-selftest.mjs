/** Actual source behavior tests. VM execution is restricted to this checked-in UI source in this test process. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as guards from '../src-admin/src/components/Object/eosObjectBrowserWrite.ts';
import sourcePlugin, {
    manifest,
    transformObjectBrowser,
} from '../src-admin/build-tools/eos-object-browser-transform.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = resolve(root, 'tools/fixtures/admin8-objectbrowser');
const provenance = JSON.parse(readFileSync(resolve(fixtureRoot, 'provenance.json'), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
assert.equal(provenance.schemaVersion, 1);
assert.equal(provenance.guiVersion, manifest.version);
assert.equal(
    sha256(readFileSync(resolve(root, provenance.dialogSource))),
    provenance.dialogSourceSha256,
    'dialog fixture source is stale',
);
for (const [file, hash] of Object.entries(provenance.files)) {
    assert.match(file, /^[A-Za-z0-9.-]+$/, 'fixture filename');
    assert.equal(sha256(readFileSync(resolve(fixtureRoot, file))), hash, `fixture integrity: ${file}`);
}
for (const patch of manifest.patches)
    assert.equal(provenance.files[patch.file], patch.sha256, 'fixture must be the reviewed upstream input');
const policyModule = { exports: {} };
vm.runInNewContext(readFileSync(resolve(root, 'src-admin/public/js/eos-manual-write-policy.js'), 'utf8'), {
    module: policyModule,
    setTimeout,
    clearTimeout,
    get window() {
        return globalThis.window;
    },
});
const policy = policyModule.exports;
const alerts = [];
const openedUrls = [];
globalThis.Element = class Element {
    closest() {
        return null;
    }
};
globalThis.window = {
    NEXOWATT_EOS_MANUAL_WRITE_POLICY: policy,
    NEXOWATT_EOS_ACCESS_ROLE: 'admin',
    innerHeight: 900,
    localStorage: { getItem: () => null, setItem: () => undefined },
    location: { href: 'https://eos.example/admin/', assign: url => openedUrls.push(url) },
    open: (...args) => openedUrls.push(args),
    alert: message => alerts.push(message),
};
let assertions = 0;
const check = (actual, expected, message) => {
    assert.deepEqual(structuredClone(actual), expected, message);
    assertions++;
};
const stateObject = (common = {}) => ({
    _id: 'test.value',
    type: 'state',
    common: { type: 'boolean', role: 'switch', write: true, ...common },
    native: {},
});
const makeBrowser = (object = stateObject()) => {
    const calls = [];
    const item = { data: { id: object._id, obj: object, switch: object.common.role === 'switch' } };
    const browser = {
        props: {
            socket: {
                getState: async () => ({ val: false }),
                setState: async (id, value) => {
                    calls.push({ id, value });
                },
            },
            notEditable: false,
        },
        objects: { [object._id]: object },
        states: { [object._id]: { val: false, ack: true, ts: 1, lc: 1 } },
        state: { filter: { expertMode: false }, updateOpened: false },
        root: item,
        edit: { id: object._id },
        setState(update) {
            Object.assign(this.state, update);
        },
        forceUpdate() {
            this.updated = true;
        },
        showError(message) {
            alerts.push(message);
        },
    };
    return { browser, item, calls, id: object._id };
};
const event = () => ({
    target: new Element(),
    ctrlKey: false,
    preventDefault() {
        this.prevented = true;
    },
    stopPropagation() {
        this.stopped = true;
    },
});

// Fail closed if the policy script, object writability or editing capability is unavailable.
{
    const { browser, item, id, calls } = makeBrowser();
    delete window.NEXOWATT_EOS_MANUAL_WRITE_POLICY;
    check(guards.eosWriteBehavior(browser, id, item), 'readonly', 'missing policy fails closed');
    await guards.eosValueCellProps(browser, id, item).onClick(event());
    check(calls.length, 0, 'missing policy cannot write');
    window.NEXOWATT_EOS_MANUAL_WRITE_POLICY = policy;
    browser.objects[id].common.write = false;
    browser.state.filter.expertMode = true;
    check(guards.eosCanEditValue(browser, id, item), false, 'expert mode never bypasses common.write=false');
    browser.objects[id].common.write = true;
    browser.props.notEditable = true;
    check(guards.eosCanEditValue(browser, id, item), false, 'picker/read-only browser cannot write');
}
{
    const { browser, item, id, calls } = makeBrowser(stateObject({ role: 'level.power' }));
    check(guards.eosWriteBehavior(browser, id, item), 'expert-only', 'dangerous values require expert mode');
    browser.state.filter.expertMode = true;
    window.NEXOWATT_EOS_ACCESS_ROLE = 'installer';
    check(guards.eosCanEditValue(browser, id, item), false, 'installer cannot simulate admin expert mode');
    window.NEXOWATT_EOS_ACCESS_ROLE = 'admin';
    check(guards.eosCanEditValue(browser, id, item), true, 'admin expert retains permitted functionality');
    browser.objects[id].type = 'channel';
    check(guards.eosCanEditValue(browser, id, item), false, 'channel never writes state');
    check(calls.length, 0, 'guard checks are side-effect-free');
}
{
    const { browser, item, id, calls } = makeBrowser();
    browser.states[id].val = true; // deliberately stale
    const props = guards.eosValueCellProps(browser, id, item);
    check(props['data-eos-object-direct-control'], '1', 'direct-control marker');
    const mouse = event();
    props.onMouseDown(mouse);
    check(mouse.prevented, undefined, 'mousedown does not suppress the only click');
    await props.onClick(event());
    check(
        calls,
        [{ id, value: { val: true, ack: false, q: 0 } }],
        'fresh socket value is toggled once with command semantics',
    );
    check(browser.states[id].val, true, 'confirmed write updates local cache');
    check(browser.updated, true, 'Admin8 row cache is invalidated');
    let clicks = 0;
    const key = {
        ...event(),
        key: 'Enter',
        currentTarget: {
            click() {
                clicks++;
            },
        },
    };
    props.onKeyDown(key);
    check(clicks, 1, 'keyboard routes through exactly one click handler');
    const copy = event();
    copy.target.closest = () => true;
    await props.onClick(copy);
    check(calls.length, 1, 'copy button never writes');
}
{
    const object = stateObject({ type: 'number', role: 'switch', states: { 2: 'Off', 3: 'On' } });
    check(guards.eosSwitchChecked(object, 2), false, 'numeric enum off renders off');
    check(guards.eosSwitchChecked(object, '3'), true, 'numeric enum on renders on');
    check(guards.eosSwitchChecked(stateObject(), 'false'), false, 'string false is not truthy checked');
    const { browser, item, id, calls } = makeBrowser(object);
    browser.props.socket.getState = async () => ({ val: 3 });
    await guards.eosValueCellProps(browser, id, item).onClick(event());
    check(calls[0].value.val, 2, 'typed binary enum preserves numeric values');
}
{
    const { browser, item, id, calls } = makeBrowser(stateObject({ type: 'number', role: 'button', def: 0 }));
    await guards.eosValueCellProps(browser, id, item).onClick(event());
    check(calls[0].value.val, 1, 'idle default does not suppress button trigger');
    check(browser.states[id].val, false, 'button does not fabricate latched visual state');
}
{
    const { browser, item, id, calls } = makeBrowser();
    let finishRead;
    browser.props.socket.getState = () =>
        new Promise(resolve => {
            finishRead = resolve;
        });
    const writing = guards.eosValueCellProps(browser, id, item).onClick(event());
    browser.props.notEditable = true;
    finishRead({ val: false });
    await writing;
    check(calls.length, 0, 'permission is rechecked after asynchronous state read');
}
{
    const { browser, item, id } = makeBrowser(stateObject({ type: 'string', role: 'text', def: 'initial' }));
    delete browser.states[id];
    guards.eosOpenValue(browser, id, item);
    check(browser.edit.val, 'initial', 'write-only/unset state can open with default');
    check(browser.state.updateOpened, true, 'dialog opens');
    browser.props.socket.setState = async () => {
        throw new Error('denied');
    };
    await assert.rejects(guards.eosUpdateValue(browser, { val: 'new', ack: false }), /denied/);
    assertions++;
    check(browser.states[id], undefined, 'failed write never fabricates state success');
}
{
    const { browser, item, id } = makeBrowser(stateObject({ type: 'string', role: 'url' }));
    item.data.url = true;
    browser.states[id].val = 'javascript:alert(1)';
    await guards.eosValueCellProps(browser, id, item).onClick({ ...event(), ctrlKey: true });
    check(openedUrls.length, 0, 'state URLs cannot execute javascript');
    browser.states[id].val = 'https://example.com/';
    await guards.eosValueCellProps(browser, id, item).onClick({ ...event(), ctrlKey: true });
    check(openedUrls[0], ['https://example.com/', '_blank', 'noopener,noreferrer'], 'web links sever opener access');
}

check(
    guards.eosEditorStates(stateObject({ states: '2:Off;3:On' }), null),
    { 2: 'Off', 3: 'On' },
    'legacy enumeration labels survive upstream empty-state conversion',
);

// Run compiled real dialog methods with source hash verification and deterministic state updates.
// The build gate additionally checks fresh TypeScript compilation; no React/compiler installation is needed here.
const compiledDialog = readFileSync(resolve(fixtureRoot, 'ObjectBrowserValue.test.cjs'), 'utf8');
const exports = {};
new vm.Script(compiledDialog, { filename: 'ObjectBrowserValue.tsx.test.js' }).runInNewContext({
    exports,
    window,
    console,
    setTimeout,
    clearTimeout,
    require: name =>
        name === 'react'
            ? {
                  Component: class Component {
                      constructor(props) {
                          this.props = props;
                      }
                  },
                  createRef: () => ({ current: null }),
              }
            : name === './eosObjectBrowserWrite'
              ? guards
              : {},
});
const Dialog = exports.default;
const makeDialog = (object, onClose) => {
    const dialog = new Dialog({ object, value: '', states: null, type: object.common.type, expertMode: true, onClose });
    dialog.setState = update => Object.assign(dialog.state, update);
    return dialog;
};
{
    let writes = 0;
    let finish;
    const dialog = makeDialog(stateObject({ type: 'number', role: 'value', min: 0, max: 10 }), async value => {
        writes++;
        check(value.val, 1.5, 'dialog parses comma-decimal');
        await new Promise(resolve => {
            finish = resolve;
        });
    });
    dialog.state.targetValue = '1,5';
    const first = dialog.onUpdate(event());
    await dialog.onUpdate(event());
    check(writes, 1, 'double click cannot submit while callback is pending');
    check(dialog.state.writing, true, 'pending state visible until callback resolves');
    finish();
    await first;
}
{
    let writes = 0;
    const dialog = makeDialog(stateObject({ type: 'number', role: 'value', min: 0, max: 10 }), async () => {
        writes++;
        throw new Error('write rejected');
    });
    dialog.state.targetValue = '11';
    await dialog.onUpdate();
    check(writes, 0, 'out-of-range number blocked inside update handler');
    dialog.state.targetValue = '5';
    await dialog.onUpdate();
    check(dialog.state.writing, false, 'rejection restores dialog for correction');
    dialog.state.jsonError = true;
    await dialog.onUpdate();
    check(writes, 1, 'invalid JSON flag also blocks keyboard update');
    check(Dialog.isNumberValid({ value: Infinity, common: {} }), false, 'Infinity is invalid');
}

// All four compiled upstream modules must match their reviewed source and be transformed.
const plugin = sourcePlugin();
const emitted = [];
assert.throws(() => plugin.generateBundle.call({ emitFile: item => emitted.push(item) }), /not bundled/);
assertions++;
for (const patch of manifest.patches) {
    const path = resolve(
        root,
        'src-admin/node_modules/@iobroker/gui-components/build/Components/ObjectBrowser',
        patch.file,
    );
    const source = readFileSync(resolve(fixtureRoot, patch.file), 'utf8');
    const output = plugin.transform(source, path);
    assert.ok(output?.code.includes('eosObjectBrowserWrite.ts'));
    assertions++;
    assert.throws(() => transformObjectBrowser(`${source}\n`, patch.file), /upstream drift/);
    assertions++;
    if (patch.file === 'dialogs.js') assert.ok(output.code.includes('await that.onUpdate(res)'));
    assertions++;
    if (patch.file === 'renderLeaf.js') assert.ok(output.code.includes("obj.type !== 'state'"));
    assertions++;
}
plugin.generateBundle.call({ emitFile: item => emitted.push(item) });
check(JSON.parse(emitted[0].source).files.length, 4, 'build receipt covers all guard modules');
console.log(`PASS Admin8 ObjectBrowser source guards (${assertions} assertions)`);
