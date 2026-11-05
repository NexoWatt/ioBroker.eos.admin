'use strict';
// Execute the actual TSX control methods. React element rendering and state are real;
// socket persistence/browser layout are separate integration tests, not simulated here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const requireUi = createRequire(path.resolve(__dirname, '../src-admin/package.json'));
const ts = requireUi('typescript');
const React = requireUi('react');
const root = path.resolve(__dirname, '..');
function actualMethods(file, className, names) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'),
        ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === className);
    assert.ok(declaration, `${className} exists`);
    return names.map(name => {
        const member = declaration.members.find(node => node.name?.getText(source) === name);
        assert.ok(member, `${className}.${name} exists`);
        return member.getText(source);
    }).join('\n');
}
const appMethods = actualMethods('src-admin/src/App.tsx', 'App', [
    'renderExpertModeButton', 'renderExpertDialog', 'getSystemSettingsDialog', 'onEosPolicyChanged',
]);
const drawerMethods = actualMethods('src-admin/src/components/Drawer.tsx', 'Drawer', ['renderSystemNavigation']);
function fixture(role = 'admin', permanent = false) {
    const values = new Map();
    const storage = { getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, value), removeItem: name => values.delete(name) };
    const window = { NEXOWATT_EOS_ACCESS_ROLE: role, sessionStorage: storage };
    const navigations = [];
    class CustomEvent extends Event { constructor(name, options) { super(name); this.detail = options.detail; } }
    class Base { setState(update) { this.state = { ...this.state, ...update }; } }
    class Router extends Base { static doNavigate(...args) { navigations.push(args); } }
    const componentNames = ['IsVisible', 'Tooltip', 'Badge', 'IconButton', 'IconExpert', 'ExpertModeDialog', 'SystemSettingsDialog', 'Box', 'DrawerItem', 'SystemSettingsIcon'];
    const components = Object.fromEntries(componentNames.map(name => [name, name]));
    const module = { exports: {} };
    const compiled = ts.transpileModule(`class App extends Router { ${appMethods} }\nclass Drawer extends Router { ${drawerMethods} }\nmodule.exports = {App, Drawer};`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
    });
    vm.runInNewContext(compiled.outputText, {
        React, module, Router, window, CustomEvent, Event, ...components,
        styles: {}, I18n: { t: text => text },
        isEosAdministrator: role => ['admin', 'service'].includes(role ?? window.NEXOWATT_EOS_ACCESS_ROLE),
    }, { timeout: 1000 });
    const { App, Drawer } = module.exports;
    const app = new App();
    app.props = { width: 'md' };
    app.adminGuiConfig = {};
    app.state = { eosAccessRole: role, expertMode: permanent, expertModeDialog: false, systemConfig: { common: { expertMode: permanent } }, theme: { palette: { expert: 'green' } }, currentTab: { dialog: 'system' } };
    app.refConfigIframe = { contentWindow: { postMessage() {} } };
    const drawer = new Drawer();
    let opened = 0;
    drawer.props = { eosAccessRole: role, theme: app.state.theme, adminGuiConfig: {}, t: text => text, onSystemSettings: () => opened++, expertModeControl: app.renderExpertModeButton() };
    const emitPolicy = policy => app.onEosPolicyChanged(new CustomEvent('nexowatt-eos-policy', { detail: { policy, kind: 'policy' } }));
    return { app, drawer, storage, window, emitPolicy, navigations, opened: () => opened };
}
function find(element, predicate) {
    if (!React.isValidElement(element)) return null;
    if (predicate(element)) return element;
    for (const child of React.Children.toArray(element.props.children)) {
        const found = find(child, predicate); if (found) return found;
    }
    return null;
}
const expert = app => find(app.renderExpertModeButton(), node => node.props['data-eos-expert-control'] === '1');

test('System and expert controls are rendered for administrative policy only', () => {
    for (const role of ['unknown', 'installer', 'enduser']) {
        const f = fixture(role);
        assert.equal(f.drawer.renderSystemNavigation(), null);
        assert.equal(f.app.renderExpertModeButton(), null);
        assert.equal(f.app.getSystemSettingsDialog(), null);
    }
    for (const role of ['admin', 'service']) {
        const f = fixture(role);
        const system = find(f.drawer.renderSystemNavigation(), element => element.props.tabName === 'tab-system');
        assert.ok(system); assert.equal(system.props.text, 'System');
        system.props.onClick(); assert.equal(f.opened(), 1);
        assert.ok(find(f.drawer.renderSystemNavigation(), element => element.props['data-eos-expert-control'] === '1'));
        assert.equal(f.app.getSystemSettingsDialog().props.eosAccessRole, role);
    }
});

