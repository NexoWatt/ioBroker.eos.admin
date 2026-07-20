#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fail = msg => {
  console.error(`[NexoWatt EOS package validation] ${msg}`);
  process.exit(1);
};
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const exists = file => fs.existsSync(path.join(root, file));

const pkg = readJson('package.json');
const io = readJson('io-package.json');

const srcPkg = readJson('src-admin/package.json');
const srcLock = readJson('src-admin/package-lock.json');
const srcVersion = readJson('src-admin/src/version.json');
const buildInfo = readJson('NEXOWATT_EOS_BUILD_INFO.json');
const cacheTag = String(pkg.version).split('.').pop();

if (pkg.name !== 'iobroker.eos-admin') fail(`package.json name must be iobroker.eos-admin, got ${pkg.name}`);
if (pkg.private !== false) fail('package.json private must be false for npm publishing');
if (pkg.version !== io.common.version) fail(`package.json and io-package.json versions differ: ${pkg.version} vs ${io.common.version}`);
if (io.common.name !== 'eos-admin') fail(`io-package common.name must be eos-admin, got ${io.common.name}`);

if (srcPkg.version !== pkg.version) fail(`src-admin/package.json version differs: ${srcPkg.version} vs ${pkg.version}`);
if (srcLock.version !== pkg.version || srcLock.packages?.['']?.version !== pkg.version) fail('src-admin/package-lock.json top-level version is stale');
if (srcVersion.version !== pkg.version) fail(`src-admin/src/version.json version differs: ${srcVersion.version} vs ${pkg.version}`);
if (buildInfo.version !== pkg.version) fail(`NEXOWATT_EOS_BUILD_INFO.json version differs: ${buildInfo.version} vs ${pkg.version}`);
if (!String(buildInfo.uiVersion || '').startsWith(`v${cacheTag}-`)) fail(`build info uiVersion must start with v${cacheTag}-, got ${buildInfo.uiVersion}`);

if (io.common.packetName !== 'iobroker.eos-admin') fail(`io-package common.packetName must be iobroker.eos-admin, got ${io.common.packetName}`);
if (io.common.npmPackage !== 'iobroker.eos-admin') fail(`io-package common.npmPackage must be iobroker.eos-admin, got ${io.common.npmPackage}`);
if (io.native.port !== 8091 && io.native.port !== 8081) fail(`unexpected default port ${io.native.port}`);
if (io.common.stopBeforeUpdate !== false) fail('io-package common.stopBeforeUpdate must be false so EOS Admin can self-update from older UI builds');
if (io.common.dontDelete === true) fail('io-package common.dontDelete must not be true because it blocks clean updates');
if (io.common.nondeletable === true) fail('io-package common.nondeletable must not be true because it blocks updates');

const expectedBase = `https://unpkg.com/iobroker.eos-admin@${pkg.version}`;
for (const [field, expected] of Object.entries({
  extIcon: `${expectedBase}/admin/admin.svg`,
  readme: `${expectedBase}/README.md`,
  meta: `${expectedBase}/io-package.json`,
})) {
  if (io.common[field] !== expected) fail(`io-package common.${field} must be ${expected}, got ${io.common[field]}`);
}

for (const file of [
  'adminWww/index.html',
  'adminWww/js/eos-branding.js',
  'adminWww/js/eos-adapter-surface-cleanup.js',
  'adminWww/css/eos-branding.css',
  'src-admin/public/js/eos-branding.js',
  'src-admin/public/js/eos-adapter-surface-cleanup.js',
  'src-admin/public/css/eos-branding.css',
  'adminWww/img/eos/nexowatt-192.png',
  'admin/admin.svg',
  'LICENSE',
  'NEXOWATT_PROPRIETARY_LICENSE.md',
  'THIRD_PARTY_NOTICES.md'
]) {
  if (!exists(file)) fail(`missing required file: ${file}`);
}

const index = fs.readFileSync(path.join(root, 'adminWww/index.html'), 'utf8');
const refs = [...index.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:\?[^"#]*)?"/g)].map(m => m[1]);
const missing = refs.filter(ref => !exists(path.join('adminWww', ref)));
if (missing.length) fail(`adminWww/index.html references missing files:\n${missing.join('\n')}`);


