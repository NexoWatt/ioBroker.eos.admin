'use strict';
// Exact-byte admission for the original upstream WebServer source distribution.
// Registry dependencies are declared at EOS root; no nested file: install is used.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SOURCE_ROOT = 'src/lib/vendor/webserver';
const RUNTIME_ROOT = 'build/lib/vendor/webserver';
const PROVENANCE = 'tools/vendor/webserver-3.4.0-source.provenance.json';
const PROVENANCE_SHA256 = '75384d81f77481f76c76c143d68ba2a7526f58dbb3dae772243f3708bc92b302';
const OAUTH = 'npm:@node-oauth/oauth2-server@5.3.1';
function required(manifest) {
    return manifest.name === 'iobroker.eos-admin' || manifest.dependencies?.['oauth2-server'] === OAUTH;
}
function readRegular(root, relative, maxBytes) {
    const parts = relative.split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) throw new Error('PATH');
    let current = path.resolve(root);
    for (const [index, part] of parts.entries()) {
        current = path.join(current, part);
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new Error('TYPE');
    }
    const descriptor = fs.openSync(current, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const stat = fs.fstatSync(descriptor);
        if (!stat.isFile() || stat.size > maxBytes) throw new Error('SIZE');
        return fs.readFileSync(descriptor);
    } finally { fs.closeSync(descriptor); }
}
function filesWithin(root, relative) {
    const files = [];
    function walk(directory, prefix, depth) {
        if (depth > 5 || files.length > 39) throw new Error('BOUND');
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isSymbolicLink()) throw new Error('LINK');
            if (entry.isDirectory()) walk(path.join(directory, entry.name), rel, depth + 1);
            else if (entry.isFile()) files.push(rel);
            else throw new Error('TYPE');
        }
    }
    walk(path.join(root, relative), '', 0);
    return files.sort();
}
function inspectVendoredWebserver(manifest, lock, root) {
    try {
        const bytes = readRegular(root, PROVENANCE, 64 * 1024);
        if (crypto.createHash('sha256').update(bytes).digest('hex') !== PROVENANCE_SHA256) return 'VENDORED_PROVENANCE_MISMATCH';
        const provenance = JSON.parse(bytes);
        if (manifest.dependencies?.['@iobroker/webserver'] || Object.keys(lock.packages || {}).some(name => name.endsWith('/@iobroker/webserver'))) return 'VENDORED_PACKAGE_METADATA_MISMATCH';
        for (const [name, expected] of Object.entries(provenance.directDependencies)) {
            const entry = lock.packages?.[`node_modules/${name}`];
            if (manifest.dependencies?.[name] !== expected.specifier || !entry || entry.link ||
                Object.entries(expected.entry).some(([key, value]) => entry[key] !== value)) return 'VENDORED_PACKAGE_METADATA_MISMATCH';
        }
        const expectedNames = provenance.files.map(file => file.path).sort();
        for (const folder of [SOURCE_ROOT, RUNTIME_ROOT]) {
            // lstat every parent, even when a directory itself is replaced with a symlink.
            for (const file of provenance.files) {
                const data = readRegular(root, `${folder}/${file.path}`, file.bytes);
                if (data.length !== file.bytes || crypto.createHash('sha256').update(data).digest('hex') !== file.sha256) return 'VENDORED_SOURCE_BYTES_MISMATCH';
            }
            if (JSON.stringify(filesWithin(root, folder)) !== JSON.stringify(expectedNames)) return 'VENDORED_SOURCE_FILESET_MISMATCH';
        }
    } catch { return 'VENDORED_SOURCE_UNAVAILABLE'; }
    return null;
}
module.exports = { SOURCE_ROOT, RUNTIME_ROOT, PROVENANCE, OAUTH, required, inspectVendoredWebserver };
