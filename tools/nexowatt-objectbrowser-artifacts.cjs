'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
    root,
    runtimeRoot,
    verifyFrontendManifest,
    readModuleChunks,
    findModuleChunks,
} = require('./nexowatt-frontend-artifacts.cjs');
function verifyObjectBrowserRuntime() {
    const manifest = verifyFrontendManifest();
    const receipt = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'eos-object-browser-guards.json'), 'utf8'));
    const expected = ['ObjectBrowserClass.js', 'contextMenu.js', 'dialogs.js', 'renderLeaf.js'].sort();
    const overlay = JSON.parse(
        fs.readFileSync(path.join(root, 'src-admin/build-tools/eos-object-browser-patches.json'), 'utf8'),
    );
    if (
        receipt.marker !== 'nexowatt-eos-admin8-manual-write-v1' ||
        receipt.version !== overlay.version ||
        !Array.isArray(receipt.files) ||
        JSON.stringify(receipt.files.slice().sort()) !== JSON.stringify(expected)
    )
        throw new Error('Invalid or incomplete ObjectBrowser source-guard build receipt');
    for (const file of expected)
        findModuleChunks(`node_modules/@iobroker/gui-components/build/Components/ObjectBrowser/${file}`, manifest);
    const helper = readModuleChunks('src/components/Object/eosObjectBrowserWrite.ts', manifest);
    const dialog = readModuleChunks('src/components/Object/ObjectBrowserValue.tsx', manifest);
    const leaf = readModuleChunks(
        'node_modules/@iobroker/gui-components/build/Components/ObjectBrowser/renderLeaf.js',
        manifest,
    );
    for (const marker of [
        'NEXOWATT_EOS_MANUAL_WRITE_POLICY',
        'getWriteBehavior',
        'resolveDirectWriteValue',
        'writeManualState',
        'data-eos-object-value-cell',
        'data-eos-object-writable',
        'data-eos-direct-control',
        'State writing is not permitted',
    ]) {
        if (!helper.includes(marker)) throw new Error(`ObjectBrowser runtime helper missing ${marker}`);
    }
    for (const marker of [
        'eos-object-value-dialog',
        'Please wait...',
        'parseEditorValue',
        'writePending',
        'jsonError',
    ]) {
        if (!dialog.includes(marker)) throw new Error(`ObjectBrowser runtime dialog missing ${marker}`);
    }
    if (!leaf.includes('Wert setzen')) throw new Error('Write-only value cell placeholder missing');
    return { manifest, helper, dialog, leaf };
}
module.exports = { verifyObjectBrowserRuntime };