const adminIndex = fs.readFileSync(path.join(root, 'adminWww/index.html'), 'utf8');
const sourceIndex = fs.readFileSync(path.join(root, 'src-admin/index.html'), 'utf8');
if (!adminIndex.includes('no-cache, no-store, must-revalidate') || !sourceIndex.includes('no-cache, no-store, must-revalidate')) fail('index files must disable stale HTML caching');
for (const asset of [
  'eos-console-quiet.js', 'eos-branding.css', 'eos-branding.js',
  'eos-adapter-surface-cleanup.js', 'eos-security-ui.js', 'eos-role-ui.js',
  'eos-assistant.js', 'eos-objects-state-tools.js'
]) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`${escaped}\\?v=${cacheTag}(?:["'])`).test(adminIndex)) fail(`adminWww/index.html cache tag is stale for ${asset}`);
  if (!new RegExp(`${escaped}\\?v=${cacheTag}(?:["'])`).test(sourceIndex)) fail(`src-admin/index.html cache tag is stale for ${asset}`);
}
for (const entry of ['hostInit-v61.js', 'index-CQZugZ1z-v69.js']) {
  const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`${escaped}\\?v=${cacheTag}(?:["'])`).test(adminIndex)) fail(`adminWww/index.html entry cache tag is stale for ${entry}`);
}

for (const file of ['eos-branding.js', 'eos-adapter-surface-cleanup.js', 'eos-console-quiet.js', 'eos-security-ui.js', 'eos-role-ui.js', 'eos-assistant.js', 'eos-objects-state-tools.js']) {
  const deployed = fs.readFileSync(path.join(root, 'adminWww/js', file));
  const source = fs.readFileSync(path.join(root, 'src-admin/public/js', file));
  if (!deployed.equals(source)) fail(`source/deployed script drift: ${file}`);
}
if (!fs.readFileSync(path.join(root, 'adminWww/css/eos-branding.css')).equals(fs.readFileSync(path.join(root, 'src-admin/public/css/eos-branding.css')))) {
  fail('source/deployed eos-branding.css drift');
}

for (let version = 54; version <= 60; version += 1) {
  for (const file of [`Objects-DPan0bzw-v${version}.js`, `index-D2ymscJA-v${version}.js`]) {
    const stat = fs.statSync(path.join(root, 'adminWww/assets', file));
    if (stat.size > 256) fail(`${file} must be a compatibility shim, got ${stat.size} bytes`);
  }
}

const bootstrapFiles = fs.readdirSync(path.join(root, 'adminWww/assets')).filter(f => /^bootstrap-.*\.js$/.test(f));
if (!bootstrapFiles.length) fail('missing bootstrap bundle');
const bootstrap = bootstrapFiles.map(f => fs.readFileSync(path.join(root, 'adminWww/assets', f), 'utf8')).join('\n');
if (!bootstrap.includes('window.adapterName="eos-admin"')) fail('frontend bootstrap does not set window.adapterName="eos-admin"');
if (bootstrap.includes('window.adapterName="admin"')) fail('frontend bootstrap still contains window.adapterName="admin"');

const webBuild = fs.readFileSync(path.join(root, 'build/lib/web.js'), 'utf8');
const branding = fs.readFileSync(path.join(root, 'adminWww/js/eos-branding.js'), 'utf8');
if (!webBuild.includes('refreshLifetime: 60 * 60 * 24 * 7')) fail('build/lib/web.js must keep upstream-compatible refresh lifetime');
if (!webBuild.includes('Follow upstream admin semantics again')) fail('build/lib/web.js does not contain the v36 session compatibility fix');
if (index.includes('eos-hard-logout.js')) fail('adminWww/index.html must not load the removed custom hard-logout timer');
if (!branding.includes('isAdapterConfigSurface')) fail('eos-branding.js lacks native adapter config safe-mode detection');
if (!branding.includes('Adapter UIs must remain 100% functional')) fail('eos-branding.js lacks native adapter config interaction guard');
if (!branding.includes('v38: All native Admin dialogs') || !branding.includes('ensurePopupCompatibility')) fail('eos-branding.js lacks v38 popup compatibility guard');

