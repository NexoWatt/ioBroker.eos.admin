#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const usage = `Usage:\n  node tools/nexowatt-patch-repo.cjs <input-repo.json> <output-repo.json> [base-url]\n\nExample:\n  node tools/nexowatt-patch-repo.cjs repo-nexowatt.json repo-nexowatt.patched.json https://unpkg.com/@nexowatt/iobroker.admin@7.9.20\n`;

const [, , input, output, baseUrl] = process.argv;
if (!input || !output) {
  console.error(usage);
  process.exit(2);
}

const root = path.resolve(__dirname, '..');
const generator = path.join(root, 'tools', 'nexowatt-generate-repo-entry.cjs');
const generated = execFileSync(process.execPath, baseUrl ? [generator, baseUrl] : [generator], { encoding: 'utf8' });
const patch = JSON.parse(generated);
const repo = JSON.parse(fs.readFileSync(input, 'utf8'));

repo.admin = {
  ...(repo.admin || {}),
  ...patch.admin,
  name: 'admin',
  packetName: '@nexowatt/iobroker.admin'
};

if (repo['@nexowatt/iobroker.admin']) {
  delete repo['@nexowatt/iobroker.admin'];
}

fs.writeFileSync(output, JSON.stringify(repo, null, 2) + '\n');
console.log(`Patched admin entry in ${output}`);
console.log(`admin.version=${repo.admin.version}`);
console.log(`admin.packetName=${repo.admin.packetName}`);
