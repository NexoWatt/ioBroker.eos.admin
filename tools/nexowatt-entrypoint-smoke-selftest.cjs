#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { runtimeRoot, safePath, loadFrontendManifest, findModuleChunks, moduleReferences, resolveModuleReference } = require('./nexowatt-frontend-artifacts.cjs');
const manifest = loadFrontendManifest();
const html = fs.readFileSync(safePath(runtimeRoot, 'index.html'), 'utf8');
const failures = [];
const attr = (text, name) => text.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1];
const local = value => String(value || '').split(/[?#]/, 1)[0].replace(/^\.\//, '');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(match => ({ attrs: match[1], body: match[2], file: local(attr(match[1], 'src')), module: attr(match[1], 'type') === 'module' }));
for (const script of scripts) {
    if (script.file) safePath(runtimeRoot, script.file);
    if (script.module) failures.push('The application module must start only after EOS role discovery');
}
for (const link of html.matchAll(/<link\b([^>]*)>/gi)) {
    const href = attr(link[1], 'href');
    if (href && !/^(?:data:|https?:)/i.test(href)) safePath(runtimeRoot, local(href));
    if (attr(link[1], 'rel') === 'modulepreload') failures.push('Role-gated entry must not have eager modulepreloads');
}
const gates = scripts.filter(row => row.file === manifest.roleBootstrap);
if (gates.length !== 1 || local(attr(gates[0]?.attrs || '', 'data-eos-entry')) !== manifest.entry) failures.push('Exactly one role bootstrap must reference the manifest entry');
const order = ['js/eos-manual-write-policy.js', manifest.roleBootstrap, 'js/eos-policy-client.js', 'js/nexowatt-native-shell.js', 'js/eos-native-security.js', 'js/eos-basic-settings.js', 'js/eos-role-ui.js', 'js/eos-auto-update.js'];
let last = -1;
for (const file of order) {
    const positions = scripts.flatMap((row, index) => row.file === file ? [index] : []);
    if (positions.length !== 1 || positions[0] <= last) failures.push(`Required startup order/cardinality failed: ${file}`);
    last = positions[0] ?? last;
}
const entryText = fs.readFileSync(safePath(runtimeRoot, manifest.entry), 'utf8');
const entryRefs = moduleReferences(entryText).map(ref => resolveModuleReference(manifest.entry, ref));
if (!entryRefs.some(ref => /(?:^|\/)hostInit-[A-Za-z0-9_-]+\.js$/.test(ref))) failures.push('Federation startup must initialize the host inside the role-gated entry');
const indexChunks = findModuleChunks('src/index.tsx', manifest);
if (!indexChunks.some(ref => entryRefs.includes(ref))) failures.push('Federation entry does not load the compiled index source');
findModuleChunks('src/bootstrap.tsx', manifest);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-entrypoint-smoke-'));
try {
    const rows = [...scripts, { file: manifest.entry, module: true }, ...entryRefs.map(file => ({ file, module: true }))];
    for (const [index, row] of rows.entries()) {
        const source = row.file ? fs.readFileSync(safePath(runtimeRoot, row.file), 'utf8') : row.body;
        const target = path.join(temp, `${index}.${row.module ? 'mjs' : 'cjs'}`);
        fs.writeFileSync(target, source || '');
        const checked = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
        if (checked.status !== 0) failures.push(`Entry script does not parse (${row.file || 'inline'}): ${checked.error?.message || checked.stderr || checked.stdout}`);
    }
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
if (failures.length) { console.error(`[NexoWatt EOS entrypoint smoke] ${failures.length} failure(s):\n${failures.join('\n')}`); process.exit(1); }
console.log(`[NexoWatt EOS entrypoint smoke] OK (${scripts.length} scripts; manifest-bound, role-gated Admin 8 application)`);