if (!branding.includes('patchDrawerHeader') || !branding.includes('ensureStandaloneNavToggle')) fail('eos-branding.js lacks the known-good v57 shell controls');
if (!branding.includes('removeSmallTopLeftNativeNexoWattTab') || !branding.includes('eos-small-top-left-native-tab-hidden')) fail('eos-branding.js lacks the bounded small top-left tab fallback');
const activeGraph = [
  fs.readFileSync(path.join(root, 'adminWww/assets/index-CQZugZ1z-v69.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'adminWww/assets/bootstrap-COulQZax-v69.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'adminWww/remoteEntry-v61.js'), 'utf8'),
].join('\n');
if (/bootstrap-COulQZax-v61\.js|(?:AdapterUpdateDialog|Adapters|Config|CustomTab|DeviceManager|EasyMode|Enums|Fields|Files|Hosts|Instances|Intro|Logs|Objects|Users)-[^"']+-v61\.js/.test(activeGraph)) fail('active v69 frontend graph still imports a v61 application runtime/route chunk');

const drawerSource = fs.readFileSync(path.join(root, 'src-admin/src/components/Drawer.tsx'), 'utf8');
const activeBootstrap = fs.readFileSync(path.join(root, 'adminWww/assets/bootstrap-COulQZax-v69.js'), 'utf8');
const brandingCss = fs.readFileSync(path.join(root, 'adminWww/css/eos-branding.css'), 'utf8');
if (!drawerSource.includes('getHeader(): JSX.Element {') || drawerSource.includes('getHeader(): JSX.Element | null')) fail('Drawer.tsx is not restored to the v57 header baseline');
if (!activeBootstrap.includes('getHeader(){const{state:e,handleNavigation:a}=this.props;')) fail('active bootstrap is not restored to the v57 Drawer.getHeader baseline');
if (!brandingCss.includes('v32: keep arrow button, remove empty left tile') || !brandingCss.includes('eos-small-top-left-native-tab-hidden')) fail('branding CSS lacks the v57 header baseline or narrow fallback');

const appSource = fs.readFileSync(path.join(root, 'src-admin/src/App.tsx'), 'utf8');
if (!appSource.includes('!small && this.state.drawerState !== DrawerStates.closed ? styles.hide : undefined')) fail('App.tsx is not restored to the v57 toolbar baseline');
if (!activeBootstrap.includes('style:{...styles.menuButton,...!e&&this.state.drawerState!==STATES.closed?styles.hide:void 0}')) fail('active bootstrap is not restored to the v57 desktop MenuIcon behavior');
if (!activeBootstrap.includes('this.renderLoggedUser(),this.state.drawerState!==STATES.opened')) fail('active bootstrap is not restored to the v57 compact identity behavior');
if (!activeBootstrap.includes('const version$b="7.9.69"')) fail('v69 bootstrap frontend version marker is stale');

for (const file of [
  'AdapterUpdateDialog-BMg84Hpf-v67.js', 'Adapters-B5_jQ7DE-v67.js', 'Config-hHK2UzGP-v67.js',
  'CustomTab-B0wqoazH-v67.js', 'DeviceManager-BFmQeYQ1-v67.js', 'EasyMode-B1d9Vdc4-v67.js',
  'Enums-DbWYxKOo-v67.js', 'Fields-CX3rKuWb-v67.js', 'Files-Cd2HOzIE-v67.js',
  'Hosts-Bg8QzW5i-v67.js', 'Instances-YdaGnS5a-v67.js', 'Intro-DkwRiz1n-v67.js',
  'Logs-CsVPSLJH-v67.js', 'Objects-DPan0bzw-v67.js', 'Users-BgnBRgwU-v67.js',
]) {
  if (!exists(path.join('adminWww/assets', file))) fail(`missing compatible route chunk: ${file}`);
  const chunk = fs.readFileSync(path.join(root, 'adminWww/assets', file), 'utf8');
  if (chunk.includes('bootstrap-COulQZax-v61.js')) fail(`${file} still imports bootstrap-v61`);
}

const activeAdapterReact = fs.readFileSync(path.join(root, 'adminWww/assets/index-D2ymscJA-v61.js'), 'utf8');
const activeObjects = fs.readFileSync(path.join(root, 'adminWww/assets/Objects-DPan0bzw-v67.js'), 'utf8');
const activeAdapters = fs.readFileSync(path.join(root, 'adminWww/assets/Adapters-B5_jQ7DE-v67.js'), 'utf8');
for (const marker of ['eos-object-value-cell', 'data-eos-object-writable']) {
  if (!activeAdapterReact.includes(marker)) fail(`active ObjectBrowser bundle lacks required marker: ${marker}`);
}
for (const marker of ['Cannot write state', 'common.write=false', 'enableStateValueEdit']) {
  if (!activeObjects.includes(marker)) fail(`active Objects bundle lacks native write-semantics marker: ${marker}`);
}
if (!activeAdapters.includes('install-specific-version')) fail('active Adapters bundle lacks the expert specific-version action');
const mainBuild = fs.readFileSync(path.join(root, 'build/main.js'), 'utf8');
if (!mainBuild.includes('v37 BackItUp/runtime-adapter compatibility')) fail('build/main.js lacks v37 BackItUp compatibility guard');

console.log('[NexoWatt EOS package validation] OK');
