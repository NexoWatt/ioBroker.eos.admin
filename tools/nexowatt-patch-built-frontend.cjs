#!/usr/bin/env node
'use strict';

/**
 * Applies the NexoWatt EOS ObjectBrowser invariants after a clean upstream build.
 * The ObjectBrowser implementation is delivered by @iobroker/adapter-react-v5,
 * so these checks/patches must run against the generated shared bundle.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const adminWww = path.join(root, 'adminWww');
const fail = message => {
    throw new Error(`[NexoWatt EOS post-build patch] ${message}`);
};

const manifestPath = path.join(adminWww, 'mf-manifest.json');
if (!fs.existsSync(manifestPath)) fail('mf-manifest.json is missing');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const shared = (manifest.shared || []).find(entry => entry.name === '@iobroker/adapter-react-v5');
const asset = shared?.assets?.js?.sync?.[0];
if (!asset) fail('cannot locate @iobroker/adapter-react-v5 shared bundle');
const bundlePath = path.join(adminWww, asset);
if (!fs.existsSync(bundlePath)) fail(`shared bundle is missing: ${asset}`);

let code = fs.readFileSync(bundlePath, 'utf8');
let changed = false;

// Non-state objects (folder/channel/device/meta) never have a value. Rendering
// a synthetic state creates the confusing "(null)" value in the object table.
const guardVariants = [
    [
        /const ([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\.data\.obj;if\(!\1\|\|!this\.states\)return null;/,
        'const $1=$2.data.obj;if(!$1||$1.type!=="state"||!this.states)return null;',
    ],
    [
        /const ([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\.data\.obj;if\(!\1\)return null;this\.states=this\.states\|\|\{\};/,
        'const $1=$2.data.obj;if(!$1||$1.type!=="state")return null;this.states=this.states||{};',
    ],
];
if (!/\.data\.obj;if\(![A-Za-z_$][\w$]*\|\|[A-Za-z_$][\w$]*\.type!=="state"/.test(code)) {
    let patched = false;
    for (const [pattern, replacement] of guardVariants) {
        if (pattern.test(code)) {
            code = code.replace(pattern, replacement);
            patched = true;
            changed = true;
            break;
        }
    }
    if (!patched) fail('cannot establish the non-state value guard');
}

// Expert mode must not turn read-only registers into writable states. The
// ioBroker object flag common.write is the single source of truth in EOS.
const expertWrite = /let ([A-Za-z_$][\w$]*)=!this\.props\.notEditable&&([A-Za-z_$][\w$]*)==="state"&&\(this\.state\.filter\.expertMode\|\|\(([^)]*?\.write)\)!==!1\);/;
if (expertWrite.test(code)) {
    code = code.replace(expertWrite, 'let $1=!this.props.notEditable&&$2==="state"&&(($3)!==!1);');
    changed = true;
}
if (!/let [A-Za-z_$][\w$]*=!this\.props\.notEditable&&[A-Za-z_$][\w$]*==="state"&&\(\([^)]+\.write\)!==!1\)/.test(code) &&
    !code.includes('"state"&&((N==null?void 0:N.write)!==!1)')) {
    fail('strict common.write semantics were not found after patching');
}

// Historic EOS capture handlers blocked the native React click path.
if (/onMouseDown:[A-Za-z_$][\w$]*=>\{[^}]*stopPropagation/.test(code) && code.includes('data-eos-object-value-cell')) {
    fail('legacy ObjectBrowser mousedown capture handler is still present');
}

if (changed) fs.writeFileSync(bundlePath, code);
console.log(`[NexoWatt EOS post-build patch] OK (${asset}${changed ? ', patched' : ', already compliant'})`);
