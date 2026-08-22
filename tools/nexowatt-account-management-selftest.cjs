#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
let bad = false;
const fail = msg => { console.error(`[NexoWatt EOS account management] ${msg}`); bad = true; };

const mainSource = read('src/main.ts');
const mainBuilt = read('build/main.js');
const webSource = read('src/lib/web.ts');
const webBuilt = read('build/lib/web.js');
const sourceUi = read('src-admin/public/js/eos-account-management.js');
const builtUi = read('adminWww/js/eos-account-management.js');
const roleUi = read('adminWww/js/eos-role-ui.js');
const css = read('adminWww/css/nexowatt-native-shell.css');
const index = read('adminWww/index.html');
const io = json('io-package.json');
const info = json('NEXOWATT_EOS_BUILD_INFO.json');
const stability = read('README_STABILITY_V7.9.95.md');
const acceptance = read('RELEASE_ACCEPTANCE_V7.9.95.md');
const shellTag = String(info.shellCacheTag || info.shellCacheVersion);

for (const code of [mainSource, mainBuilt]) {
  for (const marker of [
    'system.user.installer', 'system.user.guest', 'ensureEosDefaultRoleUsers', 'unknown random bootstrap secret',
    'eosPasswordSetupRequired', 'personal password setup is required', "EOS_STABLE_INITIAL_PASSWORD = 'nexowatt'",
    'nexowattPasswordChangeRequired: true',
  ]) if (!code.includes(marker)) fail(`main account marker missing: ${marker}`);
}

function extractResetMethod(code) {
  const start = code.indexOf('resetEosAccountPassword');
  if (start < 0) return '';
  const route = code.indexOf("'/nexowatt/account/reset'", start);
  return code.slice(start, route > start ? route : Math.min(code.length, start + 12000));
}

for (const code of [webSource, webBuilt]) {
  for (const marker of [
    'getEosManagedAccounts', 'sendEosAccountManagement', 'resetEosAccountPassword',
    '/nexowatt/account/manage', '/nexowatt/account/reset', 'x-nexowatt-eos-account-reset',
    'canResetInstaller', 'canResetEndUser', "targetUserId === 'system.user.admin'", 'targetUserId === access.userId',
    "access.role === 'installer' && explicitlyManagedRole !== 'enduser'",
    'explicit member of a managed EOS installer/end-user group', 'passwordResetAt', 'passwordResetBy',
    "passwordResetMode = 'initial-password'", 'accountDisabled',
    "setEosUserPassword(targetUserId, 'nexowatt')", 'forcePasswordChange = true',
    'passwordlessFirstLoginAllowed = false', 'nexowattPasswordChangeRequired = true',
    'eosPasswordChangeRequired = true', 'nexowattInitialPasswordApplied = true',
  ]) if (!code.includes(marker)) fail(`web account marker missing: ${marker}`);
  if (!code.includes('const explicitInstaller = targetAccess.groups.some')) fail('reset target is not restricted to explicit installer membership');
  if (!code.includes('const explicitEndUser = targetAccess.groups.some')) fail('reset target is not restricted to explicit end-user membership');

  const reset = extractResetMethod(code);
  if (!reset) fail('account reset method could not be isolated');
  if (reset.includes("passwordResetMode = 'passwordless-first-activation'")) fail('stable reset still activates the obsolete passwordless flow');
  if (/randomBytes[^\n]{0,80}48/.test(reset)) fail('stable reset unexpectedly creates an undisclosed password instead of the documented initial credential');
}

if (io.native?.eosPasswordlessFirstLogin !== false) fail('eosPasswordlessFirstLogin must remain disabled in stable');
if (io.native?.eosAllowPasswordlessFirstLogin !== false) fail('eosAllowPasswordlessFirstLogin must remain disabled in stable');
if (io.native?.eosRequireFirstLoginPasswordChange !== true) fail('mandatory password change after reset is not enabled');
if (!stability.includes('Startpasswort `nexowatt`')) fail('stable documentation does not describe the reset/bootstrap credential');
if (!acceptance.includes('Startpasswort `nexowatt`')) fail('release acceptance does not test the stable initial credential');

for (const marker of [
  'v91-account-management-under-access-rights', "['admin', 'installer']", 'nexowatt/account/manage',
  'nexowatt/account/reset', 'X-NexoWatt-EOS-Account-Reset', 'data.canResetInstaller === true',
  "account.role === 'enduser'", 'Admin/Service', 'Installateure', 'NEXOWATT_EOS_ACCOUNT_MANAGEMENT',
  'ensureEntrySurface', "currentRoute() !== 'tab-users'", 'eos-account-management-entry',
]) if (!sourceUi.includes(marker)) fail(`account UI marker missing: ${marker}`);
if (sourceUi.includes("launcher.className = 'eos-account-management-launcher'")) fail('standalone account launcher is still created');
if (sourceUi.includes('new MutationObserver')) fail('account management adds a second broad MutationObserver');
if (sourceUi !== builtUi) fail('account management source/build drift');
if (!roleUi.includes("route === 'tab-users'")) fail('installer cannot reach Zugänge & Rechte');
if (roleUi.includes('NEXOWATT_EOS_ACCOUNT_MANAGEMENT.open')) fail('role overview opens account management outside Zugänge & Rechte');
if (!index.includes(`eos-account-management.js?v=${shellTag}`)) fail('account management asset is not active with the current cache tag');
for (const marker of [
  '.eos-account-management-entry', '.eos-account-management-overlay', '.eos-account-management-dialog',
  '.eos-account-row', '.eos-account-reset', 'html.eos-account-page-installer',
]) if (!css.includes(marker)) fail(`account management CSS marker missing: ${marker}`);

if (bad) process.exit(1);
console.log('[NexoWatt EOS account management] OK (stable initial-password reset contract)');
