#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));

const pkg = json('package.json');
const sourceRole = read('src-admin/public/js/eos-role-ui.js');
const runtimeRole = read('adminWww/js/eos-role-ui.js');
const sourceBoot = read('src-admin/public/js/eos-role-bootstrap.js');
const runtimeBoot = read('adminWww/js/eos-role-bootstrap.js');
const sourceShell = read('src-admin/public/js/nexowatt-native-shell.js');
const runtimeShell = read('adminWww/js/nexowatt-native-shell.js');
const sourceCss = read('src-admin/public/css/nexowatt-native-shell.css');
const runtimeCss = read('adminWww/css/nexowatt-native-shell.css');
const drawer = read('src-admin/src/components/Drawer.tsx');
const index = read('adminWww/index.html');

assert.equal(pkg.version, '7.10.8', 'UI foundation release must use npm version 7.10.8');
assert.equal(sourceRole, runtimeRole, 'role source/runtime drift');
assert.equal(sourceBoot, runtimeBoot, 'bootstrap source/runtime drift');
assert.equal(sourceShell, runtimeShell, 'shell source/runtime drift');
assert.equal(sourceCss, runtimeCss, 'shell CSS source/runtime drift');

for (const code of [sourceRole, runtimeRole]) {
    assert.match(code, /const isGloballyHiddenTab = tab => normalize\(tab\) === 'tab-enums'/, 'global Structure hide missing');
    assert.match(code, /if \(route === 'easy' \|\| isGloballyHiddenTab\(route\)\) return false;/, 'direct Structure route is not denied');
    assert.match(code, /const isHeaderSystemSettingsButton = button =>/, 'header-only System Settings classifier missing');
    assert.match(code, /clickedButton && isHeaderSystemSettingsButton\(clickedButton\)/, 'service-row wrench/arrow can still be intercepted');
    assert.doesNotMatch(code, /clickedButton && isSystemSettingsButton\(clickedButton\)/, 'broad BuildIcon click interception remains');
    assert.doesNotMatch(code, /\['Struktur'.*tab-enums/s, 'Structure remains in role action definitions');
}
for (const code of [sourceBoot, runtimeBoot]) {
    assert.match(code, /!isGloballyHiddenTab\(route\)/, 'bootstrap does not deny Structure globally');
    assert.doesNotMatch(code, /route === 'tab-enums'/, 'End User bootstrap still releases Structure');
}
for (const code of [sourceShell, runtimeShell]) {
    assert.match(code, /Dienste & Instanzen/, 'modern Services surface missing');
    assert.match(code, /Datenpunkte & Zustände/, 'modern Datapoints surface missing');
    assert.match(code, /title: 'Systemlogs'/, 'modern System Logs surface missing');
    assert.match(code, /ensureTechnicalSurface\(\)/, 'technical surface is not applied');
    assert.match(code, /eos-log-row-error/, 'log severity decoration missing');
}
for (const css of [sourceCss, runtimeCss]) {
    for (const marker of [
        '.eos-technical-surface-header',
        'html.eos-route-instances',
        'html.eos-route-objects',
        'html.eos-route-logs',
        '.eos-log-row-error',
    ]) assert.ok(css.includes(marker), `missing modern CSS marker ${marker}`);
}
assert.doesNotMatch(drawer, /'tab-users',\s*'tab-enums'/, 'Structure is still part of readyToUse');
assert.match(drawer, /tab\.name !== 'tab-enums'/, 'Drawer does not hard-filter Structure');
assert.match(index, /nexowatt-native-shell\.css\?v=7108/, '7.10.8 CSS cache key missing');
assert.match(index, /eos-role-ui\.js\?v=7108/, '7.10.8 role cache key missing');
assert.match(index, /nexowatt-stable-v7108\.js\?v=7108/, '7.10.8 stable runtime missing');

console.log('[NexoWatt EOS v7108 UI foundation] OK (modern Services/Datapoints/Logs, Structure hidden, Installer service controls native)');
