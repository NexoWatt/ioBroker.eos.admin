#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fail = message => {
    console.error(`[NexoWatt EOS merge update selftest] ${message}`);
    process.exit(1);
};
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

for (const file of [
    'MERGE_UPDATE.ps1',
    'MERGE_UPDATE.cmd',
    'MERGE_UPDATE_README_V7.9.95.md',
    'tools/nexowatt-sync-release-version.cjs',
    'tools/nexowatt-version-sync-selftest.cjs',
]) {
    if (!exists(file)) fail(`${file} is missing`);
}

const ps = read('MERGE_UPDATE.ps1');
for (const marker of [
    '$PSScriptRoot',
    'nexowatt-sync-release-version.cjs',
    'npm run check:eos-package',
    'npm run check:eos-stability',
    'npm pack --dry-run',
]) {
    if (!ps.includes(marker)) fail(`MERGE_UPDATE.ps1 is missing ${marker}`);
}
if (/npm\s+publish/i.test(ps)) fail('MERGE_UPDATE.ps1 must never publish automatically');

const cmd = read('MERGE_UPDATE.cmd');
if (!cmd.includes('MERGE_UPDATE.ps1') || !/ExecutionPolicy\s+Bypass/i.test(cmd)) {
    fail('MERGE_UPDATE.cmd does not start the guarded PowerShell verifier');
}

const pkg = JSON.parse(read('package.json'));
if (pkg.scripts['sync:eos-version'] !== 'node tools/nexowatt-sync-release-version.cjs') {
    fail('sync:eos-version script is not canonical');
}
if (!pkg.scripts['precheck:eos-package']?.startsWith('npm run sync:eos-version')) {
    fail('package validation does not self-heal stale merged version files');
}
if (!pkg.scripts.prepublishOnly?.startsWith('npm run sync:eos-version')) {
    fail('npm publishing does not self-heal stale merged version files');
}

console.log('[NexoWatt EOS merge update selftest] OK (flat overwrite + automatic version repair + guarded verification)');
