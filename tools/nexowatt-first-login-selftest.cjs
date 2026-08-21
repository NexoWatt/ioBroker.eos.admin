#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let bad = false;
const fail = msg => { console.error(`[NexoWatt EOS first-login] ${msg}`); bad = true; };
const src = read('src/lib/web.ts');
const built = read('build/lib/web.js');
const boot = read('adminWww/js/eos-role-bootstrap.js');
const css = read('adminWww/css/nexowatt-native-shell.css');
const io = JSON.parse(read('io-package.json'));

for (const code of [src, built]) {
  for (const marker of [
    'getEosFirstLoginPasswordState', 'validateEosFirstLoginPassword', 'setEosUserPassword',
    'saveEosFirstLoginPassword', '/nexowatt/account/first-password',
    'x-nexowatt-eos-first-login', 'passwordInitialized', 'passwordSetupVersion',
    'forcePasswordChange', 'logoutRequired', "role === 'admin'", 'setPasswordAsync',
    'EOS_PASSWORD_SERVICE_USER', 'do not need global users.write rights',
    'passwordComplexity', 'isEosSameOriginWrite', 'authenticated',
    'destroyEosRequestSessions', 'destroySession', 'clearCookie', 'sessionInvalidated',
  ]) if (!code.includes(marker)) fail(`backend marker missing: ${marker}`);
  if (/async getEosRequestAccess\([^)]*\)[\s\S]{0,260}this\.getEosRequestAccess\(/.test(code)) fail('access resolver recursion would break first login');
}

for (const marker of [
  'showFirstLoginPassword', 'eos-first-login-overlay', 'mustChangePassword',
  'passwordSetup?.required', 'X-NexoWatt-EOS-First-Login',
  'autocomplete="new-password"', 'location.replace(logoutUrl)',
  'showSecurityRecovery', 'authenticated === false', 'interface remains locked',
]) if (!boot.includes(marker)) fail(`browser marker missing: ${marker}`);
if (boot.includes('continues without early policy')) fail('security context failure still launches the unrestricted app');
const catchBlock = boot.match(/\.catch\(error => \{([\s\S]*?)\n\s*\}\)\n\s*\.finally/);
if (!catchBlock || !catchBlock[1].includes('showSecurityRecovery') || catchBlock[1].includes('launch();')) {
  fail('bootstrap must fail closed when role context is unavailable');
}

for (const marker of ['.eos-first-login-overlay', '.eos-first-login-card', '.eos-first-login-submit']) {
  if (!css.includes(marker)) fail(`first-login CSS marker missing: ${marker}`);
}
if (io.native?.auth !== true) fail('authentication is not enabled by default');
if (io.native?.eosRequireFirstLoginPassword !== true) fail('first-login password is not enabled by default');
if (Number(io.native?.eosFirstLoginPasswordMinLength) < 10) fail('minimum password length must be at least 10');
if (io.native?.eosAutoAssignDefaultRoleUsers !== true) fail('default role account assignment is not enabled');
if (read('src-admin/public/js/eos-role-bootstrap.js') !== boot) fail('first-login bootstrap source/build drift');

if (bad) process.exit(1);
console.log('[NexoWatt EOS first-login] OK');
