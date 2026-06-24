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

if (pkg.name !== 'iobroker.eos-admin') fail(`package.json name must be iobroker.eos-admin, got ${pkg.name}`);
if (pkg.private !== false) fail('package.json private must be false for npm publishing');
if (pkg.version !== io.common.version) fail(`package.json and io-package.json versions differ: ${pkg.version} vs ${io.common.version}`);
if (io.common.name !== 'eos-admin') fail(`io-package common.name must be eos-admin, got ${io.common.name}`);
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
  'adminWww/css/eos-branding.css',
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
if (!branding.includes('v37 eos notification close compatibility')) fail('eos-branding.js lacks v37 notification close guard');
const mainBuild = fs.readFileSync(path.join(root, 'build/main.js'), 'utf8');
if (!mainBuild.includes('v37 BackItUp/runtime-adapter compatibility')) fail('build/main.js lacks v37 BackItUp compatibility guard');

console.log('[NexoWatt EOS package validation] OK');
