#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const { cleanLegacyRuntime } = require('./nexowatt-clean-legacy-runtime.cjs');
try {
  cleanLegacyRuntime({ root, quiet: true });
} catch (error) {
  console.error(`[NexoWatt EOS stability] runtime cleanup failed: ${error?.message || error}`);
  process.exit(1);
}
let bad = false;
const fail = m => { console.error(`[NexoWatt EOS stability] ${m}`); bad = true; };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f));
const exists = f => fs.existsSync(path.join(root, f));

const version = json('package.json').version;
const info = json('NEXOWATT_EOS_BUILD_INFO.json');
const { verifyFrontendManifest, readModuleChunks } = require('./nexowatt-frontend-artifacts.cjs');
const frontend = verifyFrontendManifest();
const shellNo = Number(info.shellCacheVersion ?? info.brandingCacheVersion);
const shellTag = String(info.shellCacheTag || shellNo);
const autoUpdateTag = String(info.autoUpdateCacheTag || info.autoUpdateCacheVersion || shellTag);
if (!/^8\.0\.2(?:-rc\.\d+)?$/.test(version)) fail(`unexpected version ${version}`);
if (!Number.isFinite(shellNo)) fail('invalid shell cache version');
for (const [name, value] of [
  ['build info', info.version],
  ['io common', json('io-package.json').common.version],
  ['io top-level', json('io-package.json').version],
  ['root lock', json('package-lock.json').version],
  ['root lock package', json('package-lock.json').packages?.['']?.version],
  ['src package', json('src-admin/package.json').version],
  ['src lock', json('src-admin/package-lock.json').version],
  ['src lock package', json('src-admin/package-lock.json').packages?.['']?.version],
  ['src version', json('src-admin/src/version.json').version],
]) if (value !== version) fail(`${name}=${value}, expected ${version}`);

const index = read('adminWww/index.html');
for (const marker of [
  `eos-manual-write-policy.js?v=${shellTag}`,
  `eos-role-bootstrap.js?v=${shellTag}`,
  `eos-policy-client.js?v=${shellTag}`,
  `nexowatt-native-shell.js?v=${shellTag}`,
  `eos-native-security.js?v=${shellTag}`,
  `eos-role-ui.js?v=${shellTag}`,
  `eos-auto-update.js?v=${autoUpdateTag}`,
  `eos-auto-update.css?v=${autoUpdateTag}`,
  `eos-assistant.js?v=${shellTag}`,
  `nexowatt-native-shell.css?v=${shellTag}`,
  `nexowatt-stable-v${shellTag}.js?v=${shellTag}`,
]) if (!index.includes(marker)) fail(`index missing ${marker}`);
for (const old of ['eos-branding.js','eos-branding.css','eos-security-ui.js','eos-console-quiet.js','eos-objects-state-tools.js']) {
  if (index.includes(old)) fail(`legacy overlay active: ${old}`);
}

// Actual hashed entries, imports, source hashes and role-gated startup were checked above.
const scripts = ['eos-policy-client.js','eos-branding-sanitizer.js','nexowatt-native-shell.js','eos-native-security.js','eos-basic-settings.js','eos-role-ui.js','eos-account-management.js','eos-auto-update.js','eos-assistant.js'];
const observerCount = scripts.reduce((n, f) => n + (read(`adminWww/js/${f}`).match(/new MutationObserver/g) || []).length, 0);
if (observerCount < 2 || observerCount > 4) fail(`unexpected EOS observer count ${observerCount}`);
if (!read('adminWww/js/eos-role-ui.js').includes('state.reserveObserver.observe(paper')) fail('scoped reserve-row observer missing');
const shell = read('adminWww/js/nexowatt-native-shell.js');
if (!shell.includes('ensureNavigationContainer') || !shell.includes('rendered natively by Drawer.tsx')) fail('native shell container implementation missing');
if (shell.includes('textNode.textContent = cfg.label') || shell.includes('innerHTML = cfg.svg')) fail('native shell still rewrites navigation content');
if (shell.includes('createTreeWalker')) fail('broad text walker detected');
const bootstrap = readModuleChunks('src/components/Drawer.tsx');
for (const marker of ['nexowatt-native-nav-item', 'NexoWatt EOS', 'Zugänge & Rechte']) {
  if (!bootstrap.includes(marker)) fail(`native bootstrap marker missing: ${marker}`);
}
const sec = read('adminWww/js/eos-native-security.js');
if (sec.includes('querySelectorAll') || sec.includes('MutationObserver') || /addEventListener\(['"]click/.test(sec)) fail('security bridge touches DOM');
if (!read('adminWww/js/eos-policy-client.js').includes('never downgrade an admin to enduser')) fail('policy transient guard missing');

for (const rel of ['js/eos-role-bootstrap.js','js/eos-policy-client.js','js/eos-branding-sanitizer.js','js/nexowatt-native-shell.js','js/eos-native-security.js','js/eos-basic-settings.js','js/eos-role-ui.js','js/eos-account-management.js','js/eos-auto-update.js','css/eos-auto-update.css','js/eos-assistant.js','js/eos-manual-write-policy.js','css/nexowatt-native-shell.css']) {
  if (read(`src-admin/public/${rel}`) !== read(`adminWww/${rel}`)) fail(`source/build drift: ${rel}`);
}

const objects = readModuleChunks('src/components/Object/eosObjectBrowserWrite.ts');
if (!objects.includes('NEXOWATT_EOS_MANUAL_WRITE_POLICY')) fail('ObjectBrowser manual-write integration missing');
const guards = json('adminWww/eos-object-browser-guards.json');
if (guards.marker !== 'nexowatt-eos-admin8-manual-write-v1') fail('ObjectBrowser reviewed source guards missing');
for (const marker of ['restoreObjectAclManagedByEos','protected object change:']) if (!read('build/main.js').includes(marker)) fail(`backend marker missing: ${marker}`);
for (const marker of ["role: 'unknown'",'EOS security context temporarily unavailable','mf-manifest.json']) if (!read('build/lib/web.js').includes(marker)) fail(`web marker missing: ${marker}`);
for (const marker of ['getEosFirstLoginPasswordState','/nexowatt/account/first-password','/nexowatt/account/passwordless-claim','/nexowatt/account/reset','passwordSetupVersion','logoutRequired']) if (!read('build/lib/web.js').includes(marker)) fail(`first-login web marker missing: ${marker}`);
for (const marker of ['ensureEosRoleModel','system.group.installateur','system.group.endkunde','system.user.guest','eosPasswordSetupRequired','ensureEosSystemObjectAccess','ensureEosSmartHomeEnumAccess']) if (!read('build/main.js').includes(marker)) fail(`role backend marker missing: ${marker}`);
if (/async getEosRequestAccess\([^)]*\)[\s\S]{0,240}this\.getEosRequestAccess\(/.test(read('build/lib/web.js'))) fail('web role resolver is recursive');
if (!read('adminWww/js/eos-branding-sanitizer.js').includes("document.title = 'NexoWatt EOS – Energy Operation System'")) fail('branding sanitizer title guard missing');
if (!exists('src-admin/build-tools/eos-frontend-manifest.mjs') || !read('src-admin/vite.config.ts').includes('eosObjectBrowser')) fail('source-bound frontend build guards missing');

if (bad) process.exit(1);
console.log('[NexoWatt EOS stability] OK');
