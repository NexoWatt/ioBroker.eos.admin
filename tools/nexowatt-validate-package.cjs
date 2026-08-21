#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fail = msg => {
  console.error(`[NexoWatt EOS package validation] ${msg}`);
  process.exit(1);
};
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));

const pkg = readJson('package.json');
const pkgLock = readJson('package-lock.json');
const io = readJson('io-package.json');
const srcPkg = readJson('src-admin/package.json');
const srcPkgLock = readJson('src-admin/package-lock.json');
const srcVersion = readJson('src-admin/src/version.json');
const buildInfo = readJson('NEXOWATT_EOS_BUILD_INFO.json');

if (pkg.name !== 'iobroker.eos-admin') fail(`package.json name must be iobroker.eos-admin, got ${pkg.name}`);
if (pkg.private !== false) fail('package.json private must be false for npm publishing');

const prerelease = pkg.version.includes('-');
if (pkg.publishConfig?.tag !== 'latest') fail(`package must publish through npm latest, got ${pkg.publishConfig?.tag || '<unset>'}`);
if (!exists('.npmrc') || !/^\s*tag\s*=\s*latest\s*$/m.test(read('.npmrc'))) fail('repository must contain .npmrc with tag=latest');
if (prerelease) {
  if (pkg.nexowattReleasePolicy?.distTag !== 'latest') fail('accepted prerelease must record distTag=latest');
  if (pkg.nexowattReleasePolicy?.acceptedPrerelease !== pkg.version) fail('acceptedPrerelease must match the exact package version');
} else if (pkg.nexowattReleasePolicy?.acceptedPrerelease) {
  fail(`stable package must remove stale acceptedPrerelease ${pkg.nexowattReleasePolicy.acceptedPrerelease}`);
}
if (pkg.scripts['prepare:eos-release-defaults'] !== 'node tools/nexowatt-ensure-release-defaults.cjs') fail('release-default preparation script is missing');
if (pkg.scripts['test:eos-release-defaults'] !== 'node tools/nexowatt-release-defaults-selftest.cjs') fail('release-default selftest script is missing');
if (pkg.scripts['check:eos-publish-channel'] !== 'node tools/nexowatt-publish-channel-guard.cjs') fail('publish channel guard script is missing');
if (!pkg.scripts.prepublishOnly?.startsWith('npm run prepare:eos-release-defaults && npm run check:eos-publish-channel')) fail('prepublishOnly must normalize release defaults before the publish channel guard');
if (pkg.scripts['precheck:eos-package'] !== 'npm run prepare:eos-release-defaults && npm run clean:eos-runtime') fail('precheck:eos-package must normalize release defaults and clean stale runtime files');
if (pkg.scripts['precheck:eos-stability'] !== 'npm run prepare:eos-release-defaults && npm run clean:eos-runtime') fail('precheck:eos-stability must normalize release defaults and clean stale runtime files');
if (pkg.scripts['test:eos-publish-channel'] !== 'node tools/nexowatt-publish-channel-selftest.cjs') fail('publish channel selftest script is missing');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-publish-channel-selftest.cjs')) fail('stability check must execute the publish channel selftest');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-release-defaults-selftest.cjs')) fail('stability check must execute the release-default selftest');
if (io.native?.auth !== true) fail('fresh sales installations must default to authenticated access');
if (io.native?.eosHideLegacyBackupFromNonAdmins !== true) fail('internal BackItUp reserve must default to Admin/Service visibility');
if (io.native?.nexowattHideLegacyBackupFromNonAdmins !== true) fail('NexoWatt backup visibility compatibility flag must default to true');
for (const [label, value] of [
  ['io-package common.version', io.common?.version],
  ['io-package top-level version', io.version],
  ['package-lock version', pkgLock.version],
  ['package-lock root version', pkgLock.packages?.['']?.version],
  ['src-admin package version', srcPkg.version],
  ['src-admin lock version', srcPkgLock.version],
  ['src-admin lock root version', srcPkgLock.packages?.['']?.version],
  ['src-admin source version', srcVersion.version],
  ['build-info version', buildInfo.version],
]) if (value !== pkg.version) fail(`${label} must match package.json (${pkg.version}), got ${value}`);

