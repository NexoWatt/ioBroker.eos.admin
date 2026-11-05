#!/usr/bin/env node
'use strict';
const { readModuleChunks, verifyFrontendManifest } = require('./nexowatt-frontend-artifacts.cjs');
verifyFrontendManifest();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));
const runtimeEntry = json('NEXOWATT_EOS_BUILD_INFO.json').runtimeEntry;

const index = read('adminWww/index.html');
const sourceIndex = read('src-admin/index.html');
const bootstrap = read('adminWww/js/eos-role-bootstrap.js');
const roleUi = read('adminWww/js/eos-role-ui.js');
const sourceRoleUi = read('src-admin/public/js/eos-role-ui.js');
const sourceMain = read('src/main.ts');
const builtMain = read('build/main.js');
const webSource = read('src/lib/web.ts');
const webBuilt = read('build/lib/web.js');
const appSource = read('src-admin/src/App.tsx');
const objectsSource = read('src-admin/src/tabs/Objects.tsx');
const introSource = read('src-admin/src/tabs/Intro.tsx');
const drawerSource = read('src-admin/src/components/Drawer.tsx');
const bootstrapBundle = readModuleChunks('src/bootstrap.tsx');
const objectsBundle = readModuleChunks('src/tabs/Objects.tsx');
const introBundle = readModuleChunks('src/tabs/Intro.tsx');
const io = json('io-package.json');
const cleanupSource = read('tools/nexowatt-clean-legacy-runtime.cjs');

// The removed DOM-text heuristic classified a real administrator as end user when the
// visible header happened to contain "user". Only authenticated backend policy may define the role.
for (const html of [index, sourceIndex]) {
    assert.doesNotMatch(html, /nexowatt-role-security\.js/i, 'legacy heuristic role guard is still loaded');
    assert.match(html, /eos-role-bootstrap\.js\?v=7109/, 'authoritative role bootstrap cache tag is missing');
    assert.match(html, /eos-policy-client\.js\?v=7109/, 'authoritative policy client cache tag is missing');
    assert.match(html, /eos-role-ui\.js\?v=7109/, 'authoritative role UI cache tag is missing');
}
assert.equal(fs.existsSync(path.join(root, 'adminWww/nexowatt-role-security.js')), false, 'legacy runtime still exists');
assert.equal(fs.existsSync(path.join(root, 'build/lib/eosRoleSecurity.js')), false, 'legacy backend heuristic still exists');
assert.doesNotMatch(builtMain, /eosRoleSecurity|installHttpGuard|enforceRoleAcls/);
for (const obsolete of [
    'adminWww/nexowatt-role-security.js',
    'src-admin/nexowatt-role-security.js',
    'build/lib/eosRoleSecurity.js',
]) {
    assert.ok(cleanupSource.includes(`'${obsolete}'`), `runtime cleanup must remove stale ${obsolete}`);
}
for (const code of [bootstrap, roleUi, sourceRoleUi]) {
    assert.match(code, /policy\?\.user === 'system\.user\.admin'/, 'system.user.admin is not explicitly authoritative');
    assert.match(code, /policy\?\.isAdministrator/, 'backend administrator capability is not honored');
}

// Admin is the unconditional full-rights bypass. Restrictions below this branch must never run for Admin.
for (const code of [sourceMain, builtMain]) {
    const bypass = code.indexOf("if (role === 'admin')");
    const endUserWriteDeny = code.indexOf('end-user datapoints are read-only in EOS Admin');
    assert.ok(bypass >= 0 && endUserWriteDeny > bypass, 'Admin socket bypass must precede all restricted-role rules');
    assert.match(code, /password administration is Service-only/);
    assert.match(code, /\.info\.uiTabsVisible/);
}

// Expert mode is an Admin-only control, but the administrator can freely toggle both directions.
assert.match(appSource, /const isEosAdministrator = \(\): boolean => \['admin', 'service'\]\.includes/);
assert.match(appSource, /isEosAdministrator\(\) &&/, 'expert mode must remain role-gated');
assert.match(appSource, /data-eos-expert-control="1"/);
assert.match(appSource, /this\.setState\(\{ expertMode: !this\.state\.expertMode \}\)/);
assert.match(bootstrapBundle, /["'`]data-eos-expert-control["'`]:["'`]1["'`]/);
for (const marker of ['NEXOWATT_EOS_ACCESS_ROLE', 'admin.appBar.expertMode', 'expertMode:!this.state.expertMode']) assert.ok(bootstrapBundle.includes(marker), `expert-mode runtime missing ${marker}`);
assert.match(roleUi, /if \(state\.role === 'admin'\) return false;/, 'Admin expert-mode cleanup must be a no-op');
assert.match(roleUi, /if \(state\.role === 'admin' \|\| state\.role === 'unknown'\) return;/, 'Admin click handling must not be intercepted');

// Datapoints: Admin/Installer retain native write support; only End User is read-only.
assert.match(objectsSource, /const readOnly = !\['admin', 'service', 'installer'\]\.includes\(eosRole\)/, 'unknown and end-user roles must remain read-only');
for (const marker of [
    'notEditable={readOnly}',
    'objectEditBoolean={!readOnly}',
    'objectAddBoolean={!readOnly}',
    'objectImportExport={!readOnly}',
    'objectEditOfAccessControl={!readOnly}',
]) assert.ok(objectsSource.includes(marker), `Objects source missing ${marker}`);
for (const marker of ['NEXOWATT_EOS_ACCESS_ROLE', 'admin', 'service', 'installer', 'notEditable:', 'objectEditBoolean:', 'objectAddBoolean:', 'objectImportExport:', 'objectEditOfAccessControl:']) assert.ok(objectsBundle.includes(marker), `Objects runtime missing ${marker}`);
assert.match(bootstrap, /route === 'tab-objects'/, 'End User datapoint route is not released');
assert.match(roleUi, /clean === 'tab-objects'/, 'End User datapoint route is not released in runtime UI policy');

