#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'adminWww/assets/index-D2ymscJA-v76.js'), 'utf8');
const fail = m => { console.error(`[NexoWatt EOS DP interaction selftest] ${m}`); process.exit(1); };
for (const marker of [
    '"data-eos-object-writable":y?"1":"0"',
    'onMouseDown:Y=>{y&&Y.stopPropagation&&Y.stopPropagation()}',
    'closest("[data-eos-object-value-cell]")',
    'this.setState({updateOpened:!0})',
    'data-eos-direct-control',
    'NEXOWATT_EOS_GET_WRITE_BEHAVIOR',
    'NEXOWATT_EOS_WRITE_MANUAL_STATE',
    'NEXOWATT_EOS_GET_DIRECT_WRITE_VALUE',
    'NEXOWATT_EOS_GET_WRITE_LABEL',
    'onKeyDown:Y=>{y&&(Y.key==="Enter"||Y.key===" ")',
    'onDoubleClick:Y=>{y&&Y.stopPropagation',
]) if (!code.includes(marker)) fail(`missing marker: ${marker}`);
if (/onMouseDown:Y=>\{[^}]*preventDefault/.test(code)) fail('mousedown preventDefault would suppress the native click');
if (!code.includes('.then(()=>{const ve=Date.now()')) fail('capture direct control does not update local UI after successful write');
if (!code.includes('eos-write-placeholder')) fail('write-only state has no visible action target');
console.log('[NexoWatt EOS DP interaction selftest] OK');