if (io.common?.name !== 'eos-admin') fail(`io-package common.name must be eos-admin, got ${io.common?.name}`);
if (io.common?.packetName !== 'iobroker.eos-admin') fail(`io-package common.packetName must be iobroker.eos-admin, got ${io.common?.packetName}`);
if (io.common?.npmPackage !== 'iobroker.eos-admin') fail(`io-package common.npmPackage must be iobroker.eos-admin, got ${io.common?.npmPackage}`);
if (io.native?.port !== 8081) fail(`EOS Admin default port must be 8081, got ${io.native?.port}`);
if (io.common?.stopBeforeUpdate !== false) fail('io-package common.stopBeforeUpdate must be false');
if (io.common?.dontDelete === true || io.common?.nondeletable === true) fail('adapter-level delete flags must not block updates');

const expectedBase = `https://unpkg.com/iobroker.eos-admin@${pkg.version}`;
for (const [field, expected] of Object.entries({
  extIcon: `${expectedBase}/admin/admin.svg`,
  readme: `${expectedBase}/README.md`,
  meta: `${expectedBase}/io-package.json`,
})) if (io.common?.[field] !== expected) fail(`io-package common.${field} must be ${expected}, got ${io.common?.[field]}`);

const releaseNo = String(pkg.version).match(/^7\.9\.(\d+)/)?.[1];
const repositoryEntryFile = buildInfo.repositoryEntry || `nexowatt-eos-admin-repository-entry-v${releaseNo}.json`;
const repositoryEntry = readJson(repositoryEntryFile)['eos-admin'];
if (!repositoryEntry) fail(`${repositoryEntryFile} is missing eos-admin`);
if (repositoryEntry.version !== pkg.version) fail(`repository entry version must be ${pkg.version}, got ${repositoryEntry.version}`);
for (const [field, expected] of Object.entries({
  meta: `${expectedBase}/io-package.json`,
  icon: `${expectedBase}/admin/admin.png`,
  extIcon: `${expectedBase}/admin/admin.svg`,
  readme: `${expectedBase}/README.md`,
})) if (repositoryEntry[field] !== expected) fail(`repository entry ${field} must be ${expected}, got ${repositoryEntry[field]}`);

for (const file of [
  'adminWww/index.html',
  'adminWww/js/eos-manual-write-policy.js',
  'adminWww/js/eos-role-bootstrap.js',
  'adminWww/js/eos-branding-sanitizer.js',
  'adminWww/js/eos-policy-client.js',
  'adminWww/js/nexowatt-native-shell.js',
  'adminWww/js/eos-native-security.js',
  'adminWww/js/eos-basic-settings.js',
  'adminWww/js/eos-role-ui.js',
  'adminWww/js/eos-account-management.js',
  'adminWww/js/eos-assistant.js',
  'adminWww/css/nexowatt-native-shell.css',
  'adminWww/img/eos/nexowatt-192.png',
  'src-admin/src/components/NexoWattNavIcon.tsx',
  'src-admin/src/components/Drawer.tsx',
  'src-admin/src/components/DrawerItem.tsx',
  'admin/admin.svg',
  'LICENSE',
  'NEXOWATT_PROPRIETARY_LICENSE.md',
  'THIRD_PARTY_NOTICES.md',
  'README_STABILITY_V7.9.92.md',
  'PUBLISH_STABLE_V7.9.92.md',
  'INSTALL_TEST_V7.9.92.md',
  'RELEASE_ACCEPTANCE_V7.9.92.md',
  'tools/nexowatt-patch-built-frontend.cjs',
  'tools/nexowatt-native-shell-selftest.cjs',
  'tools/nexowatt-clean-legacy-runtime.cjs',
  'tools/nexowatt-runtime-cleanup-selftest.cjs',
  'tools/nexowatt-esm-syntax-selftest.cjs',
  'tools/nexowatt-import-integrity-selftest.cjs',
  'tools/nexowatt-entrypoint-smoke-selftest.cjs',
  'tools/nexowatt-role-access-selftest.cjs',
  'tools/nexowatt-first-login-selftest.cjs',
  'tools/nexowatt-account-management-selftest.cjs',
  'tools/nexowatt-modern-ui-selftest.cjs',
  'tools/nexowatt-login-layout-selftest.cjs',
  'tools/nexowatt-internal-reserve-selftest.cjs',
  'tools/nexowatt-branding-selftest.cjs',
  'tools/nexowatt-publish-channel-guard.cjs',
  'tools/nexowatt-publish-channel-selftest.cjs',
  'tools/nexowatt-ensure-release-defaults.cjs',
  'tools/nexowatt-release-defaults-selftest.cjs',
  'tools/nexowatt-default-port-selftest.cjs',
  '.npmrc',
  repositoryEntryFile,
]) if (!exists(file)) fail(`missing required file: ${file}`);

