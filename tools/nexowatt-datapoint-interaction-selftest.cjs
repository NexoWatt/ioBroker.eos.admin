#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'adminWww/assets/index-D2ymscJA-v74.js'), 'utf8');
const fail = m => { console.error(`[NexoWatt EOS DP interaction selftest] ${m}`); process.exit(1); };
if (!code.includes('"data-eos-object-writable":y?"1":"0"')) fail('writable marker missing');
if (!code.includes('onMouseDown:Y=>{y&&Y.stopPropagation&&Y.stopPropagation()}')) fail('value-cell mousedown isolation missing');
if (!code.includes('y&&Y.stopPropagation&&Y.stopPropagation();if(y){')) fail('value-cell click isolation missing');
if (!code.includes('closest("[data-eos-object-value-cell]")')) fail('row selection guard missing');
if (!code.includes('this.setState({updateOpened:!0})')) fail('native value dialog path missing');
if (!code.includes('onKeyDown:Y=>{y&&(Y.key==="Enter"||Y.key===" ")')) fail('keyboard edit path missing');
if (/onMouseDown:Y=>\{[^}]*preventDefault/.test(code)) fail('mousedown preventDefault would suppress the native click');
console.log('[NexoWatt EOS DP interaction selftest] OK');
