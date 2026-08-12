#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fail = msg => { console.error(`[NexoWatt EOS stability] ${msg}`); process.exitCode = 1; };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));

const version = json('package.json').version;
if (version !== '7.9.76') fail(`expected 7.9.76, got ${version}`);
for (const [file, value] of [
  ['io-package.json', json('io-package.json').common.version],
  ['src-admin/package.json', json('src-admin/package.json').version],
  ['src-admin/src/version.json', json('src-admin/src/version.json').version],
]) if (value !== version) fail(`${file} version ${value} differs`);

const index = read('adminWww/index.html');
for (const marker of ['hostInit-v76.js?v=76','index-CQZugZ1z-v76.js?v=76','eos-policy-client.js?v=76']) {
  if (!index.includes(marker)) fail(`index missing ${marker}`);
}
if (!index.includes('eos-manual-write-policy.js?v=76') || index.indexOf('eos-manual-write-policy.js?v=76') > index.indexOf('hostInit-v76.js?v=76')) fail('manual-write policy is not synchronously loaded before the runtime');
if (/eos-(?:toolbar-ghost|adapter-surface)-cleanup/.test(index)) fail('heuristic v62+ cleanup script still loaded');
const mf = read('adminWww/mf-manifest.json');
if (!mf.includes('remoteEntry-v76.js')) fail('mf-manifest is not v76');
if (mf.includes('-v58.js')) fail('mf-manifest still references v58');

for (const file of [
  'adminWww/assets/hostInit-v76.js','adminWww/assets/index-CQZugZ1z-v76.js',
  'adminWww/assets/bootstrap-COulQZax-v76.js','adminWww/assets/Objects-DPan0bzw-v76.js',
  'adminWww/assets/index-D2ymscJA-v76.js','adminWww/remoteEntry-v76.js'
]) if (!exists(file)) fail(`missing ${file}`);

const activeFiles = fs.readdirSync(path.join(root,'adminWww/assets')).filter(f => /-v76\.js$/.test(f));
for (const file of activeFiles) {
  const text = read(`adminWww/assets/${file}`);
  if (/-v(?:54|55|56|57|58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75)\.js/.test(text)) fail(`${file} imports an old runtime`);
}
if (/-v(?:54|55|56|57|58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75)\.js/.test(read('adminWww/remoteEntry-v76.js'))) fail('remoteEntry-v76 imports old assets');

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

const objects = read('adminWww/assets/index-D2ymscJA-v76.js');
if (!objects.includes('common.write!==!1') && !objects.includes('common.write===!1')) fail('ObjectBrowser write semantics marker not found');
if (read('adminWww/js/eos-objects-state-tools.js').includes('NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED = true')) fail('unrestricted datapoint write mode is active');

// Compatibility shims must be tiny and point to the single v76 runtime.
const defaultRoutePrefixes = ['Adapters-B5_jQ7DE','CustomTab-B0wqoazH','DeviceManager-BFmQeYQ1','EasyMode-B1d9Vdc4','Enums-DbWYxKOo','Files-Cd2HOzIE','Hosts-Bg8QzW5i','Instances-YdaGnS5a','Intro-DkwRiz1n','Logs-CsVPSLJH','Objects-DPan0bzw','Users-BgnBRgwU'];
const namedRoutePrefixes = ['AdapterUpdateDialog-BMg84Hpf','Config-hHK2UzGP','Fields-CX3rKuWb'];
for (const v of [54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75]) {
  for (const file of [`adminWww/assets/bootstrap-COulQZax-v${v}.js`,`adminWww/assets/hostInit-v${v}.js`,`adminWww/remoteEntry-v${v}.js`]) {
    if (!exists(file)) continue;
    const text = read(file);
    if (text.length > 300 || !text.includes('v76')) fail(`${file} is not a small v76 shim`);
  }
  const remoteFile = `adminWww/remoteEntry-v${v}.js`;
  if (exists(remoteFile)) {
    const remoteText = read(remoteFile);
    if (remoteText.length > 300 || !remoteText.includes('remoteEntry-v76.js')) fail(`${remoteFile} is not a small v76 shim`);
  }
  for (const prefix of [...defaultRoutePrefixes, ...namedRoutePrefixes]) {
    const file = `adminWww/assets/${prefix}-v${v}.js`;
    if (!exists(file)) fail(`missing compatibility shim ${file}`);
    else {
      const text = read(file);
      if (text.length > 300 || !text.includes(`${prefix}-v76.js`)) fail(`${file} is not a small v76 route shim`);
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
