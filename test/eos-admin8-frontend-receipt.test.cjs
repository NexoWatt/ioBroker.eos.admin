'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { moduleReferences, resolveModuleReference, safePath, validateManifest, inspectFrontendGraph } = require('../tools/nexowatt-frontend-artifacts.cjs');
const { cleanLegacyRuntime } = require('../tools/nexowatt-clean-legacy-runtime.cjs');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-admin8-receipt-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const base = path.join(root, 'adminWww');
    const files = { 'assets/entry.js': 'const __mfImport = src => import(src); __mfImport("./app.js");', 'assets/app.js': 'export const greeting = "import \\"./imaginary.js\\" is translated text";', 'remoteEntry.js': 'export const init = () => {};' };
    files['assets/app.js'] = 'export const greeting = `import "./imaginary.js" is translated text`;';
    for (const [rel, source] of Object.entries(files)) { const file = path.join(base, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, source); }
    const sources = { 'src/index.tsx': sha('fixture') };
    const manifest = { schemaVersion: 1, productVersion: '8.0.0', upstream: { version: '8.3.5', commit: 'fixture' }, roleBootstrap: 'js/eos-role-bootstrap.js', entry: 'assets/entry.js', sourceHash: sha(JSON.stringify(sources)), sources,
        assets: { 'assets/entry.js': { sha256: sha(files['assets/entry.js']), imports: ['assets/app.js'] } },
        chunks: { 'assets/app.js': { imports: [], dynamicImports: [], modules: ['src/index.tsx'] }, 'remoteEntry.js': { imports: [], dynamicImports: [], modules: ['virtual:remote'] } } };
    fs.writeFileSync(path.join(base, 'NEXOWATT_EOS_FRONTEND_MANIFEST.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(base, 'mf-manifest.json'), JSON.stringify({ metaData: { remoteEntry: { name: 'remoteEntry.js', path: '', type: 'module' } }, shared: [], exposes: [] }));
    fs.writeFileSync(path.join(root, 'NEXOWATT_EOS_BUILD_INFO.json'), JSON.stringify({ shellCacheVersion: 7109 }));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '8.0.0', scripts: {}, files: [] }));
    return { root, base, manifest };
}

test('graph parser distinguishes actual imports from translations and never executes emitted code', () => {
    const text = 'globalThis.eosReceiptShouldNeverExecute = true; const translated = `import "./imaginary.js"`; import x from "./real.js"; export { x }; import("./lazy.js"); __mfImport("./host.js");';
    assert.deepEqual(new Set(moduleReferences(text)), new Set(['./real.js', './lazy.js', './host.js']));
    assert.equal(globalThis.eosReceiptShouldNeverExecute, undefined);
    assert.throws(() => resolveModuleReference('assets/app.js', '../../escape.js'), /escapes/);
    assert.throws(() => resolveModuleReference('assets/app.js', 'https://untrusted.invalid/a.js'), /Non-local/);
});

test('receipt permits the real federation asset entry but rejects missing dependencies, changed asset bytes and unsafe paths', t => {
    const f = fixture(t);
    assert.equal(inspectFrontendGraph(f.manifest, f.base).reachable.length, 3);
    assert.throws(() => safePath(f.base, '../outside.js'), /Unsafe/);
    const invalid = structuredClone(f.manifest); invalid.entry = '../outside.js';
    assert.throws(() => validateManifest(invalid), /Unsupported/);
    fs.appendFileSync(path.join(f.base, 'assets/entry.js'), '\n// unexpected mutation');
    assert.throws(() => inspectFrontendGraph(f.manifest, f.base), /hash mismatch/);
    fs.rmSync(path.join(f.base, 'assets/app.js'));
    assert.throws(() => inspectFrontendGraph(f.manifest, f.base), /Missing/);
});

test('Admin8 legacy cleaner preserves unknown files for the hash-bound copy migration and strict seal', t => {
    const f = fixture(t);
    const stale = ['assets/bootstrap-old-v85.js', 'assets/bootstrap-old-hash.js', 'remoteEntry-v85.js'];
    for (const rel of stale) fs.writeFileSync(path.join(f.base, rel), '// stale fixture');
    const result = cleanLegacyRuntime({ root: f.root, silent: true });
    assert.equal(result.activeRuntime, 0);
    assert.equal(result.removed.length, 0);
    for (const rel of stale) assert.equal(fs.readFileSync(path.join(f.base, rel), 'utf8'), '// stale fixture');
    for (const rel of [f.manifest.entry, ...Object.keys(f.manifest.chunks)]) assert.equal(fs.existsSync(path.join(f.base, rel)), true);
    assert.equal(cleanLegacyRuntime({ root: f.root, silent: true }).removed.length, 0);
});

test('prepared release parser works without installed packages and rejects altered vendor bytes before loading them', t => {
    const { spawnSync } = require('node:child_process');
    const f = fixture(t);
    const tools = path.join(f.root, 'tools');
    fs.mkdirSync(tools, { recursive: true });
    fs.copyFileSync(path.join(__dirname, '../tools/nexowatt-frontend-artifacts.cjs'), path.join(tools, 'nexowatt-frontend-artifacts.cjs'));
    fs.cpSync(path.join(__dirname, '../tools/vendor'), path.join(tools, 'vendor'), { recursive: true });
    const script = 'const h=require(process.argv[1]); console.log(JSON.stringify(h.moduleReferences(\'import "./valid.js";\')));';
    const run = () => spawnSync(process.execPath, ['-e', script, path.join(tools, 'nexowatt-frontend-artifacts.cjs')], { encoding: 'utf8', cwd: f.root, timeout: 10000 });
    assert.equal(run().stdout.trim(), '["./valid.js"]');
    fs.appendFileSync(path.join(tools, 'vendor/acorn/acorn.cjs'), '\nthrow new Error("DO_NOT_EXECUTE_CHANGED_VENDOR");');
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Release parser integrity mismatch/);
    assert.doesNotMatch(result.stderr, /Error: DO_NOT_EXECUTE_CHANGED_VENDOR/);
});
