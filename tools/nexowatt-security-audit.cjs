#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DEVELOPMENT_TESTS, verifyDevelopmentReceipt } = require('./nexowatt-admin8-development-check.cjs');
try {
    verifyDevelopmentReceipt();
    const root = path.resolve(__dirname, '..');
    const files = fs.readdirSync(path.join(root, 'test')).filter(name => /^eos-.*\.test\.cjs$/.test(name) && !DEVELOPMENT_TESTS.includes(name)).sort().map(name => `test/${name}`);
    const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit', windowsHide: true, timeout: 180000 });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
