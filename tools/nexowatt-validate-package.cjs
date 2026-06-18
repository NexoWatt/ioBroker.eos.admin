#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const fail = message => {
  console.error(`[NexoWatt EOS package validation] ${message}`);
  process.exit(1);
};
const exists = file => fs.existsSync(path.join(root, file));

const pkg = readJson('package.json');
const ioPkg = readJson('io-package.json');

if (pkg.name !== '@nexowatt/iobroker.admin') fail('package.json name must be @nexowatt/iobroker.admin');
if (pkg.private === true) fail('package.json private must not be true for public npm publishing');
if (pkg.license !== 'UNLICENSED') fail('package.json license must remain UNLICENSED');
if (!pkg.publishConfig || pkg.publishConfig.access !== 'public') fail('publishConfig.access must be public');
if (!ioPkg.common || ioPkg.common.name !== 'admin') fail('io-package.json common.name must remain admin');
if (ioPkg.common.license !== 'NexoWatt Proprietary') fail('io-package.json common.license must remain NexoWatt Proprietary');

[
  'adminWww/index.html',
  'adminWww/css/eos-branding.css',
  'adminWww/js/eos-branding.js',
  'adminWww/img/eos/nexowatt-192.png',
  'admin/admin.png',
  'LICENSE',
  'NEXOWATT_PROPRIETARY_LICENSE.md',
  'THIRD_PARTY_NOTICES.md'
].forEach(file => {
  if (!exists(file)) fail(`required file missing: ${file}`);
});

const index = fs.readFileSync(path.join(root, 'adminWww/index.html'), 'utf8');
const refs = [...index.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
for (const ref of refs) {
  if (/^(https?:|data:|blob:|mailto:|#)/i.test(ref)) continue;
  const clean = ref.split(/[?#]/)[0];
  if (!clean) continue;
  const normalized = clean.startsWith('/') ? clean.slice(1) : clean;
  const candidate = normalized.startsWith('adminWww/') ? normalized : `adminWww/${normalized}`;
  if (!exists(candidate)) fail(`adminWww/index.html references missing file: ${ref}`);
}

console.log('[NexoWatt EOS package validation] OK');
