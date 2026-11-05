#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const { runtimeRoot, safePath, loadFrontendManifest } = require('./nexowatt-frontend-artifacts.cjs');
const manifest = loadFrontendManifest();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-esm-check-'));
const failures = [];

try {
  const files = Object.keys({ ...manifest.chunks, ...(manifest.assets || {}) }).map(name => ({ type: 'module', file: safePath(runtimeRoot, name) }));
  function classicFiles(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Runtime symlink is not allowed');
      if (entry.isDirectory()) classicFiles(file);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push({ type: 'classic', file });
    }
  }
  classicFiles(path.join(runtimeRoot, 'js'));
  classicFiles(path.join(runtimeRoot, 'static', 'js'));

  const listPath = path.join(tempDir, 'files.json');
  const checkerPath = path.join(tempDir, 'checker.cjs');
  fs.writeFileSync(listPath, JSON.stringify(files));
  fs.writeFileSync(checkerPath, `
'use strict';
const fs = require('fs');
const vm = require('vm');
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const errors = [];
for (const row of rows) {
  try {
    const source = fs.readFileSync(row.file, 'utf8');
    if (row.type === 'module') new vm.SourceTextModule(source, { identifier: row.file });
    else new vm.Script(source, { filename: row.file });
  } catch (error) {
    errors.push(row.file + '\\n' + (error && error.stack ? error.stack : String(error)));
  }
}
if (errors.length) {
  console.error(errors.join('\\n\\n'));
  process.exit(1);
}
`);

  const checked = spawnSync(process.execPath, ['--experimental-vm-modules', checkerPath, listPath], {
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (checked.error) failures.push(`syntax checker failed: ${checked.error.message}`);
  if (checked.status !== 0) failures.push((checked.stderr || checked.stdout || 'syntax checker failed').trim());
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`[NexoWatt EOS ESM syntax] ${failures.length} failure(s):\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log('[NexoWatt EOS ESM syntax] OK');
