#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', 'adminWww');
const entries = [
    path.join(root, 'assets', 'hostInit-v75.js'),
    path.join(root, 'assets', 'index-CQZugZ1z-v75.js'),
    path.join(root, 'remoteEntry-v75.js'),
];
const importPatterns = [
    /\b(?:import|export)\s*(?:[^"']*?\sfrom\s*)?["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
];
const oldRuntime = /-v(?:54|55|56|57|58|59|60|61|62|63|64|65|66|67|68|69|70|71)\.js/;
const seen = new Set();
const queue = [...entries];
const missing = [];
const oldRefs = [];
const html5BackendFiles = [];
while (queue.length) {
    const file = path.resolve(queue.pop());
    if (seen.has(file)) continue;
    seen.add(file);
    if (!fs.existsSync(file)) {
        missing.push(file);
        continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    if (oldRuntime.test(text)) oldRefs.push(path.relative(root, file));
    if (text.includes('Cannot have two HTML5 backends at the same time')) {
        html5BackendFiles.push(path.relative(root, file));
    }
    for (const pattern of importPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text))) {
            const specifier = match[1];
            if (!specifier.startsWith('.')) continue;
            let target = path.resolve(path.dirname(file), specifier);
            if (!path.extname(target)) target += '.js';
            if (!fs.existsSync(target)) missing.push(`${path.relative(root, file)} -> ${specifier}`);
            else if (target.endsWith('.js')) queue.push(target);
        }
    }
}
if (missing.length) {
    console.error('[NexoWatt EOS frontend graph] missing imports:\n' + missing.join('\n'));
    process.exit(1);
}
if (oldRefs.length) {
    console.error('[NexoWatt EOS frontend graph] active graph references old runtimes:\n' + oldRefs.join('\n'));
    process.exit(1);
}
if (html5BackendFiles.length !== 1) {
    console.error(`[NexoWatt EOS frontend graph] expected one HTML5 backend runtime, found ${html5BackendFiles.length}: ${html5BackendFiles.join(', ')}`);
    process.exit(1);
}
console.log(`[NexoWatt EOS frontend graph] OK (${seen.size} reachable JS files, one HTML5 backend)`);
