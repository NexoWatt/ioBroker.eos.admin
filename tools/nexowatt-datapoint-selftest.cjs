#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = message => { console.error(`[NexoWatt EOS datapoint selftest] ${message}`); process.exit(1); };

const shared = read('adminWww/assets/index-D2ymscJA-v75.js');
if (!shared.includes('if(!i||i.type!=="state"||!this.states)return null')) fail('non-state value guard missing');
if (!shared.includes('this.subscribe(e);return null')) fail('missing-state subscription must render empty until a state arrives');
if (shared.includes('renderColumnValue(e,t,M){var c,N;const i=t.data.obj;if(!i)return null;this.states=this.states||{}')) fail('legacy artificial null-state path remains');
if (!shared.includes('let y=!this.props.notEditable&&n==="state"&&((N==null?void 0:N.write)!==!1)')) fail('strict common.write semantics missing');
if (!shared.includes('"data-eos-object-writable":y?"1":"0"')) fail('writable value-cell marker missing');
if (!shared.includes('role:y?"button":void 0,tabIndex:y?0:void 0')) fail('keyboard/clickable value-cell semantics missing');
if (!/onMouseDown:([A-Za-z_$][\w$]*)=>\{[^}]*stopPropagation/.test(shared)) fail('safe value-cell mousedown isolation missing');
if (!shared.includes('closest("[data-eos-object-value-cell]")')) fail('row selection guard for value cells missing');
if (/onMouseDown:[A-Za-z_$][\w$]*=>\{[^}]*preventDefault/.test(shared)) fail('value-cell mousedown must not call preventDefault');
if (!shared.includes('this.setState({updateOpened:!0})')) fail('native value dialog path missing');
if (!shared.includes('data-eos-scalar-capture')) fail('scalar click-capture path missing');
if (!shared.includes('data-eos-direct-control')) fail('direct button/switch control marker missing');
if (!shared.includes('data-eos-write-behavior')) fail('type-aware behavior marker missing');
if (!shared.includes('NEXOWATT_EOS_WRITE_MANUAL_STATE')) fail('deduplicating manual write helper missing');
if (/!this\.state\.filter\.expertMode&&e\.data\.(?:button|switch)/.test(shared)) fail('button/switch are still disabled in expert mode');
if (!shared.includes('e.data.eosWriteBehavior==="button"')) fail('button behavior path missing');
if (!shared.includes('e.data.eosWriteBehavior==="switch"')) fail('switch behavior path missing');
if (!shared.includes('NEXOWATT_EOS_COERCE_BOOLEAN')) fail('robust boolean toggle path missing');
if (shared.includes('this.state.filter.expertMode||(t.data.button')) fail('button/switch controls are hidden in expert mode');
if (!shared.includes('t.data.switch||((i.common==null?void 0:i.common.type)==="boolean")')) fail('plain writable boolean states do not render as switches');
if (!shared.includes('onClose:async o=>')) fail('value dialog does not wait for a successful write');
if (!shared.includes('return this.props.socket.setState(this.edit.id')) fail('value update does not return the write promise');

const valueDialog = read('src-admin/src/components/Object/ObjectBrowserValue.tsx');
if (!valueDialog.includes('className="eos-object-value-dialog"')) fail('scalar dialog class missing');
if (!valueDialog.includes('zIndex: 10000')) fail('scalar dialog z-index hardening missing');
if (!valueDialog.includes('common?.write === false')) fail('read-only common.write guard missing in value dialog');
const passive = read('adminWww/js/eos-objects-state-tools.js');
if (/WRITE_STATE_UNRESTRICTED\s*=\s*true/.test(passive)) fail('unrestricted write mode enabled');
const postBuild = read('tools/nexowatt-patch-built-frontend.cjs');
for (const marker of ['Non-state objects', 'common.write', 'value cell isolated']) {
    if (!postBuild.includes(marker)) fail(`post-build guard missing: ${marker}`);
}
console.log('[NexoWatt EOS datapoint selftest] OK');
