#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
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
const assistSource = read('src-admin/public/js/eos-assistant.js');
const io = json('io-package.json');
const stability = read('README_STABILITY_V7.9.95.md');

for (const marker of [
  '--nx-shadow-soft', '--nx-shadow-float', 'backdrop-filter: blur', '#app-paper', '.MuiDialog-paper',
  '.MuiButton-root', '.MuiTableRow-root', ':focus-visible', 'border-radius: 24px', 'linear-gradient',
  '@media (max-width: 720px)', '.eos-activation-steps', '.eos-account-row:hover',
  'main.MuiPaper-root::before', 'width: min(334px, calc(100vw - 56px)) !important', '.eos-assist-header-root', '.eos-overview-hero', '.eos-overview-grid',
  '.eos-account-management-entry', 'pointer-events: auto !important', 'touch-action: manipulation', 'overflow: visible',
]) if (!css.includes(marker)) fail(`modern styling marker missing: ${marker}`);
if (sourceCss !== css) fail('modern CSS source/build drift');
for (const marker of ['eos-account-management.js','nexowatt-native-shell.css','eos-role-bootstrap.js','eos-assistant.js']) {
  if (!index.includes(marker)) fail(`modern UI asset not active: ${marker}`);
}
for (const marker of ['NexoWatt EOS', 'Zugänge & Rollen', 'Endkunden-Zugänge', 'ensureEntrySurface']) {
  if (!accountUi.includes(marker)) fail(`modern account surface missing label: ${marker}`);
}
for (const marker of ['installIntegratedFirstLogin','v91 compact normal-login first activation','eos-passwordless-card','Idempotent writes are essential here']) {
  if (!bootstrap.includes(marker)) fail(`integrated first-activation surface missing: ${marker}`);
}
if (/data-eos-account=|selector\.innerHTML/.test(bootstrap)) fail('compact login still injects role buttons or a second panel');
if (bootstrap.includes("launcher.className = 'eos-passwordless-launcher'")) fail('old bottom first-login launcher is still rendered');
if (!shell.includes('ensureModernOverview') || !shell.includes("currentTab() !== 'tab-intro'")) fail('current overview is not modernized');
if (!role.includes('eos-role-safe-overview') || !role.includes("currentRoute() !== 'tab-intro'") || !role.includes('navigateToTab') || !role.includes("overview.querySelectorAll('a[data-eos-role-tab]')")) fail('role-safe current overview is missing or not directly clickable');
if (!role.includes('ensureReserveObserver') || !role.includes('state.reserveObserver.observe(paper')) fail('scoped delayed-row reserve filter is missing');

for (const marker of [
  'NEXOWATT_EOS_ASSIST_DISABLED = true', "classList.add('eos-assist-disabled')",
  "querySelectorAll('.eos-assist-root,.eos-assist-header-root,[data-eos-assist-root]')", 'element.remove()',
]) if (!assist.includes(marker)) fail(`EOS Assist stable-disable marker missing: ${marker}`);
if (assistSource !== assist) fail('EOS Assist source/build drift');
if (assist.includes('insertBefore(root, userAnchor)') || assist.includes('appendChild(root)') || assist.includes('new MutationObserver')) fail('disabled EOS Assist still creates or observes a UI surface');
if (assist.includes('position:fixed;bottom') || assist.includes('bottom:')) fail('disabled EOS Assist still contains a bottom floating implementation');
if (io.native?.disableMcp !== true || io.native?.eosAssistantEnabled !== false || io.native?.eosAssistEnabled !== false) fail('stable io-package does not disable EOS Assist consistently');
if (!stability.includes('Deaktivierung des EOS Assist')) fail('stable documentation does not state that EOS Assist is disabled');

const observerCount = [
  'eos-policy-client.js', 'eos-branding-sanitizer.js', 'nexowatt-native-shell.js', 'eos-native-security.js',
  'eos-basic-settings.js', 'eos-role-ui.js', 'eos-account-management.js', 'eos-assistant.js',
].reduce((count, file) => count + (read(`adminWww/js/${file}`).match(/new MutationObserver/g) || []).length, 0);
if (observerCount !== 2) fail(`expected one shared observer plus one scoped reserve-row observer, found ${observerCount}`);

if (bad) process.exit(1);
console.log('[NexoWatt EOS modern UI] OK (EOS Assist stable-disable contract)');
