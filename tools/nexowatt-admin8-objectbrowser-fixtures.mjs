/** Build-time fixture generator/check. Publish-time tests need only Node 24. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'src-admin/package.json'));
const ts = require('typescript');
const overlay = JSON.parse(
    readFileSync(resolve(root, 'src-admin/build-tools/eos-object-browser-patches.json'), 'utf8'),
);
const vendor = resolve(root, 'src-admin/node_modules/@iobroker/gui-components');
const packageMetadata = JSON.parse(readFileSync(resolve(vendor, 'package.json'), 'utf8'));
assert.equal(packageMetadata.version, overlay.version, 'fixture generation requires reviewed GUI version');
const destination = resolve(root, 'tools/fixtures/admin8-objectbrowser');
const hash = value => createHash('sha256').update(value).digest('hex');
const files = {};
for (const patch of overlay.patches) {
    const bytes = readFileSync(resolve(vendor, 'build/Components/ObjectBrowser', patch.file));
    assert.equal(hash(bytes), patch.sha256, `reviewed vendor input changed: ${patch.file}`);
    files[patch.file] = bytes;
}
files['LICENSE.gui-components'] = readFileSync(resolve(vendor, 'LICENSE'));
const dialogSource = readFileSync(resolve(root, 'src-admin/src/components/Object/ObjectBrowserValue.tsx'), 'utf8');
files['ObjectBrowserValue.test.cjs'] = ts.transpileModule(dialogSource, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
    },
}).outputText;
const lock = JSON.parse(readFileSync(resolve(root, 'src-admin/package-lock.json'), 'utf8'));
const metadata = {
    schemaVersion: 1,
    guiVersion: overlay.version,
    guiIntegrity: lock.packages['node_modules/@iobroker/gui-components'].integrity,
    compilerVersion: ts.version,
    dialogSource: 'src-admin/src/components/Object/ObjectBrowserValue.tsx',
    dialogSourceSha256: hash(dialogSource),
    files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hash(bytes)])),
};
files['provenance.json'] = JSON.stringify(metadata, null, 2) + '\n';
if (process.argv.includes('--check')) {
    for (const [name, bytes] of Object.entries(files))
        assert.equal(
            hash(readFileSync(resolve(destination, name))),
            hash(bytes),
            `fixture drift: ${name}; review changes before refreshing fixtures`,
        );
    console.log('PASS Admin8 ObjectBrowser fixture provenance and fresh compiler/vendor equivalence');
} else {
    mkdirSync(destination, { recursive: true });
    for (const [name, bytes] of Object.entries(files)) writeFileSync(resolve(destination, name), bytes);
    console.log('Generated reviewed Admin8 ObjectBrowser test fixtures');
}
