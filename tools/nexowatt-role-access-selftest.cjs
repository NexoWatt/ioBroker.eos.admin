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
const index = read('adminWww/index.html');
const io = json('io-package.json');
const buildInfo = json('NEXOWATT_EOS_BUILD_INFO.json');
const shellTag = String(buildInfo.shellCacheTag || buildInfo.shellCacheVersion);

for (const code of [source, built]) {
  for (const marker of [
    'system.group.nexowatt-service',
    'system.group.installateur',
    'system.group.endkunde',
    'ensureEosRoleModel',
    'ensureEosInstallerSmartHomeMembership',
    'ensureEosSystemObjectAccess',
    'ensureEosSmartHomeEnumAccess',
    'EOS_ROLE_READABLE_SYSTEM_OBJECT_IDS',
    'EOS_ADMIN_ONLY_SYSTEM_OBJECT_IDS',
    "'system.config', 'system.repositories'",
    "'system.certificates', 'system.licenses'",
    "row.id === 'enum.rooms'",
    "row.id === 'enum.functions'",
    'const adminOnlyAcl = !isEosAdmin',
    'restoreObjectAclManagedByEos(id)',
  ]) if (!code.includes(marker)) fail(`role backend marker missing: ${marker}`);
  if (code.includes('EOS_SENSITIVE_OBJECT_IDS')) fail('legacy all-admin-only system object list remains');
  if (/for \(const id of EOS_ROLE_READABLE_SYSTEM_OBJECT_IDS\)[\s\S]{0,120}ensureObjectAdminOnlyAcl/.test(code)) {
    fail('role-readable system objects are still forced to administrator-only ACL');
  }
}


if (!/if \(!userId\) \{\s*return 'enduser';/.test(source)) fail('unknown socket identities do not fail closed to enduser');
if (!/if \(!userId\) \{\s*return 'enduser';/.test(built)) fail('built unknown socket identities do not fail closed to enduser');
for (const marker of ['nexowattEosServiceMirroredMembers', 'installer command is outside commissioning allowlist']) {
  if (!source.includes(marker) || !built.includes(marker)) fail(`role hardening marker missing: ${marker}`);
}

for (const code of [webSource, webBuilt]) {
  for (const marker of [
    'getEosRequestAccess',
    'getEosRoleCapabilities',
    'sendEosBasicSettings',
    'saveEosBasicSettings',
    '/nexowatt/role-settings/basic',
    "expertMode: role === 'admin'",
    'basicSystemSettings: technical',
    'authenticated',
    'mustChangePassword',
  ]) if (!code.includes(marker)) fail(`role web marker missing: ${marker}`);
  if (/async getEosRequestAccess\([^)]*\)[\s\S]{0,260}this\.getEosRequestAccess\(/.test(code)) fail('role access resolver is recursive');
}

for (const marker of [
  'App.expertMode',
  "setItem('App.expertMode', 'false')",
  'data-eos-admin-only-control',
  'data-eos-system-settings-control',
  'NEXOWATT_EOS_BASIC_SETTINGS',
  'Installateurbereich',
  'Endkundenbereich',
  'isRouteAllowed',
  "route === 'easy'",
  "clean === 'tab-enums'",
  'repositories|repository|lizenzen|licenses|zertifikate|certificates|zugangsdaten|credentials',
]) if (!role.includes(marker)) fail(`role UI marker missing: ${marker}`);

for (const marker of [
  'NEXOWATT_EOS_BOOTSTRAP_POLICY',
  'nexowatt/security/context',
  'dataset?.eosEntry',
  'defaultTab',
  'lockExpertMode',
  'showSecurityRecovery',
  'authenticated === false',
]) if (!boot.includes(marker)) fail(`role bootstrap marker missing: ${marker}`);

for (const marker of [
  'X-NexoWatt-EOS-Role-Settings',
  'Repositories, Lizenzen, Zertifikate',
  'defaultHistory',
  'defaultLogLevel',
  "role() !== 'installer'",
]) if (!basic.includes(marker)) fail(`installer basic settings marker missing: ${marker}`);

for (const marker of ['effectiveExpertMode', "accessRole === 'admin'"]) {
  if (!manual.includes(marker)) fail(`manual-write role lock missing: ${marker}`);
}

for (const rel of [
  'js/eos-role-bootstrap.js', 'js/eos-role-ui.js', 'js/eos-basic-settings.js',
  'js/eos-native-security.js', 'js/eos-manual-write-policy.js',
]) if (read(`src-admin/public/${rel}`) !== read(`adminWww/${rel}`)) fail(`source/build drift: ${rel}`);

if (!index.includes(`eos-basic-settings.js?v=${shellTag}`)) fail('installer basic settings asset is not active');
if (!index.includes(`eos-role-bootstrap.js?v=${shellTag}`)) fail('role bootstrap cache key is not active');
if (!index.includes(`eos-role-ui.js?v=${shellTag}`)) fail('role UI cache key is not active');
if (index.includes('<script type="module" crossorigin src="./assets/index-CQZugZ1z-v84.js?v=84"></script>')) fail('main module bypasses role bootstrap');

if (io.native?.auth !== true) fail('authentication must be enabled by default for new sales systems');
if (io.native?.eosRequireFirstLoginPassword !== true) fail('first-login password setup must be enabled');
for (const field of ['eosServiceGroups','eosInstallerGroups','eosEndUserGroups']) {
  if (!Array.isArray(io.native?.[field]) || !io.native[field].length) fail(`${field} is not configured`);
}

if (bad) process.exit(1);
console.log('[NexoWatt EOS role access] OK');
