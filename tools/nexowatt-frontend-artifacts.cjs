'use strict';
// Resolve real Vite output through the build receipt, never through historical
// minifier names. The release seal separately binds every emitted output byte.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const runtimeRoot = path.join(root, 'adminWww');
const sourceRoot = path.join(root, 'src-admin');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function validRelative(relative) {
    return typeof relative === 'string' && relative.length > 0 && relative.length <= 1024 &&
        !/[\\\x00-\x1f\x7f:#?]/.test(relative) && !path.isAbsolute(relative) &&
        !relative.split('/').some(p => !p || p === '.' || p === '..');
}
function safePath(base, relative) {
    if (!validRelative(relative)) throw new Error(`Unsafe frontend receipt path: ${String(relative).slice(0, 200)}`);
    base = path.resolve(base);
    if (fs.lstatSync(base).isSymbolicLink()) throw new Error('Frontend root symlink is not allowed');
    const resolved = path.resolve(base, relative);
    if (!resolved.startsWith(base + path.sep)) throw new Error('Frontend receipt path leaves root');
    let current = base;
    for (const part of relative.split('/')) {
        current = path.join(current, part);
        if (!fs.existsSync(current) || fs.lstatSync(current).isSymbolicLink()) throw new Error(`Missing/symlink frontend artifact: ${relative}`);
    }
    if (!fs.statSync(resolved).isFile()) throw new Error(`Invalid frontend artifact: ${relative}`);
    return resolved;
}
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validateManifest(manifest) {
    if (!record(manifest) || manifest.schemaVersion !== 1 || !record(manifest.sources) || !record(manifest.chunks) ||
        !validRelative(manifest.entry) || manifest.roleBootstrap !== 'js/eos-role-bootstrap.js' ||
        typeof manifest.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sourceHash) ||
        !record(manifest.upstream) || typeof manifest.productVersion !== 'string') throw new Error('Unsupported frontend build receipt');
    const sources = Object.entries(manifest.sources), chunks = Object.entries(manifest.chunks);
    if (!sources.length || sources.length > 30000 || !chunks.length || chunks.length > 2000) throw new Error('Frontend receipt count limit');
    for (const [name, hash] of sources) if (!validRelative(name) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid frontend source record');
    const refs = values => Array.isArray(values) && values.length <= 2000 && values.every(validRelative);
    let moduleCount = 0;
    for (const [name, chunk] of chunks) {
        if (!validRelative(name) || !/\.m?js$/.test(name) || !record(chunk) || !refs(chunk.imports) || !refs(chunk.dynamicImports) || !Array.isArray(chunk.modules)) throw new Error(`Invalid frontend chunk: ${name}`);
        moduleCount += chunk.modules.length;
        if (moduleCount > 200000 || chunk.modules.some(id => typeof id !== 'string' || id.length > 4096)) throw new Error('Invalid frontend source module list');
    }
    if (manifest.assets !== undefined && !record(manifest.assets)) throw new Error('Invalid frontend assets');
    const assets = Object.entries(manifest.assets || {});
    if (assets.length > 2000) throw new Error('Frontend asset count limit');
    for (const [name, asset] of assets) if (!validRelative(name) || !/\.[cm]?js$/.test(name) || Object.hasOwn(manifest.chunks, name) ||
        !record(asset) || !refs(asset.imports) || typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error(`Invalid frontend asset: ${name}`);
    if (!Object.hasOwn(manifest.chunks, manifest.entry) && !Object.hasOwn(manifest.assets || {}, manifest.entry)) throw new Error('Frontend entry is not a recorded emitted module');
    return manifest;
}
function loadFrontendManifest(base = runtimeRoot) {
    const file = safePath(base, 'NEXOWATT_EOS_FRONTEND_MANIFEST.json');
    if (fs.statSync(file).size > 16 * 1024 * 1024) throw new Error('Frontend receipt size limit');
    return validateManifest(JSON.parse(fs.readFileSync(file, 'utf8')));
}
function findModuleChunks(moduleSuffix, manifest = loadFrontendManifest()) {
    const wanted = String(moduleSuffix).replaceAll('\\', '/');
    const chunks = Object.entries(manifest.chunks).filter(([, chunk]) => Array.isArray(chunk.modules) && chunk.modules.some(id => id === wanted || id.endsWith('/' + wanted))).map(([name]) => name);
    if (!chunks.length) throw new Error(`Frontend source was not bundled: ${wanted}`);
    return chunks;
}
function readModuleChunks(moduleSuffix, manifest = loadFrontendManifest()) {
    return findModuleChunks(moduleSuffix, manifest).map(name => fs.readFileSync(safePath(runtimeRoot, name), 'utf8')).join('\n');
}
function verifyFrontendManifest() {
    const manifest = loadFrontendManifest();
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (manifest.productVersion !== pkg.version || manifest.upstream?.version !== pkg.nexowattUpstream?.version || manifest.upstream?.commit !== pkg.nexowattUpstream?.commit) throw new Error('Frontend product/upstream provenance mismatch');
    if (sha(JSON.stringify(manifest.sources)) !== manifest.sourceHash) throw new Error('Frontend source aggregate hash mismatch');
    for (const [relative, hash] of Object.entries(manifest.sources)) {
        if (!/^[a-f0-9]{64}$/.test(hash) || sha(fs.readFileSync(safePath(sourceRoot, relative))) !== hash) throw new Error(`Frontend source/build drift: ${relative}`);
    }
    const sourceFiles = [];
    function walk(dir, relative = '') {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = relative ? `${relative}/${entry.name}` : entry.name;
            if (entry.isSymbolicLink()) throw new Error(`Frontend symlink not allowed: ${rel}`);
            if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
            else if (entry.isFile()) sourceFiles.push(rel);
        }
    }
    for (const dir of ['src', 'public', 'build-tools']) walk(path.join(sourceRoot, dir), dir);
    for (const rel of sourceFiles) if (!Object.hasOwn(manifest.sources, rel)) throw new Error(`Unrecorded frontend source: ${rel}`);
    for (const [name, chunk] of Object.entries(manifest.chunks)) {
        safePath(runtimeRoot, name);
        for (const ref of [...chunk.imports, ...chunk.dynamicImports]) {
            if (!Object.hasOwn(manifest.chunks, ref) && !Object.hasOwn(manifest.assets || {}, ref)) throw new Error(`Frontend chunk import missing from receipt: ${name} -> ${ref}`);
            safePath(runtimeRoot, ref);
        }
    }
    for (const [name, asset] of Object.entries(manifest.assets || {})) {
        if (sha(fs.readFileSync(safePath(runtimeRoot, name))) !== asset.sha256) throw new Error(`Frontend asset hash mismatch: ${name}`);
        for (const ref of asset.imports) if (!Object.hasOwn(manifest.chunks, ref) && !Object.hasOwn(manifest.assets, ref)) throw new Error(`Frontend asset dependency missing: ${name} -> ${ref}`);
    }
    const html = fs.readFileSync(path.join(runtimeRoot, 'index.html'), 'utf8');
    const entry = html.match(/\bdata-eos-entry=["']([^"']+)["']/)?.[1]?.replace(/^\.\//, '');
    if (entry !== manifest.entry || !html.includes(manifest.roleBootstrap) || /<script\b[^>]*\btype=["']module["']/i.test(html)) throw new Error('Frontend must start only through the EOS role bootstrap');
    for (const required of ['src/index.tsx', 'src/bootstrap.tsx', 'src/components/Drawer.tsx', 'src/components/DrawerItem.tsx']) findModuleChunks(required, manifest);
    return manifest;
}


let parser;
function loadParser() {
    if (parser) return parser;
    const vendor = path.join(__dirname, 'vendor', 'acorn');
    const provenance = JSON.parse(fs.readFileSync(safePath(vendor, 'PROVENANCE.json'), 'utf8'));
    if (provenance.name !== 'acorn' || provenance.version !== '8.17.0' || provenance.license !== 'MIT') throw new Error('Unknown release parser provenance');
    for (const name of ['acorn.cjs', 'LICENSE']) if (sha(fs.readFileSync(safePath(vendor, name))) !== provenance.sha256?.[name]) throw new Error('Release parser integrity mismatch');
    parser = require('./vendor/acorn/acorn.cjs');
    if (parser.version !== provenance.version) throw new Error('Release parser version mismatch');
    return parser;
}

// Inspect emitted code as text only; never import/evaluate a release artifact.
function moduleReferences(text) {
    if (typeof text !== 'string' || Buffer.byteLength(text) > 64 * 1024 * 1024) throw new Error('Frontend module size limit');
    const acorn = loadParser();
    const tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
    const refs = new Set(), queue = [tree];
    let count = 0;
    while (queue.length) {
        const node = queue.pop();
        if (++count > 5000000) throw new Error('Frontend syntax tree size limit');
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) && typeof node.source?.value === 'string') refs.add(node.source.value);
        if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === '__mfImport' && node.arguments.length === 1 && typeof node.arguments[0]?.value === 'string') refs.add(node.arguments[0].value);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) { for (const child of value) if (child && typeof child.type === 'string') queue.push(child); }
            else if (value && typeof value.type === 'string') queue.push(value);
        }
    }
    return [...refs];
}
function resolveModuleReference(name, ref) {
    if (typeof ref !== 'string' || !ref.startsWith('.') || /[\\\x00-\x20\x7f:#?]/.test(ref)) throw new Error(`Non-local emitted import: ${name} -> ${String(ref).slice(0, 200)}`);
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), ref));
    if (!validRelative(target)) throw new Error(`Emitted import escapes root: ${name} -> ${ref}`);
    return target;
}
function inspectFrontendGraph(manifest = loadFrontendManifest(), base = runtimeRoot) {
    validateManifest(manifest);
    const modules = { ...manifest.chunks, ...(manifest.assets || {}) };
    const graph = {}, html5Backends = [];
    for (const [name, entry] of Object.entries(modules)) {
        const text = fs.readFileSync(safePath(base, name), 'utf8');
        if (/-v\d+\.js(?:["'?]|$)/.test(text)) throw new Error(`Stale runtime reference in ${name}`);
        if (text.includes('Cannot have two HTML5 backends at the same time')) html5Backends.push(name);
        const actual = moduleReferences(text).map(ref => resolveModuleReference(name, ref));
        const declared = [...entry.imports, ...(entry.dynamicImports || [])];
        if (entry.sha256 && sha(text) !== entry.sha256) throw new Error(`Frontend asset hash mismatch: ${name}`);
        for (const ref of actual) if (!declared.includes(ref)) throw new Error(`Unrecorded dependency edge: ${name} -> ${ref}`);
        graph[name] = [...new Set([...actual, ...declared])];
        for (const target of graph[name]) {
            safePath(base, target);
            if (!Object.hasOwn(modules, target)) throw new Error(`Unrecorded frontend module: ${name} -> ${target}`);
        }
        // Vite preload tables include CSS and JS resource paths relative to the
        // build root, although they are not ordinary import declarations.
        for (const map of text.matchAll(/m\.f\|\|\(m\.f=\[([\s\S]*?)\]\)/g)) {
            for (const item of map[1].matchAll(/["']([^"']+)["']/g)) {
                const target = item[1].startsWith('.') ? resolveModuleReference(name, item[1]) : item[1];
                safePath(base, target);
                if (/\.m?js$/.test(target) && !Object.hasOwn(modules, target)) throw new Error(`Unrecorded preload module: ${name} -> ${target}`);
            }
        }
    }
    const mfFile = safePath(base, 'mf-manifest.json');
    if (fs.statSync(mfFile).size > 1024 * 1024) throw new Error('Federation manifest too large');
    const federation = JSON.parse(fs.readFileSync(mfFile, 'utf8'));
    const remote = federation.metaData?.remoteEntry;
    if (!record(remote) || remote.type !== 'module' || typeof remote.path !== 'string' || !validRelative(remote.path + remote.name)) throw new Error('Invalid federation entry');
    const remoteEntry = remote.path + remote.name;
    if (!Object.hasOwn(modules, remoteEntry)) throw new Error('Unrecorded federation entry');
    for (const section of ['shared', 'exposes']) {
        if (!Array.isArray(federation[section]) || federation[section].length > 2000) throw new Error('Invalid federation assets');
        for (const row of federation[section]) for (const kind of ['js', 'css']) for (const timing of ['sync', 'async']) {
            const refs = row?.assets?.[kind]?.[timing];
            if (!Array.isArray(refs) || refs.length > 2000) throw new Error('Invalid federation resource list');
            for (const ref of refs) {
                safePath(base, ref);
                if (kind === 'js' && !Object.hasOwn(modules, ref)) throw new Error(`Unrecorded federation module: ${ref}`);
            }
        }
    }
    const reachable = new Set(), queue = [manifest.entry, remoteEntry];
    while (queue.length) { const name = queue.pop(); if (!reachable.has(name)) { reachable.add(name); queue.push(...graph[name]); } }
    return { graph, reachable: [...reachable], modules: Object.keys(modules), html5Backends, remoteEntry };
}
module.exports = { root, runtimeRoot, sourceRoot, safePath, loadFrontendManifest, findModuleChunks, readModuleChunks, verifyFrontendManifest, validateManifest, moduleReferences, resolveModuleReference, inspectFrontendGraph };
