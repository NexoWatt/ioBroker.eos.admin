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

// Keep the value cell isolated from the row's onMouseDown selection. The row
// selection can otherwise re-render the virtual row before React emits click,
// so the native value dialog never opens. Do not call preventDefault here.
if (code.includes('data-eos-object-value-cell') && !code.includes('data-eos-scalar-capture') && !/onMouseDown:([A-Za-z_$][\w$]*)=>\{[^}]*stopPropagation/.test(code)) {
    const valueClick = /},onClick:([A-Za-z_$][\w$]*)=>\{var ([^;]+);if\(([A-Za-z_$][\w$]*)\)\{/;
    if (!valueClick.test(code)) fail('cannot locate the native writable value-cell click handler');
    code = code.replace(valueClick, '},onMouseDown:$1=>{$3&&$1.stopPropagation&&$1.stopPropagation()},onClick:$1=>{var $2;$3&&$1.stopPropagation&&$1.stopPropagation();if($3){');
    changed = true;
}

// Scalar values (number/string/states/json) must open the native value dialog
// in the capture phase. This bypasses stale row-selection/tooltip handlers while
// preserving the native direct paths for buttons and switches.
if (!code.includes('data-eos-scalar-capture')) {
    const scalarCapture = /onMouseDown:([A-Za-z_$][\w$]*)=>\{([A-Za-z_$][\w$]*)&&\1\.stopPropagation&&\1\.stopPropagation\(\)\},onClick:\1=>\{var /;
    if (!scalarCapture.test(code)) fail('cannot locate value-cell event block for scalar capture');
    code = code.replace(
        scalarCapture,
        'onMouseDown:$1=>{$2&&$1.stopPropagation&&$1.stopPropagation()},"data-eos-scalar-capture":$2&&!e.data.button&&!e.data.switch&&(N==null?void 0:N.type)!=="file"?"1":void 0,onClickCapture:$1=>{if($2&&!e.data.button&&!e.data.switch&&(N==null?void 0:N.type)!=="file"&&!(e.data.url&&$1.ctrlKey)){ $1.stopPropagation&&$1.stopPropagation();const V=this.states&&this.states[i]?this.states[i]:null;this.edit={val:V?V.val:"",q:V&&V.q||0,ack:!1,id:i};this.setState({updateOpened:!0})}},onClick:$1=>{var ',
    );
    changed = true;
}
if (!code.includes('data-eos-scalar-capture')) fail('scalar capture marker missing after patching');

// Expert mode must not expose the context-menu value editor for read-only states.
const contextWrite = /this\.state\.filter\.expertMode\|\|([A-Za-z_$][\w$]*)\.common\.write!==!1/;
if (contextWrite.test(code)) {
    code = code.replace(contextWrite, '$1.common.write!==!1');
    changed = true;
}

if (!code.includes('closest("[data-eos-object-value-cell]")')) {
    const rowMouseDown = /onMouseDown:([A-Za-z_$][\w$]*)=>\{this\.onSelect\(([A-Za-z_$][\w$]*)\);let ([A-Za-z_$][\w$]*);/;
    if (!rowMouseDown.test(code)) fail('cannot locate ObjectBrowser row mousedown handler');
    code = code.replace(rowMouseDown, 'onMouseDown:$1=>{if($1.target&&$1.target.closest&&$1.target.closest("[data-eos-object-value-cell]"))return;this.onSelect($2);let $3;');
    changed = true;
}

if (changed) fs.writeFileSync(bundlePath, code);
console.log(`[NexoWatt EOS post-build patch] OK (${asset}${changed ? ', patched' : ', already compliant'})`);