const index = read('adminWww/index.html');
const refs = [...index.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:\?[^"#]*)?"/g)].map(m => m[1]);
const missing = refs.filter(ref => !exists(path.join('adminWww', ref)));
if (missing.length) fail(`adminWww/index.html references missing files:\n${missing.join('\n')}`);

const runtime = buildInfo.runtimeEntry;
const runtimeNumber = Number(String(runtime).replace(/^v/, ''));
const shellCache = Number(buildInfo.shellCacheVersion ?? buildInfo.nativeShellVersion ?? runtimeNumber);
const shellTag = String(buildInfo.shellCacheTag || shellCache);
if (!runtime || !Number.isFinite(runtimeNumber)) fail(`invalid runtimeEntry ${runtime}`);
if (!Number.isFinite(shellCache)) fail(`invalid shellCacheVersion ${buildInfo.shellCacheVersion}`);
for (const marker of [
  `hostInit-${runtime}.js?v=${runtimeNumber}`,
  `index-CQZugZ1z-${runtime}.js?v=${runtimeNumber}`,
  `eos-manual-write-policy.js?v=${shellTag}`,
  `nexowatt-native-shell.css?v=${shellTag}`,
  `nexowatt-native-shell.js?v=${shellTag}`,
  `eos-native-security.js?v=${shellTag}`,
]) if (!index.includes(marker)) fail(`adminWww/index.html missing ${marker}`);

if (!index.includes(`eos-role-bootstrap.js?v=${shellTag}`)) fail('role bootstrap cache key mismatch');
if (!index.includes(`eos-branding-sanitizer.js?v=${shellTag}`)) fail('branding sanitizer cache key mismatch');
if (!index.includes(`eos-role-ui.js?v=${shellTag}`)) fail('role UI cache key mismatch');
if (!index.includes(`eos-account-management.js?v=${shellTag}`)) fail('account management cache key mismatch');
if (!index.includes(`eos-assistant.js?v=${shellTag}`)) fail('EOS Assist cache key mismatch');
if (index.indexOf(`eos-manual-write-policy.js?v=${shellTag}`) > index.indexOf(`hostInit-${runtime}.js?v=${runtimeNumber}`)) fail('manual-write policy must load before the React runtime');
if (!index.includes('class="eos-native-shell"')) fail('native NexoWatt shell class missing');
for (const legacy of ['eos-branding.js', 'eos-security-ui.js', 'eos-console-quiet.js', 'eos-objects-state-tools.js']) {
  if (index.includes(legacy)) fail(`legacy browser overlay still loaded: ${legacy}`);
}

const activeBootstrapFile = `adminWww/assets/bootstrap-COulQZax-${runtime}.js`;
for (const file of [
  `adminWww/assets/hostInit-${runtime}.js`,
  `adminWww/assets/index-CQZugZ1z-${runtime}.js`,
  activeBootstrapFile,
  `adminWww/assets/Objects-DPan0bzw-${runtime}.js`,
  `adminWww/assets/index-D2ymscJA-${runtime}.js`,
  `adminWww/remoteEntry-${runtime}.js`,
]) if (!exists(file)) fail(`missing active runtime file ${file}`);

