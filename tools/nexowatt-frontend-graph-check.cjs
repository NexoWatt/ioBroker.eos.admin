#!/usr/bin/env node
'use strict';
const { inspectFrontendGraph } = require('./nexowatt-frontend-artifacts.cjs');
try {
    const graph = inspectFrontendGraph();
    if (graph.html5Backends.length !== 1) throw new Error(`Expected exactly one HTML5 backend implementation, found ${graph.html5Backends.length}: ${graph.html5Backends.join(', ')}`);
    console.log(`[NexoWatt EOS frontend graph] OK (${graph.modules.length} recorded JS modules, ${graph.reachable.length} reachable from application/federation entries, one HTML5 backend)`);
} catch (error) { console.error(`[NexoWatt EOS frontend graph] ${error.message}`); process.exit(1); }
