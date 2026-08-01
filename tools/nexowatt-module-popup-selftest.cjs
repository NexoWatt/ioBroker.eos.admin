#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = msg => { console.error(`[NexoWatt EOS module popup selftest] ${msg}`); process.exit(1); };
const source = read('src-admin/src/components/CustomSelectButton.tsx');
const built = read('adminWww/assets/sentry-B7YeoTAx-v73.js');
const css = read('adminWww/css/eos-branding.css');
const branding = read('adminWww/js/eos-branding.js');
if (/\bkeepMounted\b/.test(source)) fail('CustomSelectButton still keep-mounts closed menus');
if (/anchorEl:c,keepMounted:!0/.test(built)) fail('built CustomSelectButton still keep-mounts closed menus');
for (const marker of ['eos-module-filter-menu','anchorOrigin','transformOrigin','disableScrollLock']) {
  if (!source.includes(marker) || !built.includes(marker)) fail(`missing ${marker} in source or built module`);
}
if (/\.MuiMenu-paper,[\s\S]{0,350}visibility:\s*visible\s*!important/.test(css)) fail('generic Menu paper visibility override remains');
if (/\.MuiMenuItem-root\s*\{[\s\S]{0,200}visibility:\s*visible\s*!important/.test(css)) fail('generic MenuItem visibility override remains');
if (!css.includes('.MuiMenu-root.MuiModal-hidden') || !css.includes('visibility: hidden !important')) fail('hidden MUI menu guard missing');
if (!branding.includes("el.classList.contains('MuiModal-hidden')")) fail('popup DOM patch does not skip hidden roots');
console.log('[NexoWatt EOS module popup selftest] OK');
