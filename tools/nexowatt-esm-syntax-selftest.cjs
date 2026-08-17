#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const buildInfo = JSON.parse(fs.readFileSync(path.join(root, 'NEXOWATT_EOS_BUILD_INFO.json'), 'utf8'));
const runtime = buildInfo.runtimeEntry;
const assetsDir = path.join(root, 'adminWww', 'assets');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-esm-check-'));
const failures = [];

function checkModule(file) {
  const rel = path.relative(root, file);
  const target = path.join(tempDir, `${failures.length}-${path.basename(file)}.mjs`);
  fs.copyFileSync(file, target);
  const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${rel}\n${(result.stderr || result.stdout || '').trim()}`);
  }
}

function checkClassic(file) {
  const rel = path.relative(root, file);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${rel}\n${(result.stderr || result.stdout || '').trim()}`);
  }
}

try {
  const assetFiles = fs.readdirSync(assetsDir)
    .filter(name => name.endsWith('.js'))
    .map(name => path.join(assetsDir, name));
  for (const file of assetFiles) checkModule(file);

  for (const file of [
    path.join(root, 'adminWww', `remoteEntry-${runtime}.js`),
    path.join(root, 'adminWww', 'remoteEntry.js'),
  ]) {
    if (!fs.existsSync(file)) failures.push(`missing module ${path.relative(root, file)}`);
    else checkModule(file);
  }

  const classicDir = path.join(root, 'adminWww', 'js');
  for (const name of fs.readdirSync(classicDir).filter(name => name.endsWith('.js'))) {
    checkClassic(path.join(classicDir, name));
  }

  const activeBootstrap = path.join(assetsDir, `bootstrap-COulQZax-${runtime}.js`);
  if (!fs.existsSync(activeBootstrap)) failures.push(`missing active bootstrap ${path.relative(root, activeBootstrap)}`);
  else {
    const text = fs.readFileSync(activeBootstrap, 'utf8');
    if (/},\s*const\s+NEXOWATT_NATIVE_SHELL_VERSION/.test(text)) {
      failures.push(`${path.relative(root, activeBootstrap)} contains the invalid "},const" statement boundary`);
    }
  }
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`[NexoWatt EOS ESM syntax] ${failures.length} failure(s):\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log('[NexoWatt EOS ESM syntax] OK');
