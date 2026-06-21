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

console.log('[NexoWatt EOS package validation] OK');
