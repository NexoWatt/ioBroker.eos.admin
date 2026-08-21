#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let bad = false;
const fail = msg => { console.error(`[NexoWatt EOS first-login] ${msg}`); bad = true; };
const mainSource = read('src/main.ts');
const mainBuilt = read('build/main.js');
const source = read('src/lib/web.ts');
const built = read('build/lib/web.js');
const boot = read('adminWww/js/eos-role-bootstrap.js');
const bootSource = read('src-admin/public/js/eos-role-bootstrap.js');
const login = read('src-admin/src/login/Login.tsx');
const css = read('adminWww/css/nexowatt-native-shell.css');
const io = JSON.parse(read('io-package.json'));

for (const code of [source, built]) {
  for (const marker of [
    'getEosFirstLoginPasswordState', 'validateEosFirstLoginPassword', 'setEosUserPassword',
    'saveEosFirstLoginPassword', '/nexowatt/account/first-password', 'x-nexowatt-eos-first-login',
    'passwordInitialized', 'passwordSetupVersion', 'forcePasswordChange', 'logoutRequired', "role === 'admin'",
    'setPasswordAsync', 'EOS_PASSWORD_SERVICE_USER', 'do not need global users.write rights', 'passwordComplexity',
    'isEosSameOriginWrite', 'authenticated', 'destroyEosRequestSessions', 'destroySession', 'clearCookie',
    'startEosPasswordlessFirstLogin', 'saveEosPasswordlessFirstLogin',
    '/nexowatt/account/passwordless-claim', '/nexowatt/account/passwordless-password',
    'x-nexowatt-eos-passwordless-claim', 'x-nexowatt-eos-passwordless-password',
    'nexowatt_eos_first_login', "httpOnly: true", "sameSite: 'strict'", 'createHash',
    'isEosPasswordlessRequestNetworkAllowed', 'privateNetworkRequired', 'passwordlessFirstLoginAllowed',
    'passwordless-first-activation', 'Limit both individual-account guessing and username rotation from one client.',
    'req.ip || req.socket.remoteAddress',
  ]) if (!code.includes(marker)) fail(`backend marker missing: ${marker}`);
  if (code.includes("req.headers['x-forwarded-for']")) fail('passwordless claim trusts forgeable X-Forwarded-For directly');
  if (/if \(!address \|\| address === '::1'/.test(code)) fail('unknown remote address is incorrectly treated as private');
  const publicRoute = code.indexOf('/nexowatt/account/passwordless-claim');
  const authMiddleware = code.indexOf('route middleware to make sure a user is logged in');
  if (publicRoute < 0 || authMiddleware < 0 || publicRoute > authMiddleware) fail('passwordless claim routes are not narrowly registered before login middleware');
}

for (const code of [mainSource, mainBuilt]) {
  for (const marker of [
    'ensureEosDefaultUser', 'prepareEosPasswordlessFirstLogin', 'system.user.installer', 'system.user.guest',
    'passwordlessFirstLoginAllowed', 'eosPasswordSetupRequired', 'personal password setup is required',
    'Set the audit timestamp only once',
  ]) if (!code.includes(marker)) fail(`account provisioning marker missing: ${marker}`);
  if (!/randomBytes[^\n]{0,40}48/.test(code)) fail('random bootstrap secret generation is missing');
  if (!/if \(!updatedAccount\.passwordlessPreparedAt\)/.test(code)) fail('passwordlessPreparedAt is not write-loop safe');
}

for (const marker of [
  'v89-integrated-first-login-bootstrap', 'showFirstLoginPassword', 'eos-first-login-overlay', 'mustChangePassword',
  'passwordSetup?.required', 'X-NexoWatt-EOS-First-Login', 'autocomplete="new-password"', 'location.replace(logoutUrl)',
  'showSecurityRecovery', 'authenticated === false', 'installIntegratedFirstLogin', 'eos-login-role-selector',
  'eos-login-role-buttons', 'data-eos-account="installer"', 'data-eos-account="guest"',
  'startClaim', '!password.value', 'X-NexoWatt-EOS-Passwordless-Claim',
  'X-NexoWatt-EOS-Passwordless-Password', 'showPasswordlessClaimPassword', 'eos-activation-steps',
]) if (!boot.includes(marker)) fail(`browser marker missing: ${marker}`);
if (boot.includes("launcher.className = 'eos-passwordless-launcher'")) fail('separate first-login launcher is still created');
if (boot.includes('installPasswordlessFirstLoginLauncher')) fail('old first-login launcher function remains active');

for (const marker of ['NEXOWATT_EOS_FIRST_LOGIN', 'eos-login-role-selector-native', 'onLoginAction', 'isManagedFirstLogin']) {
  if (!login.includes(marker)) fail(`native login integration marker missing: ${marker}`);
}
for (const marker of [
  '.eos-first-login-overlay', '.eos-first-login-card', '.eos-first-login-submit', '.eos-passwordless-card',
  '.eos-activation-steps', '.eos-login-role-selector', '.eos-login-role-buttons', '.eos-login-role-button',
  '.eos-passwordless-launcher',
]) if (!css.includes(marker)) fail(`first-login CSS marker missing: ${marker}`);

if (io.native?.auth !== true) fail('authentication is not enabled by default');
if (io.native?.eosRequireFirstLoginPassword !== true) fail('first-login password is not enabled by default');
if (io.native?.eosPasswordlessFirstLogin !== true) fail('passwordless first activation is not enabled by default');
if (io.native?.eosPasswordlessFirstLoginPrivateNetworkOnly !== true) fail('passwordless first activation must default to private networks only');
if (Number(io.native?.eosPasswordClaimTtlMinutes) < 3 || Number(io.native?.eosPasswordClaimTtlMinutes) > 30) fail('password claim TTL must be between 3 and 30 minutes');
if (Number(io.native?.eosFirstLoginPasswordMinLength) < 10) fail('minimum password length must be at least 10');
if (io.native?.eosAutoAssignDefaultRoleUsers !== true) fail('default role account assignment is not enabled');
if (bootSource !== boot) fail('first-login bootstrap source/build drift');

if (bad) process.exit(1);
console.log('[NexoWatt EOS first-login] OK');
