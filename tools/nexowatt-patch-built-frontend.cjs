#!/usr/bin/env node
'use strict';
// Compatibility command name retained for existing build workflows. Admin 8
// applies reviewed guards to unminified sources in Vite. This post-build step
// only verifies the real source-bound output; it never edits emitted JavaScript.
const { verifyObjectBrowserRuntime } = require('./nexowatt-objectbrowser-artifacts.cjs');
const { inspectFrontendGraph } = require('./nexowatt-frontend-artifacts.cjs');
try {
    verifyObjectBrowserRuntime();
    inspectFrontendGraph();
    console.log('[NexoWatt EOS post-build guard] OK: reviewed Admin 8 source guards, unchanged emitted modules');
} catch (error) {
    console.error(`[NexoWatt EOS post-build guard] ${error.message}`);
    process.exitCode = 1;
}
