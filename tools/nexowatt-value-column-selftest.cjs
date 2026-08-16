#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fail = msg => { console.error(`[NexoWatt EOS value column] ${msg}`); process.exit(1); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const src = read('src-admin/public/css/eos-branding.css');
const built = read('adminWww/css/eos-branding.css');
if (src !== built) fail('source and delivered branding CSS differ');
if (!src.includes('v7.9.78: value-column alignment')) fail('v7.9.78 alignment marker missing');
const block = src.slice(src.indexOf('v7.9.78: value-column alignment'));
if (!block.includes('justify-content: flex-end !important')) fail('value content is not right-aligned');
if (/(?:^|\n)\s*width:\s*100%\s*!important/.test(block)) fail('alignment patch must not override native value-column width');
const index = read('adminWww/index.html');
const runtime = JSON.parse(fs.readFileSync(path.join(root, 'NEXOWATT_EOS_BUILD_INFO.json'), 'utf8')).runtimeEntry;
const runtimeNumber = Number(String(runtime).replace(/^v/, ''));
if (!index.includes(`css/eos-branding.css?v=${runtimeNumber}`)) fail(`branding CSS cache key is not ${runtime}`);
console.log('[NexoWatt EOS value column] OK');
