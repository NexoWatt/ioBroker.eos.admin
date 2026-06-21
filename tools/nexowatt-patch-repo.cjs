#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3] || input;
const version = process.argv[4] || '7.9.22';

if (!input) {
  console.error('Usage: node nexowatt-patch-repo.cjs <repo-nexowatt.json> [output.json] [version]');
  process.exit(2);
}

const repo = JSON.parse(fs.readFileSync(input, 'utf8'));
repo.admin = {
  ...(repo.admin || {}),
  name: 'admin',
  version,
  packetName: '@nexowatt/iobroker.admin',
  title: 'NexoWatt EOS Admin',
  titleLang: {
    ...(repo.admin && repo.admin.titleLang ? repo.admin.titleLang : {}),
    de: 'NexoWatt EOS Admin',
    en: 'NexoWatt EOS Admin'
  },
  desc: {
    ...(repo.admin && repo.admin.desc ? repo.admin.desc : {}),
    de: 'NexoWatt EOS Administrationsoberfläche für Energy Operation System Installationen.',
    en: 'NexoWatt EOS administration interface for Energy Operation System installations.'
  },
  meta: 'https://iobroker.live/repo/admin/io-package.json',
  icon: 'https://iobroker.live/repo/admin/admin.png'
};

fs.writeFileSync(output, JSON.stringify(repo, null, 2) + '\n');
console.log(`Patched ${input} -> ${output}`);
console.log(`repo.admin.version=${repo.admin.version}`);
console.log(`repo.admin.packetName=${repo.admin.packetName}`);
