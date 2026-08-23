#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
let bad = false;
const fail = msg => { console.error(`[NexoWatt EOS role access] ${msg}`); bad = true; };

const source = read('src/main.ts');
const built = read('build/main.js');
const webSource = read('src/lib/web.ts');
const webBuilt = read('build/lib/web.js');
const role = read('adminWww/js/eos-role-ui.js');
const boot = read('adminWww/js/eos-role-bootstrap.js');
const basic = read('adminWww/js/eos-basic-settings.js');
const manual = read('adminWww/js/eos-manual-write-policy.js');
const drawer = read('src-admin/src/components/Drawer.tsx');
const index = read('adminWww/index.html');
const io = json('io-package.json');
const buildInfo = json('NEXOWATT_EOS_BUILD_INFO.json');
const shellTag = String(buildInfo.shellCacheTag || buildInfo.shellCacheVersion);

for (const code of [source, built]) {
  for (const marker of [
    'system.group.nexowatt-service', 'system.group.installateur', 'system.group.endkunde', 'system.user.guest',
    'ensureEosRoleModel', 'ensureEosInstallerSmartHomeMembership', 'ensureEosSystemObjectAccess',
    'ensureEosSmartHomeEnumAccess', 'EOS_ROLE_READABLE_SYSTEM_OBJECT_IDS', 'EOS_ADMIN_ONLY_SYSTEM_OBJECT_IDS',
    "'system.config', 'system.repositories'", "'system.certificates', 'system.licenses'",
    "row.id === 'enum.rooms'", "row.id === 'enum.functions'", 'const adminOnlyAcl = !isEosAdmin',
    'restoreObjectAclManagedByEos(id)', 'eosPasswordSetupRequired', 'personal password setup is required',
    'installer command is outside commissioning allowlist', 'internal Service reserve is Admin/Service-only',
  ]) if (!code.includes(marker)) fail(`role backend marker missing: ${marker}`);
  if (code.includes('EOS_SENSITIVE_OBJECT_IDS')) fail('legacy all-admin-only system object list remains');
}
if (!/if \(!userId\) \{\s*return 'enduser';/.test(source) || !/if \(!userId\) \{\s*return 'enduser';/.test(built)) {
  fail('unknown socket identities do not fail closed to enduser');
}

for (const code of [webSource, webBuilt]) {
  for (const marker of [
    'getEosRequestAccess', 'getEosRoleCapabilities', 'sendEosBasicSettings', 'saveEosBasicSettings',
    '/nexowatt/role-settings/basic', "expertMode: role === 'admin'", 'basicSystemSettings: technical',
    'accountPasswordReset', 'nexowattBackup: true', "internalBackupReserve: role === 'admin'",
    'hideLegacyBackupFromNonAdmins', 'customerBackupAdapters', 'authenticated', 'mustChangePassword',
  ]) if (!code.includes(marker)) fail(`role web marker missing: ${marker}`);
  if (/async getEosRequestAccess\([^)]*\)[\s\S]{0,260}this\.getEosRequestAccess\(/.test(code)) fail('role access resolver is recursive');
}

for (const marker of [
  'v99-native-overview-ems-live-reserve-filter', 'App.expertMode', "setItem('App.expertMode', 'false')",
  'data-eos-admin-only-control', 'data-eos-system-settings-control', 'NEXOWATT_EOS_BASIC_SETTINGS',
  'isRouteAllowed', "clean === 'tab-enums'", "clean === 'tab-intro'", "route === 'tab-users'",
  'isOfficialBackupTab', 'isCustomerBackupTab', 'never cover the real Admin Intro', 'hideOfficialReserveSurfaces',
  'navigateToTab', '.MuiAccordion-root', 'exact visible instance ID', 'Reused virtual rows must be unhidden',
  'repositories|repository|lizenzen|licenses|zertifikate|certificates|zugangsdaten|credentials',
]) if (!role.includes(marker)) fail(`role UI marker missing: ${marker}`);
if (!role.includes("if (route === 'easy') return false")) fail('Easy overview is not explicitly disabled');
if (role.includes("NEXOWATT_EOS_ACCOUNT_MANAGEMENT.open")) fail('account management is launched outside Zugänge & Rechte');

for (const marker of [
  'NEXOWATT_EOS_BOOTSTRAP_POLICY', 'nexowatt/security/context', 'dataset?.eosEntry', 'defaultTab',
  'lockExpertMode', 'showSecurityRecovery', 'authenticated === false', 'installIntegratedFirstLogin',
  'v99 normal-login first activation', "defaultTab = () => 'tab-intro'", 'isOfficialReserveTab', 'isCustomerBackupTab',
]) if (!boot.includes(marker)) fail(`role bootstrap marker missing: ${marker}`);

for (const marker of [
  'X-NexoWatt-EOS-Role-Settings', 'Repositories, Lizenzen, Zertifikate', 'defaultHistory',
  'defaultLogLevel', "role() !== 'installer'",
]) if (!basic.includes(marker)) fail(`installer basic settings marker missing: ${marker}`);
for (const marker of ['effectiveExpertMode', "accessRole === 'admin'"]) if (!manual.includes(marker)) fail(`manual-write role lock missing: ${marker}`);
for (const marker of ["'tab-intro': 'Übersicht'", "'tab-users': 'Zugänge & Rechte'", 'System-Notfallsicherung', 'NexoWatt Sicherung']) {
  if (!drawer.includes(marker)) fail(`Drawer role/navigation marker missing: ${marker}`);
}

for (const rel of [
  'js/eos-role-bootstrap.js', 'js/eos-role-ui.js', 'js/eos-basic-settings.js', 'js/eos-native-security.js',
  'js/eos-manual-write-policy.js', 'js/eos-account-management.js', 'js/eos-assistant.js', 'js/nexowatt-native-shell.js',
  'css/nexowatt-native-shell.css',
]) if (read(`src-admin/public/${rel}`) !== read(`adminWww/${rel}`)) fail(`source/build drift: ${rel}`);

for (const asset of ['eos-basic-settings.js','eos-role-bootstrap.js','eos-role-ui.js','eos-account-management.js','eos-assistant.js']) {
  if (!index.includes(`${asset}?v=${shellTag}`)) fail(`${asset} cache key is not active`);
}
if (index.includes('<script type="module" crossorigin src="./assets/index-CQZugZ1z-v84.js?v=84"></script>')) fail('main module bypasses role bootstrap');

if (io.native?.auth !== true) fail('authentication must be enabled by default for new sales systems');
if (io.native?.eosRequireFirstLoginPassword !== true) fail('first-login password setup must be enabled');
if (io.native?.eosHideLegacyBackupFromNonAdmins !== true) fail('internal backup reserve must default to Admin/Service visibility');
for (const field of ['eosServiceGroups','eosInstallerGroups','eosEndUserGroups']) {
  if (!Array.isArray(io.native?.[field]) || !io.native[field].length) fail(`${field} is not configured`);
}


if (role.includes('overview.innerHTML = `')) fail('obsolete role-specific action-tile overlay remains active');
if (!role.includes('updateNativeOverviewRole') || !role.includes('hideIntroEditControls')) fail('native role overview helpers are missing');
if (bad) process.exit(1);
console.log('[NexoWatt EOS role access] OK');
