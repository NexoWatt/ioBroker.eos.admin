#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));

const index = read('adminWww/index.html');
const sourceIndex = read('src-admin/index.html');
const bootstrap = read('adminWww/js/eos-role-bootstrap.js');
const roleUi = read('adminWww/js/eos-role-ui.js');
const sourceRoleUi = read('src-admin/public/js/eos-role-ui.js');
const sourceMain = read('src/main.ts');
const builtMain = read('build/main.js');
const appSource = read('src-admin/src/App.tsx');
const objectsSource = read('src-admin/src/tabs/Objects.tsx');
const introSource = read('src-admin/src/tabs/Intro.tsx');
const drawerSource = read('src-admin/src/components/Drawer.tsx');
const bootstrapBundle = read('adminWww/assets/bootstrap-COulQZax-v84.js');
const objectsBundle = read('adminWww/assets/Objects-DPan0bzw-v84.js');
const introBundle = read('adminWww/assets/Intro-DkwRiz1n-v84.js');
const io = json('io-package.json');

// The removed DOM-text heuristic classified a real administrator as end user when the
// visible header happened to contain "user". Only authenticated backend policy may define the role.
for (const html of [index, sourceIndex]) {
    assert.doesNotMatch(html, /nexowatt-role-security\.js/i, 'legacy heuristic role guard is still loaded');
    assert.match(html, /eos-role-bootstrap\.js\?v=7105/, 'authoritative role bootstrap cache tag is missing');
    assert.match(html, /eos-policy-client\.js\?v=7105/, 'authoritative policy client cache tag is missing');
    assert.match(html, /eos-role-ui\.js\?v=7105/, 'authoritative role UI cache tag is missing');
}
assert.equal(fs.existsSync(path.join(root, 'adminWww/nexowatt-role-security.js')), false, 'legacy runtime still exists');
assert.equal(fs.existsSync(path.join(root, 'build/lib/eosRoleSecurity.js')), false, 'legacy backend heuristic still exists');
assert.doesNotMatch(builtMain, /eosRoleSecurity|installHttpGuard|enforceRoleAcls/);
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
assert.match(appSource, /newState\.expertMode = isEosAdministrator\(\)/);
assert.match(appSource, /data-eos-expert-control="1"/);
assert.match(appSource, /this\.setState\(\{ expertMode: !this\.state\.expertMode \}\)/);
assert.match(bootstrapBundle, /"data-eos-expert-control":"1"/);
assert.match(bootstrapBundle, /l\.expertMode=\["admin","service"\]\.includes\(String\(window\.NEXOWATT_EOS_ACCESS_ROLE/);
assert.match(bootstrapBundle, /c\?jsxRuntimeExports\.jsx\(IsVisible,\{name:"admin\.appBar\.expertMode"/);
assert.match(bootstrapBundle, /:null,c&&this\.state\.expertMode\?jsxRuntimeExports\.jsx/);
assert.match(roleUi, /if \(state\.role === 'admin'\) return false;/, 'Admin expert-mode cleanup must be a no-op');
assert.match(roleUi, /if \(state\.role === 'admin' \|\| state\.role === 'unknown'\) return;/, 'Admin click handling must not be intercepted');

// Datapoints: Admin/Installer retain native write support; only End User is read-only.
assert.match(objectsSource, /const readOnly = eosRole === 'enduser'/);
for (const marker of [
    'enableStateValueEdit={!readOnly}',
    'objectEditBoolean={!readOnly}',
    'objectAddBoolean={!readOnly}',
    'objectImportExport={!readOnly}',
    'objectEditOfAccessControl={!readOnly}',
]) assert.ok(objectsSource.includes(marker), `Objects source missing ${marker}`);
assert.match(objectsBundle, /_eosReadOnly=_eosRole==="enduser"/);
for (const marker of [
    'enableStateValueEdit:!_eosReadOnly',
    'objectEditBoolean:!_eosReadOnly',
    'objectAddBoolean:!_eosReadOnly',
    'objectImportExport:!_eosReadOnly',
    'objectEditOfAccessControl:!_eosReadOnly',
]) assert.ok(objectsBundle.includes(marker), `Objects runtime missing ${marker}`);
assert.match(bootstrap, /route === 'tab-objects'/, 'End User datapoint route is not released');
assert.match(roleUi, /clean === 'tab-objects'/, 'End User datapoint route is not released in runtime UI policy');

// The Admin and XTerm cards stay visible for Admin and are removed only for non-admin roles.
assert.match(introSource, /if \(!isAdministrator && \/\^\(\?:admin\|xterm\)/);
assert.match(introSource, /forceVisibleAdminCard = isAdministrator/);
assert.match(introBundle, /if\(!_eosAdmin&&\/\^\(\?:admin\|xterm\)/);
assert.match(introBundle, /_forceAdmin=_eosAdmin/);
assert.doesNotMatch(introSource, /NEXOWATT_EOS_ACCESS_ROLE \|\| 'admin'/, 'Intro source must fail closed while role is unresolved');
assert.doesNotMatch(introBundle, /NEXOWATT_EOS_ACCESS_ROLE\|\|"admin"/, 'Intro runtime must fail closed while role is unresolved');

// App Center, License, Simulation and normal account administration are not available to Installer/End User.
for (const token of ['app center', 'app-center', 'appcenter', 'simulation', 'simulator', 'lizenz', 'license']) {
    assert.ok(roleUi.toLowerCase().includes(token), `role UI is missing protected action ${token}`);
}
assert.match(roleUi, /applyPrivilegedIframePolicy/);
assert.match(roleUi, /:8188\/logout\?/);
assert.match(roleUi, /route !== 'tab-users'/);
assert.match(bootstrap, /tab-users\|tab-hosts\|tab-files/);

// Pencil/menu edits must not touch system.config (which restarts the running adapter).
const drawerMethod = drawerSource.slice(
    drawerSource.indexOf('async getTabs(update?: boolean)'),
    drawerSource.indexOf('getNavigationItems(): JSX.Element[]'),
);
assert.match(drawerSource, /info\.uiTabsVisible/);
assert.match(drawerMethod, /socket\.setState/);
assert.doesNotMatch(drawerMethod, /setSystemConfig|getSystemConfig\(/);
const builtDrawer = bootstrapBundle.slice(
    bootstrapBundle.indexOf('async getTabs(e){'),
    bootstrapBundle.indexOf('getNavigationItems(){', bootstrapBundle.indexOf('async getTabs(e){')),
);
assert.match(builtDrawer, /info\.uiTabsVisible/);
assert.match(builtDrawer, /socket\.setState/);
assert.doesNotMatch(builtDrawer, /setSystemConfig|getSystemConfig\(/);
assert.ok((io.instanceObjects || []).some(object => object?._id === 'info.uiTabsVisible'), 'navigation state object missing');

// Backup navigation is emitted only for an actually enabled instance.
assert.match(drawerSource, /backupAdapters\.has\(adapterName\) && instance\.enabled !== true/);
assert.match(builtDrawer, /o\.has\(A\)&&d\.enabled!==!0/);

console.log('[NexoWatt EOS role security] OK (authoritative Admin rights, End User read-only datapoints, protected tools, restart-safe menu storage)');
