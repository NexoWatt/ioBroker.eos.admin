#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const LEGACY_OVERLAYS = [
  'adminWww/js/eos-branding.js',
  'adminWww/js/eos-security-ui.js',
  'adminWww/js/eos-console-quiet.js',
  'adminWww/js/eos-objects-state-tools.js',
  'adminWww/js/eos-performance-guard.js',
  'adminWww/js/eos-runtime-fixes.js',
  'adminWww/js/eos-hard-logout.js',
  'adminWww/css/eos-branding.css',
  'src-admin/public/js/eos-branding.js',
  'src-admin/public/js/eos-security-ui.js',
  'src-admin/public/js/eos-console-quiet.js',
  'src-admin/public/js/eos-objects-state-tools.js',
  'src-admin/public/js/eos-performance-guard.js',
  'src-admin/public/js/eos-runtime-fixes.js',
  'src-admin/public/js/eos-hard-logout.js',
  'src-admin/public/css/eos-branding.css',
];

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function runtimeNumber(root) {
  const info = readJson(path.join(root, 'NEXOWATT_EOS_BUILD_INFO.json'));
  const value = Number(String(info.runtimeEntry || '').replace(/^v/, ''));
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid runtimeEntry in NEXOWATT_EOS_BUILD_INFO.json: ${info.runtimeEntry}`);
  }
  return value;
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile()) result.push(absolute);
    }
  }
  return result;
}

function isLegacyVersionedRuntime(file, activeRuntime) {
  const name = path.basename(file);
  const versionMatch = name.match(/-v(\d+)\.(?:js|js\.map|css|css\.map)$/i);
  if (versionMatch) return Number(versionMatch[1]) !== activeRuntime;
  const remoteMatch = name.match(/^remoteEntry-v(\d+)\.(?:js|js\.map)$/i);
  if (remoteMatch) return Number(remoteMatch[1]) !== activeRuntime;

  // Remove historical emergency bundles which predate the consolidated runtime
  // naming and must never survive in a current EOS Admin source tree.
  return /(?:DPWrite|DPAdapter|DPw\d+|NoLock|Unrestricted|force-version|delete-services-hardfix)/i.test(name) && /\.(?:js|js\.map)$/i.test(name);
}

function collectLegacyRuntimeFiles(root = DEFAULT_ROOT) {
  const activeRuntime = runtimeNumber(root);
  const scanRoots = [
    path.join(root, 'adminWww', 'assets'),
    path.join(root, 'adminWww'),
    path.join(root, 'src-admin', 'build', 'assets'),
    path.join(root, 'src-admin', 'build'),
  ];
  const files = new Set();
  for (const scanRoot of scanRoots) {
    for (const file of walkFiles(scanRoot)) {
      if (isLegacyVersionedRuntime(file, activeRuntime)) files.add(file);
    }
  }
  for (const rel of LEGACY_OVERLAYS) {
    const file = path.join(root, rel);
    if (fs.existsSync(file)) files.add(file);
  }
  return { activeRuntime, files: [...files].sort() };
}

function cleanLegacyRuntime(options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT);
  const dryRun = options.dryRun === true;
  const quiet = options.quiet === true;
  const silent = options.silent === true;
  const { activeRuntime, files } = collectLegacyRuntimeFiles(root);
  const removed = [];
  const failed = [];

  for (const file of files) {
    if (dryRun) {
      removed.push(file);
      continue;
    }
    try {
      try {
        fs.rmSync(file, { force: true });
      } catch (firstError) {
        // ZIP extraction tools on Windows may preserve a read-only bit. Make a
        // single controlled retry before reporting a real cleanup failure.
        try { fs.chmodSync(file, 0o666); } catch (_) { /* best effort */ }
        fs.rmSync(file, { force: true });
      }
      if (!fs.existsSync(file)) removed.push(file);
      else failed.push({ file, error: 'file still exists after removal' });
    } catch (error) {
      failed.push({ file, error: error?.message || String(error) });
    }
  }

  if (failed.length) {
    const details = failed.map(item => `${path.relative(root, item.file)}: ${item.error}`).join(os.EOL);
    throw new Error(`Could not remove ${failed.length} legacy runtime file(s):${os.EOL}${details}`);
  }

  if (!silent) {
    if (!quiet) {
      console.log(`[NexoWatt EOS runtime cleanup] OK (runtime v${activeRuntime}, removed ${removed.length} legacy file${removed.length === 1 ? '' : 's'})`);
    } else if (removed.length) {
      console.log(`[NexoWatt EOS runtime cleanup] removed ${removed.length} legacy runtime files before validation`);
    }
  }

  return { activeRuntime, removed };
}

if (require.main === module) {
  try {
    cleanLegacyRuntime({ dryRun: process.argv.includes('--dry-run'), quiet: process.argv.includes('--quiet') });
  } catch (error) {
    console.error(`[NexoWatt EOS runtime cleanup] ERROR: ${error?.stack || error}`);
    process.exit(1);
  }
}

module.exports = {
  LEGACY_OVERLAYS,
  collectLegacyRuntimeFiles,
  cleanLegacyRuntime,
  isLegacyVersionedRuntime,
};
