#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let bad = false;
const fail = message => {
    console.error(`[NexoWatt EOS login layout] ${message}`);
    bad = true;
};

const css = read('adminWww/css/nexowatt-native-shell.css');
const sourceCss = read('src-admin/public/css/nexowatt-native-shell.css');
const login = read('src-admin/src/login/Login.tsx');
const bootstrap = read('adminWww/js/eos-role-bootstrap.js');
const index = read('adminWww/index.html');
const buildInfo = JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json'));
const shellTag = String(buildInfo.shellCacheTag || buildInfo.shellCacheVersion || '');

if (css !== sourceCss) fail('login CSS source/build drift');
if (!css.includes('outer frame is decorative only')) fail('decorative compact-frame contract is missing');
if (css.includes('html.eos-login .MuiPaper-root:has(#username)')) {
    fail('broad :has selector still styles the outer login Paper');
}

const outer = css.match(/html\.eos-login main\.MuiPaper-root\s*\{([\s\S]*?)\n\}/)?.[1] || '';
for (const marker of [
    'position: relative',
    'width: 100%',
    'min-height: 100vh',
    'place-items: center',
    'background: transparent !important',
    'box-shadow: none !important',
]) {
    if (!outer.includes(marker)) fail(`transparent viewport host rule missing: ${marker}`);
}

const decorative = css.match(/html\.eos-login main\.MuiPaper-root::before\s*\{([\s\S]*?)\n\}/)?.[1] || '';
for (const marker of [
    "content: ''",
    'width: min(390px, calc(100vw - 24px))',
    'height: min(480px, calc(100vh - 24px))',
    'transform: translate(-50%, -50%)',
    'pointer-events: none',
]) {
    if (!decorative.includes(marker)) fail(`decorative rear frame rule missing: ${marker}`);
}

for (const marker of [
    'html.eos-login main.MuiPaper-root > .eos-login-card-modern',
    'html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#username)',
    'html.eos-login main.MuiPaper-root > .MuiPaper-root:has(#password)',
    'width: min(334px, calc(100vw - 56px)) !important',
    'height: min(424px, calc(100vh - 56px)) !important',
    'max-height: none !important',
]) {
    if (!css.includes(marker)) fail(`inner compact card rule missing: ${marker}`);
}
if (!css.includes('.eos-login-first-status:empty { display: none; min-height: 0; margin: 0; }')) {
    fail('empty first-login status still reserves vertical space');
}

if (!login.includes('Keep the familiar compact login page')) fail('native Login source lacks compact-page contract');
if (login.includes('eos-login-role-selector-native') || login.includes('data-eos-account=')) {
    fail('native Login source still renders role-selector buttons');
}
if (!bootstrap.includes('compact normal-login first activation')) fail('runtime compact first-login contract missing');
if (!bootstrap.includes("card.querySelectorAll('.eos-login-role-selector').forEach(element => element.remove())")) {
    fail('runtime does not remove stale role-selector surfaces');
}
if (/data-eos-account=|selector\.innerHTML/.test(bootstrap)) fail('runtime still injects a second role-selector panel');

if (!shellTag || !index.includes(`nexowatt-native-shell.css?v=${shellTag}`)) {
    fail('login CSS cache key is not aligned with build information');
}

if (bad) process.exit(1);
console.log('[NexoWatt EOS login layout] OK');
