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

// EOS v7.9.75: type-aware manual controls. Buttons/triggers and boolean
// switches are direct controls in both modes when policy permits. Safety-
// relevant states are exposed only in expert mode by the central policy.
if (!code.includes('NEXOWATT_EOS_GET_WRITE_BEHAVIOR')) {
    const editableBefore = 'const D=this.props.multiSelect&&this.objects[i]&&(!this.props.types||this.props.types.includes(this.objects[i].type))?a.createElement(u.Checkbox,{style:z.checkBox,checked:this.state.selected.includes(i)}):null;let y=!this.props.notEditable&&n==="state"&&((N==null?void 0:N.write)!==!1);this.props.objectBrowserViewFile&&(N==null?void 0:N.type)==="file"&&(y=!0);';
    const editableAfter = 'const D=this.props.multiSelect&&this.objects[i]&&(!this.props.types||this.props.types.includes(this.objects[i].type))?a.createElement(u.Checkbox,{style:z.checkBox,checked:this.state.selected.includes(i)}):null;e.data.eosWriteBehavior=typeof window!=="undefined"&&typeof window.NEXOWATT_EOS_GET_WRITE_BEHAVIOR==="function"?window.NEXOWATT_EOS_GET_WRITE_BEHAVIOR(i,r,e,this.state.filter.expertMode):e.data.button?"button":e.data.switch||(N==null?void 0:N.type)==="boolean"?"switch":"dialog";let y=!this.props.notEditable&&n==="state"&&((N==null?void 0:N.write)!==!1)&&e.data.eosWriteBehavior!=="expert-only"&&e.data.eosWriteBehavior!=="readonly";this.props.objectBrowserViewFile&&(N==null?void 0:N.type)==="file"&&(y=!0);';
    if (!code.includes(editableBefore)) fail('cannot locate valueEditable block for type-aware policy');
    code = code.replace(editableBefore, editableAfter);

    const writableMarker = '"data-eos-object-writable":y?"1":"0",';
    if (!code.includes(writableMarker)) fail('cannot locate writable value-cell marker');
    code = code.replace(writableMarker, '"data-eos-object-writable":y?"1":"0","data-eos-write-behavior":e.data.eosWriteBehavior,"data-eos-expert-only":e.data.eosWriteBehavior==="expert-only"?"1":"0",');

    const captureBefore = '"data-eos-scalar-capture":y&&!e.data.button&&!e.data.switch&&(N==null?void 0:N.type)!=="file"?"1":void 0,onClickCapture:Y=>{if(y&&!e.data.button&&!e.data.switch&&(N==null?void 0:N.type)!=="file"&&!(e.data.url&&Y.ctrlKey)){ Y.stopPropagation&&Y.stopPropagation();const V=this.states&&this.states[i]?this.states[i]:null;this.edit={val:V?V.val:"",q:V&&V.q||0,ack:!1,id:i};this.setState({updateOpened:!0})}},onClick:Y=>{var ';
    const captureBeforeCompact = captureBefore.replace('{ Y.stopPropagation', '{Y.stopPropagation');
    const captureAfter = '"data-eos-scalar-capture":y&&e.data.eosWriteBehavior==="dialog"?"1":void 0,"data-eos-direct-control":y&&(e.data.eosWriteBehavior==="button"||e.data.eosWriteBehavior==="switch")?"1":void 0,onClickCapture:Y=>{if(!y||e.data.url&&Y.ctrlKey)return;const V=e.data.eosWriteBehavior;if(V==="button"||V==="switch"){Y.preventDefault&&Y.preventDefault(),Y.stopPropagation&&Y.stopPropagation(),Y.nativeEvent&&(Y.nativeEvent.__eosManualWriteHandled=!0);const Te=typeof window!=="undefined"&&typeof window.NEXOWATT_EOS_WRITE_MANUAL_STATE==="function"?window.NEXOWATT_EOS_WRITE_MANUAL_STATE:(ve,pe,ge)=>ve.setState(pe,{val:ge,ack:!1,q:0});let ne=!0;if(V==="switch"){const ve=this.states&&this.states[i]?this.states[i].val:!1;ne=typeof window!=="undefined"&&typeof window.NEXOWATT_EOS_COERCE_BOOLEAN==="function"?!window.NEXOWATT_EOS_COERCE_BOOLEAN(ve):!(ve===!0||ve===1||ve==="1"||String(ve).trim().toLowerCase()==="true")}Te(this.props.socket,i,ne).catch(ve=>this.showError(`Cannot write value: ${ve}`));return}if(V==="dialog"){Y.stopPropagation&&Y.stopPropagation(),Y.nativeEvent&&(Y.nativeEvent.__eosManualWriteHandled=!0);const Te=this.states&&this.states[i]?this.states[i]:null;this.edit={val:Te?Te.val:"",q:Te&&Te.q||0,ack:!1,id:i},this.setState({updateOpened:!0})}},onClick:Y=>{var ';
    if (code.includes(captureBefore)) code = code.replace(captureBefore, captureAfter);
    else if (code.includes(captureBeforeCompact)) code = code.replace(captureBeforeCompact, captureAfter);
    else fail('cannot locate scalar capture block for type-aware direct controls');

    const clickVar = /onClick:Y=>\{var ([A-Za-z_$][\w$]*(?:,[A-Za-z_$][\w$]*)*);/;
    if (!clickVar.test(code)) fail('cannot locate value-cell click variable block');
    code = code.replace(clickVar, 'onClick:Y=>{var $1;if(Y.nativeEvent&&Y.nativeEvent.__eosManualWriteHandled)return;');

    const visualBefore = 'let n=r.valTextRx;return this.state.filter.expertMode||(t.data.button?n=[a.createElement(kie,{key:"button",style:{color:r.style.color,...z.cellValueButton}})]:t.data.switch&&(n=[a.createElement(u.Switch,{key:"switch",sx:{"& .MuiSwitch-thumb":{color:r.style.color},"& .MuiSwitch-track":{backgroundColor:this.states[e].val&&this.state.selected.includes(e)?this.props.themeType==="dark"?"#FFF !important":"#111 !important":void 0}},checked:!!this.states[e].val})])),a.createElement(u.Tooltip';
    const visualAfter = 'let n=r.valTextRx;return t.data.button?n=[a.createElement(kie,{key:"button",style:{color:r.style.color,...z.cellValueButton}})]:(t.data.switch||((i.common==null?void 0:i.common.type)==="boolean"))&&(n=[a.createElement(u.Switch,{key:"switch",sx:{"& .MuiSwitch-thumb":{color:r.style.color},"& .MuiSwitch-track":{backgroundColor:(typeof window!=="undefined"&&typeof window.NEXOWATT_EOS_COERCE_BOOLEAN==="function"?window.NEXOWATT_EOS_COERCE_BOOLEAN(this.states[e].val):!!this.states[e].val)&&this.state.selected.includes(e)?this.props.themeType==="dark"?"#FFF !important":"#111 !important":void 0}},checked:typeof window!=="undefined"&&typeof window.NEXOWATT_EOS_COERCE_BOOLEAN==="function"?window.NEXOWATT_EOS_COERCE_BOOLEAN(this.states[e].val):!!this.states[e].val})]),a.createElement(u.Tooltip';
    if (!code.includes(visualBefore)) fail('cannot locate button/switch visual block');
    code = code.replace(visualBefore, visualAfter);
    changed = true;
}
// Keep the bubble-phase fallback type-aware as well. Normally the capture
// handler marks the event as handled, but keyboard/browser edge cases must not
// reintroduce the old non-expert-only behavior.
if (code.includes('!this.state.filter.expertMode&&e.data.button')) {
    code = code.replaceAll('!this.state.filter.expertMode&&e.data.button', 'e.data.eosWriteBehavior==="button"');
    changed = true;
}
if (code.includes('!this.state.filter.expertMode&&e.data.switch')) {
    code = code.replaceAll('!this.state.filter.expertMode&&e.data.switch', 'e.data.eosWriteBehavior==="switch"');
    changed = true;
}
if (!code.includes('data-eos-write-behavior')) fail('type-aware write behavior marker missing');
if (!code.includes('data-eos-direct-control')) fail('direct-control marker missing');
if (!code.includes('NEXOWATT_EOS_WRITE_MANUAL_STATE')) fail('deduplicating manual write helper missing');
if (!code.includes('NEXOWATT_EOS_COERCE_BOOLEAN')) fail('robust boolean conversion missing');
if (/!this\.state\.filter\.expertMode&&e\.data\.(?:button|switch)/.test(code)) fail('button/switch direct actions are still incorrectly disabled in expert mode');
if (code.includes('this.state.filter.expertMode||(t.data.button')) fail('button/switch visuals are still hidden in expert mode');

if (changed) fs.writeFileSync(bundlePath, code);
console.log(`[NexoWatt EOS post-build patch] OK (${asset}${changed ? ', patched' : ', already compliant'})`);