test('expert mode keeps confirmation and toggles both directions within the browser session', () => {
    const f = fixture();
    assert.equal(expert(f.app).props['aria-pressed'], false);
    expert(f.app).props.onClick();
    assert.equal(f.app.state.expertModeDialog, true);
    assert.equal(f.app.state.expertMode, false);
    f.app.renderExpertDialog().props.onClose(true);
    assert.equal(f.app.state.expertMode, true);
    assert.equal(f.storage.getItem('App.expertMode'), 'true');
    assert.equal(expert(f.app).props['aria-pressed'], true);
    expert(f.app).props.onClick();
    assert.equal(f.app.state.expertMode, false);
    assert.equal(f.storage.getItem('App.expertMode'), 'false');
    assert.equal(f.app.state.systemConfig.common.expertMode, false, 'temporary toggle never changes the saved system default');
});

test('cancelling expert confirmation preserves mode; settings link opens native System dialog', () => {
    const f = fixture();
    expert(f.app).props.onClick();
    f.app.renderExpertDialog().props.onClose(false);
    assert.equal(f.app.state.expertMode, false);
    assert.equal(f.app.state.expertModeDialog, false);
    assert.equal(f.storage.getItem('App.expertMode'), null);
    expert(f.app).props.onClick();
    f.app.renderExpertDialog().props.onClose('openSettings');
    assert.deepEqual(Array.from(f.navigations[0]), [null, 'system']);
});

test('saved expert default and suppressed confirmation still allow disabling and reenabling', () => {
    const f = fixture('admin', true);
    f.storage.setItem('App.doNotShowExpertDialog', 'true');
    expert(f.app).props.onClick();
    assert.equal(f.app.state.expertMode, false);
    expert(f.app).props.onClick();
    assert.equal(f.app.state.expertMode, true);
    assert.equal(f.app.state.systemConfig.common.expertMode, true);
});

test('policy arriving after launch updates React controls and restores session preference', () => {
    const f = fixture('unknown');
    f.storage.setItem('App.expertMode', 'true');
    f.emitPolicy({ authenticated: true, role: 'admin', mustChangePassword: false });
    assert.equal(f.app.state.eosAccessRole, 'admin');
    assert.equal(f.app.state.expertMode, true);
    assert.ok(expert(f.app));
    assert.ok(f.app.getSystemSettingsDialog());
});

test('revoked, unresolved and first-login policies cannot retain expert or system controls', () => {
    for (const policy of [
        { authenticated: true, role: 'installer' },
        { authenticated: true, role: 'enduser' },
        { authenticated: false, role: 'admin' },
        { authenticated: true, role: 'admin', mustChangePassword: true },
        { authenticated: true, role: 'ADMIN' },
        null,
    ]) {
        const f = fixture('admin', true);
        f.app.state.expertModeDialog = true;
        f.emitPolicy(policy);
        assert.equal(f.app.state.expertMode, false);
        assert.equal(f.app.state.expertModeDialog, false);
        assert.equal(expert(f.app), null);
        assert.equal(f.app.getSystemSettingsDialog(), null);
    }
});

// The legacy public role subscriber also mirrors a role into window after this
// event. React must continue using its validated authenticated policy state.
test('a later legacy global role write cannot restore revoked React controls or an old click handler', () => {
    const f = fixture('admin');
    const oldButton = expert(f.app);
    oldButton.props.onClick();
    const oldDialog = f.app.renderExpertDialog();
    f.emitPolicy({ authenticated: false, role: 'admin' });
    f.window.NEXOWATT_EOS_ACCESS_ROLE = 'admin';
    assert.equal(f.app.state.eosAccessRole, 'unknown');
    assert.equal(f.app.renderExpertModeButton(), null);
    assert.equal(f.app.getSystemSettingsDialog(), null);
    assert.equal(f.app.renderExpertDialog(), null);
    oldButton.props.onClick();
    assert.equal(f.app.state.expertModeDialog, false);
    oldDialog.props.onClose(true);
    assert.equal(f.app.state.expertMode, false);
    assert.equal(f.storage.getItem('App.expertMode'), null);
});