const bootstrap = read(activeBootstrapFile);
if (!bootstrap.includes('window.adapterName="eos-admin"')) fail('frontend bootstrap does not set window.adapterName="eos-admin"');
if (bootstrap.includes('window.adapterName="admin"')) fail('frontend bootstrap still contains window.adapterName="admin"');
for (const marker of ['NEXOWATT_TAB_ICON', 'nexowatt-native-nav-item', 'nexowatt-native-nav-icon', 'tabName:h.name', 'NexoWatt EOS', 'Zugänge & Rechte']) {
  if (!bootstrap.includes(marker)) fail(`active bootstrap missing native navigation marker ${marker}`);
}

const drawer = read('src-admin/src/components/Drawer.tsx');
const drawerItem = read('src-admin/src/components/DrawerItem.tsx');
const navIcon = read('src-admin/src/components/NexoWattNavIcon.tsx');
for (const marker of ['getNexoWattTabTitle', 'getNexoWattTabIcon', "'tab-intro': 'Übersicht'", "'tab-users': 'Zugänge & Rechte'", 'System-Notfallsicherung', 'NexoWatt Sicherung']) {
  if (!drawer.includes(marker)) fail(`Drawer source missing ${marker}`);
}
if (!drawerItem.includes('className="nexowatt-native-nav-item"') || !drawerItem.includes('data-eos-tab={tabName}')) fail('DrawerItem is not native-shell aware');
if (!navIcon.includes('eos-native-nav-icon-source') || !navIcon.includes('nexowatt-native-nav-icon')) fail('native SVG navigation icon component is incomplete');

