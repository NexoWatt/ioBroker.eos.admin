#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { runtimeRoot, sourceRoot, safePath, loadFrontendManifest, inspectFrontendGraph } = require('./nexowatt-frontend-artifacts.cjs');
try {
    const manifest = loadFrontendManifest(), graph = inspectFrontendGraph(manifest);
    const recorded = new Set(graph.modules);
    function inspect(dir, prefix = '') {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = prefix + item.name;
            if (item.isSymbolicLink()) throw new Error(`Runtime symlink is not allowed: ${rel}`);
            if (item.isDirectory()) inspect(path.join(dir, item.name), `${rel}/`);
            else if (item.isFile() && /\.m?js$/.test(item.name) && (rel.startsWith('assets/') || !rel.includes('/'))) {
                if (!recorded.has(rel)) {
                    const source = `public/${rel}`;
                    if (!Object.hasOwn(manifest.sources, source) || !fs.readFileSync(safePath(runtimeRoot, rel)).equals(fs.readFileSync(safePath(sourceRoot, source)))) throw new Error(`Unrecorded/stale runtime module: ${rel}`);
                }
            }
        }
    }
    inspect(runtimeRoot);
    console.log(`[NexoWatt EOS import integrity] OK (${recorded.size} source-bound modules; static, dynamic, federation and preload dependencies)`);
} catch (error) { console.error(`[NexoWatt EOS import integrity] ${error.message}`); process.exit(1); }
