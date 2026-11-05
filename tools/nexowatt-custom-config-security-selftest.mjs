import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as safety from '../src-admin/src/helpers/configExpressionSafety.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'src-admin/package.json'));
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let vendorRenders = 0; let i18nLoads = 0;
const JsonConfigComponent = () => { vendorRenders++; return React.createElement('span', null, 'static settings'); };
JsonConfigComponent.loadI18n = async () => { i18nLoads++; };
const Wrapper = props => React.createElement('div', null, props.children);
const mui = Object.fromEntries(['LinearProgress', 'Accordion', 'AccordionSummary', 'AccordionDetails', 'Typography', 'Paper', 'FormControlLabel', 'Checkbox'].map(name => [name, Wrapper]));
const source = readFileSync(resolve(root, 'src-admin/src/components/Object/ObjectCustomEditor.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
const exports = {};
new vm.Script(compiled.outputText).runInNewContext({
    exports, console, setTimeout, clearTimeout, window: { localStorage: { getItem: () => null, setItem() {} } },
    require: name => name === 'react' ? React : name === 'json5' ? require('json5') : name === '@mui/material' ? mui
        : name === '@iobroker/json-config' ? { JsonConfigComponent, ConfigGeneric: {} }
        : name === '@/helpers/configExpressionSafety' ? safety
        : name === '@/helpers/AdminUtils' ? { deepClone: structuredClone, fixAdminUI() {} }
        : new Proxy({}, { get: () => () => null }),
});
const Editor = exports.default;
const make = schema => {
    const editor = new Editor({ customsInstances: [], objectIDs: [], objects: {} });
    editor.jsonConfigs = {};
    editor.schemaErrors = new Map();
    editor.validationErrors = new Set();
    editor.refTemplate = { 'history.0': React.createRef() };
    editor.commonConfig = { 'history.0': { enabled: true } };
    editor.state = { newValues: {}, expanded: [], systemConfig: {} };
    editor.getFilteredObjectIDs = () => ['test.value'];
    editor.props = {
        objects: { 'system.adapter.history': { common: { adminUI: { custom: 'json' }, icon: 'history.png' } } },
        socket: { fileExists: async () => false, readFile: async () => ({ file: JSON.stringify(schema) }) },
        objectIDs: ['test.value'], t: text => text, onError: error => { editor.error = error; },
    };
    return editor;
};
const dangerous = make({ type: 'panel', items: { enabled: { type: 'checkbox', defaultFunc: 'globalThis.pwned=true; return true;' } } });
await dangerous.getCustomTemplate('history');
assert.equal(dangerous.jsonConfigs.history.disabled, true);
assert.equal(dangerous.jsonConfigs.history.json, undefined, 'rejected schema is not retained for vendor renderer');
const message = renderToStaticMarkup(dangerous.renderOneCustom('history.0', {}, {}, 0));
assert.match(message, /Executable custom settings are blocked/);
assert.equal(vendorRenders, 0, 'ConfigGeneric/JsonConfig is never mounted for rejected schema');
assert.equal(i18nLoads, 0, 'rejected schema cannot trigger vendor setup');
let saves = 0;
dangerous.state.newValues = { 'history.0': { enabled: true } };
dangerous.saveOneState = () => { saves++; };
dangerous.onSave();
assert.equal(saves, 0); assert.equal(dangerous.error, true);
for (const type of ['custom', 'selectSendTo']) {
    const editor = make({ type: 'panel', items: { x: { type, url: 'https://example.invalid/component.js', command: 'options' } } });
    let sideEffects = 0;
    editor.props.socket.sendTo = () => { sideEffects++; throw new Error('unexpected options request'); };
    await editor.getCustomTemplate('history');
    const blocked = renderToStaticMarkup(editor.renderOneCustom('history.0', {}, {}, 0));
    assert.match(blocked, /executable components or dynamic options are blocked/);
    assert.equal(vendorRenders, 0, `${type} never mounts the component/remote loader`);
    assert.equal(i18nLoads, 0);
    editor.state.newValues = { 'history.0': { enabled: true } };
    editor.saveOneState = () => { sideEffects++; };
    editor.onSave();
    assert.equal(sideEffects, 0, `${type} cannot request options or save values`);
    assert.equal(editor.error, true);
}
const staticEditor = make({ type: 'panel', items: { enabled: { type: 'checkbox', default: false }, retention: { type: 'number', default: 7 } } });
for (const item of [
    { type: 'staticText', format: 'html', text: '<img src=x onerror=alert(1)>' },
    { type: 'staticInfo', html: true, data: '<img src=x onerror=alert(1)>' },
    { type: 'textSendTo', container: 'html', command: 'html' },
    { type: 'state', control: 'html', oid: 'test.value' },
]) {
    const editor = make({ items: { x: item } });
    await editor.getCustomTemplate('history');
    const blocked = renderToStaticMarkup(editor.renderOneCustom('history.0', {}, {}, 0));
    assert.match(blocked, /active HTML are blocked/);
    assert.doesNotMatch(blocked, /<img/);
    assert.equal(vendorRenders, 0, `${item.type} never mounts its raw-HTML renderer`);
    assert.equal(i18nLoads, 0);
    editor.state.newValues = { 'history.0': { enabled: true } };
    editor.saveOneState = () => { throw new Error('unexpected HTML-card save'); };
    editor.onSave();
    assert.equal(editor.error, true);
}
await staticEditor.getCustomTemplate('history');
assert.equal(staticEditor.schemaErrors.size, 0);
assert.equal(i18nLoads, 1);
const html = renderToStaticMarkup(staticEditor.renderOneCustom('history.0', {}, {}, 0));
assert.match(html, /static settings/);
assert.equal(vendorRenders, 1, 'static schema still renders normally');
const preservation = make({ items: { x: { type: 'custom', url: 'https://example.invalid/component.js' } } });
await preservation.getCustomTemplate('history');
const stored = { _id: 'test.value', type: 'state', common: { custom: {
    'history.0': { enabled: false, retention: 365, preserved: 'existing value' },
    'other.0': { enabled: true, retention: 7 },
} } };
const preserved = structuredClone(stored.common.custom['history.0']);
preservation.state.newValues = { 'other.0': { enabled: true, retention: 14 } };
preservation.commonConfig = { 'other.0': { enabled: true, retention: 7 } };
preservation.setState = (next, cb) => { Object.assign(preservation.state, next); cb?.(); };
preservation.getStatesFilterFunction = () => () => true;
preservation.getObject = async (objects, originals, id) => {
    objects[id] = stored; originals[id] = structuredClone(stored); return stored;
};
let writes = 0;
preservation.props.onProgress = () => {};
preservation.props.socket.getObject = async () => stored;
preservation.props.socket.setObject = async () => { writes++; };
await new Promise(resolve => preservation.saveOneState(['test.value'], resolve));
assert.equal(writes, 1, 'an independent supported card can still be saved');
assert.deepEqual(stored.common.custom['history.0'], preserved, 'blocked existing values are not pruned while another card is saved');
assert.equal(stored.common.custom['other.0'].retention, 14);
assert.doesNotMatch(source, /new Function|_executeCustom/);
console.log('PASS Custom configuration integration (rejected schema never mounts vendor, save blocked, static forms retained)');