// The Admin and XTerm cards stay visible for Admin and are removed only for non-admin roles.
assert.match(introSource, /if \(!isAdministrator && \/\^\(\?:admin\|xterm\)/);
assert.match(introSource, /forceVisibleAdminCard = isAdministrator/);
assert.match(introBundle, /NEXOWATT_EOS_ACCESS_ROLE/);
assert.match(introBundle, /\^\(\?:admin\|xterm/);
assert.doesNotMatch(introSource, /NEXOWATT_EOS_ACCESS_ROLE \|\| 'admin'/, 'Intro source must fail closed while role is unresolved');
assert.doesNotMatch(introBundle, /NEXOWATT_EOS_ACCESS_ROLE\|\|["'`]admin["'`]/, 'Intro runtime must fail closed while role is unresolved');

// Installer receives EMS App-Center access only. Simulation and License remain Admin-only;
// End User remains blocked from all three actions and from inherited port-8188 sessions.
for (const token of ['app center', 'app-center', 'appcenter', 'simulation', 'simulator', 'lizenz', 'license']) {
    assert.ok(roleUi.toLowerCase().includes(token), `role UI is missing protected action ${token}`);
}
for (const code of [roleUi, sourceRoleUi]) {
    assert.match(code, /const privilegedActionKind = element =>/, 'privileged actions are not separated by capability');
    assert.match(code, /if \(action === 'ems'\)/, 'EMS action branch is missing');
    assert.match(code, /state\.role === 'installer' && state\.policy\?\.capabilities\?\.emsAppCenter !== false/, 'Installer EMS App-Center allowance is missing');
    assert.match(code, /return state\.role === 'admin';/, 'Simulation and License must remain Admin-only');
    assert.match(code, /if \(state\.role !== 'enduser'\) return;/, 'port 8188 session scrubbing must be End User-only');
}
for (const code of [webSource, webBuilt]) {
    assert.match(code, /emsAppCenter: technical/, 'backend role capabilities do not grant Installer EMS access');
    assert.match(code, /simulation: role === 'admin'/, 'Simulation capability must remain Admin-only');
    assert.match(code, /licenseAdministration: role === 'admin'/, 'License capability must remain Admin-only');
}
assert.match(roleUi, /applyPrivilegedIframePolicy/);
assert.match(roleUi, /:8188\/logout\?/);
assert.match(roleUi, /route !== 'tab-users'/);
assert.match(bootstrap, /tab-users\|tab-hosts\|tab-files/);

// Pencil/menu edits must not touch system.config (which restarts the running adapter).
const drawerMethod = drawerSource.slice(
    drawerSource.indexOf('tabsEditSystemConfig = async'),
    drawerSource.indexOf('getNavigationItems()'),
);
assert.match(drawerSource, /info\.uiTabsVisible/);
assert.match(drawerMethod, /socket\.setState/);
assert.doesNotMatch(drawerMethod, /setSystemConfig|getSystemConfig\(/);
const drawerStart = bootstrapBundle.indexOf('tabsEditSystemConfig');
const builtDrawer = bootstrapBundle; // Source-bound method can be emitted as a class-field initializer in Rolldown.
assert.ok(drawerStart >= 0, 'compiled Drawer tab method missing');
assert.match(builtDrawer, /info\.uiTabsVisible/);
assert.match(builtDrawer, /socket\.setState/);
// The source-bound navigation writer above is checked independently from other legitimate system-setting controls.
assert.ok((io.instanceObjects || []).some(object => object?._id === 'info.uiTabsVisible'), 'navigation state object missing');

// Backup navigation is emitted only for an actually enabled instance.
assert.match(drawerSource, /backupAdapters\.has\(adapterName\) && instance\.enabled !== true/);
assert.match(builtDrawer, /\.enabled!==!0/, 'disabled backup instance filter missing from runtime');

// 7.10.9 End User cleanup: system information is read-only and object actions disappear only for End User.
for (const code of [webSource, webBuilt]) {
    assert.match(code, /nexowatt\/readonly\/system-info/, 'authenticated read-only system-info route is missing');
    assert.match(code, /authenticationRequired/, 'read-only system-info route must require an authenticated session');
    assert.match(code, /readSystemInfo/, 'bounded cached system-info helper is not used');
}
for (const code of [roleUi, sourceRoleUi]) {
    assert.match(code, /state\.role !== 'enduser' \|\| currentRoute\(\) !== 'tab-intro'/, 'system-info hydration is not End User-only');
    assert.match(code, /data-eos-enduser-action-hidden/, 'End User object action hiding marker is missing');
    assert.match(code, /svg\[data-testid\*="Edit"\]/, 'Edit icon fallback selector is missing');
    assert.match(code, /svg\[data-testid\*="Settings"\]/, 'Settings icon fallback selector is missing');
    assert.match(code, /svg\[data-testid\*="Delete"\]/, 'Delete icon fallback selector is missing');
    assert.match(code, /state\.role !== 'admin'/, 'Admin restriction guard is missing');
}
assert.match(sourceMain, /role === 'enduser' && \['readLogs', 'sendToHost'\]\.includes\(command\)/, 'End User technical diagnostics must remain denied');

console.log('[NexoWatt EOS role security] OK (Admin full rights, Installer EMS App-Center access, End User read-only datapoints, protected Admin tools)');
