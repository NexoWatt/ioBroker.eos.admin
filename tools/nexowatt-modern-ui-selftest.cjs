#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let bad = false;
const fail = msg => { console.error(`[NexoWatt EOS modern UI] ${msg}`); bad = true; };
const css = read('adminWww/css/nexowatt-native-shell.css');
const sourceCss = read('src-admin/public/css/nexowatt-native-shell.css');
const index = read('adminWww/index.html');
const accountUi = read('adminWww/js/eos-account-management.js');
const bootstrap = read('adminWww/js/eos-role-bootstrap.js');
const shell = read('adminWww/js/nexowatt-native-shell.js');
const role = read('adminWww/js/eos-role-ui.js');
const assist = read('adminWww/js/eos-assistant.js');

for (const marker of [
  '--nx-shadow-soft', '--nx-shadow-float', 'backdrop-filter: blur', '#app-paper', '.MuiDialog-paper',
  '.MuiButton-root', '.MuiTableRow-root', ':focus-visible', 'border-radius: 24px', 'linear-gradient',
  '@media (max-width: 720px)', '.eos-activation-steps', '.eos-account-row:hover',
  '.eos-login-role-selector', '.eos-assist-header-root', '.eos-overview-hero', '.eos-overview-grid',
  '.eos-account-management-entry', 'overflow: visible',
]) if (!css.includes(marker)) fail(`modern styling marker missing: ${marker}`);
if (sourceCss !== css) fail('modern CSS source/build drift');
for (const marker of ['eos-account-management.js','nexowatt-native-shell.css','eos-role-bootstrap.js','eos-assistant.js']) {
  if (!index.includes(marker)) fail(`modern UI asset not active: ${marker}`);
}
for (const marker of ['NexoWatt EOS', 'Zugänge & Rollen', 'Endkunden-Zugänge', 'ensureEntrySurface']) {
  if (!accountUi.includes(marker)) fail(`modern account surface missing label: ${marker}`);
}
for (const marker of ['installIntegratedFirstLogin','eos-login-role-selector','eos-login-role-buttons','eos-passwordless-card']) {
  if (!bootstrap.includes(marker)) fail(`integrated first-activation surface missing: ${marker}`);
}
if (bootstrap.includes("launcher.className = 'eos-passwordless-launcher'")) fail('old bottom first-login launcher is still rendered');
if (!shell.includes('ensureModernOverview') || !shell.includes("currentTab() !== 'tab-intro'")) fail('current overview is not modernized');
if (!role.includes('eos-role-safe-overview') || !role.includes("currentRoute() !== 'tab-intro'")) fail('role-safe current overview is missing');
if (!assist.includes('eos-assist-header-root') || !assist.includes('insertBefore(root, userAnchor)')) fail('EOS Assist is not integrated in the header');
if (assist.includes('position:fixed;bottom') || assist.includes('bottom:')) fail('EOS Assist still uses a bottom floating position');

const observerCount = [
  'eos-policy-client.js', 'eos-branding-sanitizer.js', 'nexowatt-native-shell.js', 'eos-native-security.js',
  'eos-basic-settings.js', 'eos-role-ui.js', 'eos-account-management.js', 'eos-assistant.js',
].reduce((count, file) => count + (read(`adminWww/js/${file}`).match(/new MutationObserver/g) || []).length, 0);
if (observerCount !== 1) fail(`expected exactly one shared broad MutationObserver, found ${observerCount}`);

if (bad) process.exit(1);
console.log('[NexoWatt EOS modern UI] OK');
