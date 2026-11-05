'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { repair, identity, validateMetadata } = require('../tools/nexowatt-repair-lock-metadata.cjs');
const { run: admit } = require('../tools/nexowatt-lock-provenance-check.cjs');
const sri = `sha512-${Buffer.alloc(64, 7).toString('base64')}`;
const metadata = ({ name, version }) => ({ name, version, dist: { integrity: sri, tarball: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz` } });
function fixture(t, extra = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-lock-repair-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const folder of ['', 'src-admin']) {
        fs.mkdirSync(path.join(root, folder), { recursive: true });
        const manifest = { name: 'test-adapter', version: '1.0.0', dependencies: { sample: '1.2.3' } };
        const lock = { name: manifest.name, version: manifest.version, lockfileVersion: 3, packages: {
            '': manifest, 'node_modules/sample': { version: '1.2.3', dev: true, ...extra } } };
        fs.writeFileSync(path.join(root, folder, 'package.json'), JSON.stringify(manifest));
        fs.writeFileSync(path.join(root, folder, 'package-lock.json'), JSON.stringify(lock));
    }
    return root;
}
const read = (root, folder = '') => fs.readFileSync(path.join(root, folder, 'package-lock.json'), 'utf8');

test('exact registry repair preserves versions/graph, deduplicates metadata requests and admits both locks', async t => {
    const root = fixture(t), before = JSON.parse(read(root)); let calls = 0;
    const report = await repair({ root, write: true, fetchMetadata: async expected => { calls++; return metadata(expected); } });
    assert.equal(calls, 1); assert.equal(report.versionChanges, 0); assert.equal(admit(root).status, 'PASS');
    const after = JSON.parse(read(root)); delete after.packages['node_modules/sample'].resolved; delete after.packages['node_modules/sample'].integrity;
    assert.deepEqual(after, before); assert.ok(fs.existsSync(path.join(root, report.reportPath)));
    assert.equal(fs.readFileSync(path.join(root, path.dirname(report.reportPath), 'backend-package-lock.before.json'), 'utf8'), JSON.stringify(before));
});
test('dry run and already complete locks do not mutate inputs or fetch unnecessary metadata', async t => {
    const root = fixture(t), before = read(root);
    const result = await repair({ root, fetchMetadata: async expected => metadata(expected) });
    assert.equal(result.status, 'DRY_RUN'); assert.equal(read(root), before);
    await repair({ root, write: true, fetchMetadata: async expected => metadata(expected) });
    const repaired = read(root);
    const repeated = await repair({ root, write: true, fetchMetadata: async () => { throw new Error('Must not fetch'); } });
    assert.equal(repeated.packageMetadataRequests, 0); assert.equal(read(root), repaired);
});
test('aliases use actual package name, not installation directory', () => {
    const expected = identity('node_modules/string-width-cjs', { name: 'string-width', version: '4.2.3' });
    assert.deepEqual(expected, { name: 'string-width', version: '4.2.3' });
    assert.equal(validateMetadata(metadata(expected), expected).integrity, sri);
});
test('network failure leaves every input unchanged and never writes a success report', async t => {
    const root = fixture(t), before = [read(root), read(root, 'src-admin')];
    await assert.rejects(repair({ root, write: true, fetchMetadata: async () => { throw new Error('secret-token'); } }), { code: 'REGISTRY_UNAVAILABLE' });
    assert.deepEqual([read(root), read(root, 'src-admin')], before);
    assert.equal(fs.existsSync(path.join(root, 'reports')), false);
});
test('wrong package/version, weak or malformed digest and foreign tarball are rejected before writing', async t => {
    for (const change of [x => { x.name = 'other'; }, x => { x.version = '9.9.9'; },
        x => { x.dist.integrity = 'sha1-abc'; }, x => { x.dist.integrity = 'sha512-AAAA'; },
        x => { x.dist.tarball = 'http://registry.npmjs.org/sample/-/sample-1.2.3.tgz'; },
        x => { x.dist.tarball = 'https://attacker.invalid/sample/-/sample-1.2.3.tgz'; },
        x => { x.dist.tarball += '?token=secret'; },
        x => { x.dist.tarball = 'https://registry.npmjs.org/other/-/other-1.2.3.tgz'; }]) {
        const root = fixture(t), before = read(root);
        await assert.rejects(repair({ root, write: true, fetchMetadata: async expected => { const x = metadata(expected); change(x); return x; } }));
        assert.equal(read(root), before); assert.equal(fs.existsSync(path.join(root, 'reports')), false);
    }
});
test('existing conflicting or malformed metadata is never overwritten', async t => {
    const root = fixture(t, { resolved: 'https://registry.npmjs.org/sample/-/sample-1.2.3.tgz', integrity: 'sha1-invalid' });
    const before = read(root);
    await assert.rejects(repair({ root, write: true, fetchMetadata: async expected => metadata(expected) }), { code: 'EXISTING_METADATA_REQUIRES_REVIEW' });
    assert.equal(read(root), before);
    const other = fixture(t, { resolved: 'https://registry.npmjs.org/sample/-/sample-0.0.0.tgz' });
    await assert.rejects(repair({ root: other, write: true, fetchMetadata: async expected => metadata(expected) }), { code: 'EXISTING_METADATA_MISMATCH' });
});
test('concurrent package or lock changes are preserved and stop repair', async t => {
    const root = fixture(t), modified = JSON.stringify({ changedByDeveloper: true });
    await assert.rejects(repair({ root, write: true, fetchMetadata: async expected => {
        fs.writeFileSync(path.join(root, 'package-lock.json'), modified); return metadata(expected);
    } }), { code: 'CONCURRENT_INPUT_CHANGE' });
    assert.equal(read(root), modified);
});
test('second-lock commit failure restores both original locks and records rollback evidence', async t => {
    const root = fixture(t), before = [read(root), read(root, 'src-admin')];
    const frontendLock = path.join(root, 'src-admin', 'package-lock.json');
    const rename = fs.renameSync;
    let injected = false;
    fs.renameSync = function (source, destination) {
        if (!injected && destination === frontendLock) {
            injected = true;
            throw Object.assign(new Error('Injected sharing violation'), { code: 'EPERM' });
        }
        return rename.call(this, source, destination);
    };
    try {
        await assert.rejects(repair({ root, write: true, fetchMetadata: async expected => metadata(expected) }), { code: 'LOCK_WRITE_FAILED_ROLLED_BACK' });
    } finally {
        fs.renameSync = rename;
    }
    assert.equal(injected, true);
    assert.deepEqual([read(root), read(root, 'src-admin')], before);
    const reportRoot = path.join(root, 'reports/security/lock-repair');
    const [journal] = fs.readdirSync(reportRoot);
    const journalDir = path.join(reportRoot, journal);
    assert.equal(JSON.parse(fs.readFileSync(path.join(journalDir, 'repair.json'))).status, 'ROLLED_BACK');
    assert.equal(fs.readFileSync(path.join(journalDir, 'backend-package-lock.before.json'), 'utf8'), before[0]);
    assert.equal(fs.readFileSync(path.join(journalDir, 'frontend-package-lock.before.json'), 'utf8'), before[1]);
    for (const folder of ['', 'src-admin']) assert.equal(fs.readdirSync(path.join(root, folder)).some(name => name.includes('.repair-')), false);
});
test('rollback preserves a concurrent developer edit and reports that backup review is required', async t => {
    const root = fixture(t), beforeFrontend = read(root, 'src-admin');
    const frontendLock = path.join(root, 'src-admin', 'package-lock.json');
    const developerEdit = JSON.stringify({ changedByDeveloper: true });
    const rename = fs.renameSync;
    fs.renameSync = function (source, destination) {
        if (destination === frontendLock) {
            fs.writeFileSync(path.join(root, 'package-lock.json'), developerEdit);
            throw Object.assign(new Error('Injected sharing violation'), { code: 'EPERM' });
        }
        return rename.call(this, source, destination);
    };
    try {
        await assert.rejects(repair({ root, write: true, fetchMetadata: async expected => metadata(expected) }), { code: 'LOCK_WRITE_FAILED_REVIEW_BACKUP' });
    } finally {
        fs.renameSync = rename;
    }
    assert.equal(read(root), developerEdit);
    assert.equal(read(root, 'src-admin'), beforeFrontend);
    const reportRoot = path.join(root, 'reports/security/lock-repair');
    const [journal] = fs.readdirSync(reportRoot);
    assert.equal(JSON.parse(fs.readFileSync(path.join(reportRoot, journal, 'repair.json'))).status, 'ROLLBACK_REQUIRES_REVIEW');
});
test('registry transport has fixed five-second budget, TLS validation and no redirect/retry', () => {
    const tool = fs.readFileSync(path.join(__dirname, '../tools/nexowatt-repair-lock-metadata.cjs'), 'utf8');
    const transport = fs.readFileSync(path.join(__dirname, '../build/lib/eosHttpsClient.js'), 'utf8');
    assert.ok(tool.includes("allowedHosts: ['registry.npmjs.org'], maxBytes: 4 * 1024 * 1024, budgetMs: 5000"));
    assert.ok(transport.includes('rejectUnauthorized: true'));
    assert.ok(transport.includes("incoming.statusCode !== 200"));
    assert.ok(transport.includes("request?.destroy()"));
});
