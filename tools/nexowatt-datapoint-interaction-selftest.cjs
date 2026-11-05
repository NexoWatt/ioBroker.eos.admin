#!/usr/bin/env node
'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { verifyObjectBrowserRuntime } = require('./nexowatt-objectbrowser-artifacts.cjs');
verifyObjectBrowserRuntime();
// Exercise the actual source handlers/dialog, rather than relying on minifier variable names.
const result = spawnSync(process.execPath, [path.join(__dirname, 'nexowatt-admin8-objectbrowser-selftest.mjs')], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    timeout: 30000,
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Admin8 datapoint interaction regression (${result.status})`);
console.log('[NexoWatt EOS DP interaction selftest] OK');
