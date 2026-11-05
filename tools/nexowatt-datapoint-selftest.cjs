#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { verifyObjectBrowserRuntime } = require('./nexowatt-objectbrowser-artifacts.cjs');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
verifyObjectBrowserRuntime();
const policy = read('adminWww/js/eos-manual-write-policy.js');
if (policy !== read('src-admin/public/js/eos-manual-write-policy.js'))
    throw new Error('Delivered manual write policy differs from reviewed source');
for (const marker of [
    'array',
    'object',
    'mixed',
    'normalizeStates',
    'prepareEditor',
    'parseEditorValue',
    'getDirectWriteValue',
]) {
    if (!policy.includes(marker)) throw new Error(`Manual write policy missing ${marker}`);
}
if (read('adminWww/index.html').includes('eos-objects-state-tools.js'))
    throw new Error('Legacy ObjectBrowser overlay is active');
console.log('[NexoWatt EOS datapoint selftest] OK: verified Admin8 source overlay and emitted module graph');