const shell = read('adminWww/js/nexowatt-native-shell.js');
const shellCss = read('adminWww/css/nexowatt-native-shell.css');
const nativeSecurity = read('adminWww/js/eos-native-security.js');
const accountManagement = read('adminWww/js/eos-account-management.js');
if (!shell.includes(`const VERSION = 'v${shellCache}-nexowatt-native-shell`)) fail(`native shell version marker v${shellCache} missing`);
if (!shell.includes('Navigation labels and') || !shell.includes('rendered natively by Drawer.tsx')) fail('native shell ownership guard missing');
if (shell.includes('innerHTML = cfg.svg') || shell.includes('textNode.textContent = cfg.label')) fail('native shell still rewrites navigation icons or labels after render');
if (!shell.includes('NEXOWATT_EOS_DOM_COORDINATOR')) fail('native shell does not use the shared DOM coordinator');
if (!shellCss.includes('.nexowatt-native-nav-item') || !shellCss.includes('.eos-native-nav-icon') || !shellCss.includes('.nexowatt-native-nav-icon')) fail('native shell CSS lacks React navigation selectors');
if (!nativeSecurity.includes('shouldBlockInstanceDelete')) fail('minimal native security API missing instance protection');
if (/addEventListener\(['"]click['"]/.test(nativeSecurity)) fail('native security must not globally intercept clicks');
if (!accountManagement.includes('NEXOWATT_EOS_ACCOUNT_MANAGEMENT') || !accountManagement.includes('X-NexoWatt-EOS-Account-Reset') || !accountManagement.includes('ensureEntrySurface')) fail('account-management runtime is incomplete');
if (accountManagement.includes("launcher.className = 'eos-account-management-launcher'")) fail('account management must not create a separate launcher');
if (accountManagement.includes('new MutationObserver')) fail('account-management runtime adds a second broad DOM observer');
if (read('src-admin/public/js/eos-account-management.js') !== accountManagement) fail('account-management source/build drift');
const roleBootstrap = read('adminWww/js/eos-role-bootstrap.js');
if (!roleBootstrap.includes('installIntegratedFirstLogin') || !roleBootstrap.includes('v91 compact normal-login first activation')) fail('compact integrated first-login is incomplete');
if (/data-eos-account=|selector\.innerHTML/.test(roleBootstrap)) fail('login role buttons must not enlarge the normal login card');
if (!roleBootstrap.includes('nexowatt/account/passwordless-status') || !roleBootstrap.includes('eligibility.allowed')) fail('server-checked first-login eligibility is incomplete');
if (roleBootstrap.includes('installPasswordlessFirstLoginLauncher')) fail('old first-login launcher remains active');
const assistant = read('adminWww/js/eos-assistant.js');
if (!assistant.includes('eos-assist-header-root') || !assistant.includes('insertBefore(root, userAnchor)')) fail('EOS Assist is not header-integrated');

const mf = read('adminWww/mf-manifest.json');
if (!mf.includes(`remoteEntry-${runtime}.js`) || !mf.includes(`index-D2ymscJA-${runtime}.js`)) fail('module federation manifest is not on the active runtime');

const webBuild = read('build/lib/web.js');
if (!webBuild.includes('refreshLifetime: 60 * 60 * 24 * 7')) fail('build/lib/web.js must keep upstream-compatible refresh lifetime');
if (!webBuild.includes('Follow upstream admin semantics again')) fail('build/lib/web.js lacks session compatibility fix');
const mainBuild = read('build/main.js');
if (!mainBuild.includes('v37 BackItUp/runtime-adapter compatibility')) fail('build/main.js lacks BackItUp compatibility guard');

if (!pkg.scripts['nexowatt:patch-built-frontend']) fail('missing nexowatt:patch-built-frontend script');
if (pkg.scripts['check:eos-esm'] !== 'node tools/nexowatt-esm-syntax-selftest.cjs') fail('check:eos-esm script is missing or incorrect');
if (pkg.scripts['check:eos-imports'] !== 'node tools/nexowatt-import-integrity-selftest.cjs') fail('check:eos-imports script is missing or incorrect');
if (pkg.scripts['check:eos-entry'] !== 'node tools/nexowatt-entrypoint-smoke-selftest.cjs') fail('check:eos-entry script is missing or incorrect');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-esm-syntax-selftest.cjs')) fail('ESM syntax selftest is not part of check:eos-stability');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-import-integrity-selftest.cjs')) fail('import integrity selftest is not part of check:eos-stability');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-entrypoint-smoke-selftest.cjs')) fail('entrypoint smoke selftest is not part of check:eos-stability');
if (pkg.scripts['clean:eos-runtime'] !== 'node tools/nexowatt-clean-legacy-runtime.cjs') fail('clean:eos-runtime script is missing or incorrect');
if (pkg.scripts.prepack !== 'node tools/nexowatt-clean-legacy-runtime.cjs --quiet') fail('prepack must silently clean stale runtime files');
if (!pkg.scripts.build?.includes('npm run clean:eos-runtime')) fail('build must finish with runtime cleanup');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-role-access-selftest.cjs')) fail('role access selftest is not part of check:eos-stability');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-first-login-selftest.cjs')) fail('first-login selftest is not part of check:eos-stability');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-account-management-selftest.cjs')) fail('account-management selftest is not part of check:eos-stability');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-modern-ui-selftest.cjs')) fail('modern-UI selftest is not part of check:eos-stability');
if (pkg.scripts['test:eos-login-layout'] !== 'node tools/nexowatt-login-layout-selftest.cjs') fail('login-layout selftest script is missing or incorrect');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-login-layout-selftest.cjs')) fail('login-layout selftest is not part of check:eos-stability');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-internal-reserve-selftest.cjs')) fail('internal reserve selftest is not part of check:eos-stability');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-branding-selftest.cjs')) fail('branding selftest is not part of check:eos-stability');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-native-shell-selftest.cjs')) fail('native shell selftest is not part of check:eos-stability');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-assistant-separation-selftest.cjs')) fail('assistant separation selftest is not part of check:eos-stability');
if (!exists('adminWww/img/eos/nexowatt-eos-brand-wide.png')) fail('new NexoWatt EOS brand logo asset missing');
if (!pkg.scripts['check:eos-stability']?.includes('nexowatt-runtime-cleanup-selftest.cjs')) fail('runtime cleanup selftest is not part of check:eos-stability');
if (!read('tasks.mts').includes('patchNexoWattBuiltFrontend')) fail('tasks.mts does not execute the EOS post-build frontend patch');

console.log('[NexoWatt EOS package validation] OK');
