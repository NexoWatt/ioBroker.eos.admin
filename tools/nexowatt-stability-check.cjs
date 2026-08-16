#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fail = msg => { console.error(`[NexoWatt EOS stability] ${msg}`); process.exitCode = 1; };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));

const version = json('package.json').version;
const packageLock = json('package-lock.json');
const srcPackageLock = json('src-admin/package-lock.json');
const ioPackage = json('io-package.json');
const buildInfo = json('NEXOWATT_EOS_BUILD_INFO.json');
const runtime = buildInfo.runtimeEntry;
const runtimeNumber = Number(String(runtime).replace(/^v/, ''));
const oldRuntimeVersions = Array.from({ length: Math.max(0, runtimeNumber - 54) }, (_, index) => index + 54);
if (!/^7\.9\.\d+$/.test(version)) fail(`unexpected package version ${version}`);
if (buildInfo.version !== version) fail('NEXOWATT_EOS_BUILD_INFO.json version differs');
if (ioPackage.version !== version) fail(`io-package.json top-level version ${ioPackage.version} differs`);
if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) fail('package-lock.json version differs');
if (srcPackageLock.version !== version || srcPackageLock.packages?.['']?.version !== version) fail('src-admin/package-lock.json version differs');
for (const [file, value] of [
  ['io-package.json', ioPackage.common.version],
  ['src-admin/package.json', json('src-admin/package.json').version],
  ['src-admin/src/version.json', json('src-admin/src/version.json').version],
]) if (value !== version) fail(`${file} version ${value} differs`);

const index = read('adminWww/index.html');
for (const marker of [`hostInit-${runtime}.js?v=${runtimeNumber}`,`index-CQZugZ1z-${runtime}.js?v=${runtimeNumber}`,`eos-policy-client.js?v=${runtimeNumber}`]) {
  if (!index.includes(marker)) fail(`index missing ${marker}`);
}
const brandingCacheVersion = Number(buildInfo.brandingCacheVersion ?? runtimeNumber);
if (!Number.isFinite(brandingCacheVersion)) fail(`invalid brandingCacheVersion ${buildInfo.brandingCacheVersion}`);
for (const marker of [`eos-branding.css?v=${brandingCacheVersion}`, `eos-branding.js?v=${brandingCacheVersion}`]) {
  if (!index.includes(marker)) fail(`index missing ${marker}`);
}
if (!index.includes(`eos-manual-write-policy.js?v=${runtimeNumber}`) || index.indexOf(`eos-manual-write-policy.js?v=${runtimeNumber}`) > index.indexOf(`hostInit-${runtime}.js?v=${runtimeNumber}`)) fail('manual-write policy is not synchronously loaded before the runtime');
if (/eos-(?:toolbar-ghost|adapter-surface)-cleanup/.test(index)) fail('heuristic v62+ cleanup script still loaded');
const mf = read('adminWww/mf-manifest.json');
if (!mf.includes(`remoteEntry-${runtime}.js`)) fail(`mf-manifest is not ${runtime}`);
if (mf.includes('-v58.js')) fail('mf-manifest still references v58');

for (const file of [
  `adminWww/assets/hostInit-${runtime}.js`,`adminWww/assets/index-CQZugZ1z-${runtime}.js`,
  `adminWww/assets/bootstrap-COulQZax-${runtime}.js`,`adminWww/assets/Objects-DPan0bzw-${runtime}.js`,
  `adminWww/assets/index-D2ymscJA-${runtime}.js`,`adminWww/remoteEntry-${runtime}.js`
]) if (!exists(file)) fail(`missing ${file}`);

const activeFiles = fs.readdirSync(path.join(root,'adminWww/assets')).filter(f => f.endsWith(`-${runtime}.js`));
for (const file of activeFiles) {
  const text = read(`adminWww/assets/${file}`);
  if (new RegExp(`-v(?:${oldRuntimeVersions.join('|')})\\.js`).test(text)) fail(`${file} imports an old runtime`);
}
if (new RegExp(`-v(?:${oldRuntimeVersions.join('|')})\\.js`).test(read(`adminWww/remoteEntry-${runtime}.js`))) fail(`remoteEntry-${runtime} imports old assets`);

