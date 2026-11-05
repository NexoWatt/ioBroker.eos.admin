'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vendor = require('../tools/nexowatt-vendored-webserver.cjs');
const { inspect } = require('../tools/nexowatt-lock-provenance-check.cjs');
const { repair } = require('../tools/nexowatt-repair-lock-metadata.cjs');
const repository = path.resolve(__dirname, '..');
const originalLock = require('../package-lock.json');
const directNames = ['oauth2-server', 'jsonwebtoken', 'jwks-rsa'];
function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-vendor-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const folder of [vendor.SOURCE_ROOT, vendor.RUNTIME_ROOT]) {
        fs.mkdirSync(path.dirname(path.join(root, folder)), { recursive: true });
        fs.cpSync(path.join(repository, folder), path.join(root, folder), { recursive: true });
    }
    fs.mkdirSync(path.dirname(path.join(root, vendor.PROVENANCE)), { recursive: true });
    fs.copyFileSync(path.join(repository, vendor.PROVENANCE), path.join(root, vendor.PROVENANCE));
    const manifest = { name: 'iobroker.eos-admin', version: '8.0.1', dependencies: Object.fromEntries(directNames.map(name => [name, originalLock.packages[''].dependencies[name]])) };
    const lock = { name: manifest.name, version: manifest.version, lockfileVersion: 3, packages: { '': structuredClone(manifest), ...Object.fromEntries(directNames.map(name => [`node_modules/${name}`, structuredClone(originalLock.packages[`node_modules/${name}`])])) } };
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock));
    fs.mkdirSync(path.join(root, 'src-admin'));
    const frontend = { name: 'frontend', version: '1.0.0' };
    fs.writeFileSync(path.join(root, 'src-admin/package.json'), JSON.stringify(frontend));
    fs.writeFileSync(path.join(root, 'src-admin/package-lock.json'), JSON.stringify({ ...frontend, lockfileVersion: 3, packages: { '': frontend } }));
    return { root, manifest, lock, inspect: () => inspect(manifest, lock, root) };
}
test('exact upstream source and emitted copies admit without installed dependencies or network repair', async t => {
    const f = fixture(t); assert.deepEqual(f.inspect(), []);
    const before = fs.readFileSync(path.join(f.root, 'package-lock.json'));
    const report = await repair({ root: f.root, write: true, fetchMetadata: async () => assert.fail('must not fetch') });
    assert.equal(report.packageMetadataRequests, 0); assert.ok(before.equals(fs.readFileSync(path.join(f.root, 'package-lock.json'))));
    assert.equal(fs.existsSync(path.join(f.root, 'node_modules')), false);
});
test('modified source cannot be repaired or silently resealed', async t => {
    const f = fixture(t); const file = path.join(f.root, vendor.SOURCE_ROOT, 'build/index.js');
    const bytes = fs.readFileSync(file); bytes[5] ^= 1; fs.writeFileSync(file, bytes);
    assert.equal(f.inspect()[0].code, 'VENDORED_SOURCE_BYTES_MISMATCH');
    await assert.rejects(repair({ root: f.root, write: true, fetchMetadata: async () => assert.fail('must not fetch') }), { code: 'LOCK_REQUIRES_MANUAL_REVIEW' });
    assert.ok(bytes.equals(fs.readFileSync(file)));
});
test('modified emitted JavaScript fails the upstream byte gate', t => {
    const f = fixture(t); const file = path.join(f.root, vendor.RUNTIME_ROOT, 'build/index.js');
    const bytes = fs.readFileSync(file); bytes[5] ^= 1; fs.writeFileSync(file, bytes);
    assert.equal(f.inspect()[0].code, 'VENDORED_SOURCE_BYTES_MISMATCH');
});
test('missing source and additional runtime files fail closed', t => {
    const f = fixture(t); fs.unlinkSync(path.join(f.root, vendor.SOURCE_ROOT, 'LICENSE'));
    assert.equal(f.inspect()[0].code, 'VENDORED_SOURCE_UNAVAILABLE');
    fs.copyFileSync(path.join(repository, vendor.SOURCE_ROOT, 'LICENSE'), path.join(f.root, vendor.SOURCE_ROOT, 'LICENSE'));
    fs.writeFileSync(path.join(f.root, vendor.RUNTIME_ROOT, 'unexpected.js'), 'module.exports = {};');
    assert.equal(f.inspect()[0].code, 'VENDORED_SOURCE_FILESET_MISMATCH');
});
test('symlinked source file is rejected even with correct target bytes', t => {
    const f = fixture(t); const file = path.join(f.root, vendor.SOURCE_ROOT, 'LICENSE'); const target = path.join(f.root, 'outside');
    fs.renameSync(file, target); fs.symlinkSync(target, file);
    assert.equal(f.inspect()[0].code, 'VENDORED_SOURCE_UNAVAILABLE');
});
test('symlinked source directory is rejected', t => {
    const f = fixture(t); const folder = path.join(f.root, vendor.SOURCE_ROOT); const target = path.join(f.root, 'outside');
    fs.renameSync(folder, target); fs.symlinkSync(target, folder, 'junction');
    assert.equal(f.inspect()[0].code, 'VENDORED_SOURCE_UNAVAILABLE');
});
test('modified provenance cannot bless different source bytes', t => {
    const f = fixture(t); fs.appendFileSync(path.join(f.root, vendor.PROVENANCE), '\n');
    assert.equal(f.inspect()[0].code, 'VENDORED_PROVENANCE_MISMATCH');
});
test('root identity enforces vendoring when alias marker and lock entry are deleted', async t => {
    const f = fixture(t); delete f.manifest.dependencies['oauth2-server']; delete f.lock.packages[''].dependencies['oauth2-server']; delete f.lock.packages['node_modules/oauth2-server'];
    assert.equal(f.inspect()[0].code, 'VENDORED_PACKAGE_METADATA_MISMATCH');
    fs.writeFileSync(path.join(f.root, 'package.json'), JSON.stringify(f.manifest)); fs.writeFileSync(path.join(f.root, 'package-lock.json'), JSON.stringify(f.lock));
    await assert.rejects(repair({ root: f.root, write: true, fetchMetadata: async () => assert.fail('must not fetch') }), { code: 'LOCK_REQUIRES_MANUAL_REVIEW' });
});
test('registry package substitution and file dependencies remain forbidden', t => {
    const f = fixture(t); f.lock.packages['node_modules/oauth2-server'].name = 'oauth2-server';
    assert.equal(f.inspect()[0].code, 'VENDORED_PACKAGE_METADATA_MISMATCH');
    f.lock.packages['node_modules/untrusted'] = { version: '1.0.0', resolved: 'file:unexpected.tgz', integrity: originalLock.packages['node_modules/oauth2-server'].integrity };
    assert.ok(f.inspect().some(issue => issue.code === 'REGISTRY_ORIGIN_UNVERIFIED'));
});
test('runtime uses local upstream source and declared maintained registry dependencies', () => {
    const pkg = require('../package.json');
    assert.equal(pkg.dependencies['@iobroker/webserver'], undefined);
    assert.equal(pkg.dependencies['oauth2-server'], vendor.OAUTH);
    assert.ok(Object.values(pkg.dependencies).every(value => !value.startsWith('file:')));
    for (const relative of [vendor.PROVENANCE, 'tools/nexowatt-vendored-webserver.cjs']) assert.ok(pkg.files.includes(relative));
    assert.equal(vendor.inspectVendoredWebserver(pkg, originalLock, repository), null);
});
