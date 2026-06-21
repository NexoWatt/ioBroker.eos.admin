#!/usr/bin/env node
'use strict';

const pkg = require('../package.json');
const io = require('../io-package.json');

if (pkg.name !== 'iobroker.eos-admin') {
  throw new Error(`Unexpected package name: ${pkg.name}`);
}
if (!io.common || io.common.name !== 'eos-admin') {
  throw new Error('io-package.json common.name must be eos-admin for the standalone EOS Admin adapter');
}
if (pkg.version !== io.common.version) {
  throw new Error(`Version mismatch: package.json=${pkg.version}, io-package=${io.common.version}`);
}

const defaultBaseUrl = `https://unpkg.com/${pkg.name}@${pkg.version}`;
const baseUrl = (process.argv[2] || defaultBaseUrl).replace(/\/$/, '');
const iconUrl = /\/admin$/i.test(baseUrl) ? `${baseUrl}/admin.png` : `${baseUrl}/admin/admin.png`;

const entry = {
  'eos-admin': {
    name: 'eos-admin',
    version: pkg.version,
    title: 'NexoWatt EOS Admin',
    titleLang: io.common.titleLang,
    desc: io.common.desc,
    meta: `${baseUrl}/io-package.json`,
    icon: iconUrl
  }
};

console.log(JSON.stringify(entry, null, 2));
