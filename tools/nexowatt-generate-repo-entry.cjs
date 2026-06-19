#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const ioPkg = JSON.parse(fs.readFileSync(path.join(root, 'io-package.json'), 'utf8'));

if (pkg.name !== '@nexowatt/iobroker.admin') {
  throw new Error(`Unexpected package name: ${pkg.name}`);
}
if (!ioPkg.common || ioPkg.common.name !== 'admin') {
  throw new Error('io-package.json common.name must remain admin for the admin replacement workflow');
}
if (pkg.version !== ioPkg.common.version) {
  throw new Error(`Version mismatch: package.json=${pkg.version}, io-package=${ioPkg.common.version}`);
}

const defaultBaseUrl = `https://unpkg.com/${pkg.name}@${pkg.version}`;
const baseUrl = (process.argv[2] || defaultBaseUrl).replace(/\/$/, '');
const common = ioPkg.common;
const entry = {
  admin: {
    ...common,
    name: 'admin',
    version: pkg.version,
    packetName: pkg.name,
    title: 'NexoWatt EOS Admin',
    titleLang: common.titleLang,
    desc: common.desc || {
      de: 'NexoWatt EOS Administrationsoberfläche für Energy Operation System Installationen.',
      en: 'NexoWatt EOS administration interface for Energy Operation System installations.'
    },
    meta: `${baseUrl}/io-package.json`,
    icon: `${baseUrl}/admin/admin.png`,
    extIcon: `${baseUrl}/admin/admin.png`,
    readme: `${baseUrl}/README.md`,
    repoVendorTime: new Date().toISOString()
  }
};

console.log(JSON.stringify(entry, null, 2));
