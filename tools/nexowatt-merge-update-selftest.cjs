#!/usr/bin/env node
'use strict';
// Checks wrapper policy only. Actual overwrite behaviour is covered by
// eos-copy-update.test.cjs and the delivered old-repository overlay evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
for (const file of ['MERGE_UPDATE.ps1', 'MERGE_UPDATE.cmd', 'MERGE_UPDATE.sh']) {
    const script = read(file);
    assert.match(script, /npm(?:\.cmd)? publish --dry-run/);
    assert.doesNotMatch(script, /ExecutionPolicy\s+Bypass|nexowatt-apply-ems-overview|--ignore-scripts/);
    const commands = script.split('\n').filter(line => /(?:^|\s)npm(?:\.cmd)? publish/.test(line));
    assert.equal(commands.length, 1);
    assert.ok(commands[0].trim().endsWith('publish --dry-run'), 'Wrapper must never perform a real publication');
}
assert.match(read('MERGE_UPDATE.ps1'), /\$PSScriptRoot/);
assert.match(read('MERGE_UPDATE.cmd'), /%~dp0/);
assert.match(read('MERGE_UPDATE.sh'), /set -euo pipefail/);
const pkg = JSON.parse(read('package.json'));
for (const name of ['prepublishOnly', 'prepack']) {
    assert.ok(pkg.scripts[name].startsWith('node tools/nexowatt-prepare-copy-update.cjs && '));
    assert.doesNotMatch(pkg.scripts[name], /--ignore-scripts|--write|build:(?:frontend|backend)/);
}
assert.ok(pkg.scripts.prepack.endsWith('node tools/nexowatt-prebuilt-release-selftest.cjs'));
console.log('[NexoWatt EOS merge wrapper policy] OK (optional dry-run only; automatic hash-bound preparation remains in npm lifecycle)');