const policy = read('adminWww/js/eos-policy-client.js');
if (!policy.includes('never downgrade an admin to enduser')) fail('policy client lacks transient-failure guard');
if (!policy.includes('NEXOWATT_EOS_DOM_COORDINATOR')) fail('shared DOM coordinator missing');
const loadedEosScripts = ['eos-policy-client.js','eos-branding.js','eos-security-ui.js','eos-role-ui.js'].map(file => read(`adminWww/js/${file}`));
const observerCount = loadedEosScripts.reduce((sum, text) => sum + (text.match(/new MutationObserver/g) || []).length, 0);
if (observerCount !== 1) fail(`expected one shared MutationObserver, found ${observerCount}`);
const role = read('adminWww/js/eos-role-ui.js');
if (role.includes("state.role = 'enduser';\n        window.NEXOWATT_EOS_ROLE_POLICY")) fail('role UI still downgrades on fetch failure');
const security = read('adminWww/js/eos-security-ui.js');
if (security.includes('using safe non-admin UI mode')) fail('security UI still forces non-admin on transient error');
if (!security.includes('if (!state.loaded) return;')) fail('security UI applies restrictions before policy is loaded');
const consoleQuiet = read('adminWww/js/eos-console-quiet.js');
if (/console\[(?:level|['\"]log)/.test(consoleQuiet) || consoleQuiet.includes('console.log =')) fail('console is still monkey-patched');

const main = read('build/main.js');
for (const marker of ['restoreObjectAclManagedByEos','300000','protected object change:']) if (!main.includes(marker)) fail(`backend missing ${marker}`);
const web = read('build/lib/web.js');
for (const marker of ["role: 'unknown'",'EOS security context temporarily unavailable','mf-manifest.json']) if (!web.includes(marker)) fail(`web backend missing ${marker}`);

const objects = read(`adminWww/assets/index-D2ymscJA-${runtime}.js`);
if (!objects.includes('common.write!==!1') && !objects.includes('common.write===!1')) fail('ObjectBrowser write semantics marker not found');
if (read('adminWww/js/eos-objects-state-tools.js').includes('NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED = true')) fail('unrestricted datapoint write mode is active');

// Compatibility shims must be tiny and point directly to the active runtime.
const defaultRoutePrefixes = ['Adapters-B5_jQ7DE','CustomTab-B0wqoazH','DeviceManager-BFmQeYQ1','EasyMode-B1d9Vdc4','Enums-DbWYxKOo','Files-Cd2HOzIE','Hosts-Bg8QzW5i','Instances-YdaGnS5a','Intro-DkwRiz1n','Logs-CsVPSLJH','Objects-DPan0bzw','Users-BgnBRgwU'];
const namedRoutePrefixes = ['AdapterUpdateDialog-BMg84Hpf','Config-hHK2UzGP','Fields-CX3rKuWb'];
for (const v of oldRuntimeVersions) {
  for (const file of [`adminWww/assets/bootstrap-COulQZax-v${v}.js`,`adminWww/assets/hostInit-v${v}.js`,`adminWww/assets/index-CQZugZ1z-v${v}.js`,`adminWww/assets/index-D2ymscJA-v${v}.js`,`adminWww/assets/sentry-B7YeoTAx-v${v}.js`]) {
    if (!exists(file)) continue;
    const text = read(file);
    if (text.length > 300 || !text.includes(runtime)) fail(`${file} is not a small ${runtime} shim`);
  }
  const remoteFile = `adminWww/remoteEntry-v${v}.js`;
  if (exists(remoteFile)) {
    const remoteText = read(remoteFile);
    if (remoteText.length > 300 || !remoteText.includes(`remoteEntry-${runtime}.js`)) fail(`${remoteFile} is not a small ${runtime} shim`);
  }
  for (const prefix of [...defaultRoutePrefixes, ...namedRoutePrefixes]) {
    const file = `adminWww/assets/${prefix}-v${v}.js`;
    if (!exists(file)) fail(`missing compatibility shim ${file}`);
    else {
      const text = read(file);
      if (text.length > 300 || !text.includes(`${prefix}-${runtime}.js`)) fail(`${file} is not a small ${runtime} route shim`);
    }
  }
}

for (const rel of ['js/eos-policy-client.js','js/eos-branding.js','js/eos-security-ui.js','js/eos-role-ui.js','js/eos-manual-write-policy.js','css/eos-branding.css']) {
  if (read(`src-admin/public/${rel}`) !== read(`adminWww/${rel}`)) fail(`public/build drift: ${rel}`);
}
if (!process.exitCode) console.log('[NexoWatt EOS stability] OK');


if (!exists('tools/nexowatt-patch-built-frontend.cjs')) fail('post-build ObjectBrowser patch tool missing');
if (!read('tasks.mts').includes('patchNexoWattBuiltFrontend')) fail('post-build ObjectBrowser patch is not wired into tasks.mts');

// Detailed datapoint and update checks are executed by check:eos-stability.
