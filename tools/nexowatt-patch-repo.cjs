#!/usr/bin/env node
'use strict';

const fs = require('fs');
const input = process.argv[2];
const output = process.argv[3] || input;
const version = process.argv[4] || require('../package.json').version;
const baseUrl = (process.argv[5] || `https://unpkg.com/iobroker.eos-admin@${version}`).replace(/\/$/, '');

if (!input) {
  console.error('Usage: node tools/nexowatt-patch-repo.cjs <repo-nexowatt.json> [output.json] [version] [base-url]');
  process.exit(2);
}

const io = require('../io-package.json');
const repo = JSON.parse(fs.readFileSync(input, 'utf8'));
repo['eos-admin'] = {
  ...(repo['eos-admin'] || {}),
  name: 'eos-admin',
  version,
  title: 'NexoWatt EOS Admin',
  titleLang: io.common.titleLang,
  desc: io.common.desc,
  meta: `${baseUrl}/io-package.json`,
  icon: /\/admin$/i.test(baseUrl) ? `${baseUrl}/admin.png` : `${baseUrl}/admin/admin.png`
};

fs.writeFileSync(output, JSON.stringify(repo, null, 2) + '\n');
console.log(`Patched ${input} -> ${output}`);
console.log(`repo["eos-admin"].version=${repo['eos-admin'].version}`);
