#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = message => { console.error(`[NexoWatt EOS datapoint selftest] ${message}`); process.exit(1); };

const shared = read('adminWww/assets/index-D2ymscJA-v76.js');
const route = read('adminWww/assets/Objects-DPan0bzw-v76.js');
if (!shared.includes('if(!i||i.type!=="state"||!this.states)return null')) fail('non-state value guard missing');
if (!shared.includes('((i.common==null?void 0:i.common.read)!==!1)')) fail('write-only state subscription guard missing');
if (!shared.includes('let y=!this.props.notEditable&&n==="state"&&((N==null?void 0:N.write)!==!1)')) fail('common.write semantics missing');
if (!shared.includes('"data-eos-object-writable":y?"1":"0"')) fail('writable value-cell marker missing');
if (!shared.includes('role:y?"button":void 0,tabIndex:y?0:void 0')) fail('keyboard/clickable value-cell semantics missing');
if (!shared.includes('closest("[data-eos-object-value-cell]")')) fail('row selection guard for value cells missing');
if (!shared.includes('this.setState({updateOpened:!0})')) fail('native value dialog path missing');
if (!shared.includes('catch(r){throw r}')) fail('value-dialog write rejection is swallowed by parent');
if (!shared.includes('data-eos-direct-control')) fail('direct button/switch control marker missing');
if (!shared.includes('data-eos-write-behavior')) fail('type-aware behavior marker missing');
if (!shared.includes('NEXOWATT_EOS_GET_DIRECT_WRITE_VALUE')) fail('type-correct direct control helper missing');
if (!shared.includes('!["readonly","expert-only"].includes(window.NEXOWATT_EOS_GET_WRITE_BEHAVIOR')) fail('context-menu safety policy missing');
if (!shared.includes('NEXOWATT_EOS_RESOLVE_EDITOR_TYPE')) fail('universal editor type resolver missing');
if (!shared.includes('NEXOWATT_EOS_NORMALIZE_STATES')) fail('normalized enum-state transport missing');
if (!shared.includes('eos-write-placeholder')) fail('write-only placeholder missing');
if (!shared.includes('onDoubleClick:Y=>{y&&Y.stopPropagation')) fail('double-click row isolation missing');
if (/!this\.state\.filter\.expertMode&&e\.data\.(?:button|switch)/.test(shared)) fail('button/switch still disabled in expert mode');
if (shared.includes('this.state.filter.expertMode||(t.data.button')) fail('button/switch visuals hidden in expert mode');
if (!route.includes('NEXOWATT_EOS_PREPARE_EDITOR_VALUE')) fail('dialog initial value preparation missing');
if (!route.includes('NEXOWATT_EOS_COERCE_WRITE_VALUE')) fail('dialog value coercion missing');
if (!route.includes('!!this.state.jsonError||this.state.writing')) fail('dialog validation/write lock missing');
if (!route.includes('value:this.state.targetValue==null?"":String(this.state.targetValue)')) fail('null-safe controlled input missing');
if (!route.includes('Object.prototype.hasOwnProperty.call(this.state.targetValue,"value")')) fail('typed states selection handling missing');

const valueDialog = read('src-admin/src/components/Object/ObjectBrowserValue.tsx');
for (const marker of [
    'NEXOWATT_EOS_PREPARE_EDITOR_VALUE',
    'NEXOWATT_EOS_COERCE_WRITE_VALUE',
    'className="eos-object-value-dialog"',
    'zIndex: 10000',
    'this.state.targetValue == null',
    'prepared?.valid',
    'Boolean(this.state.jsonError)',
    'disabled={this.state.writing}',
]) if (!valueDialog.includes(marker)) fail(`source value dialog missing: ${marker}`);
const passive = read('adminWww/js/eos-objects-state-tools.js');
if (/WRITE_STATE_UNRESTRICTED\s*=\s*true/.test(passive)) fail('unrestricted write mode enabled');
console.log('[NexoWatt EOS datapoint selftest] OK');
