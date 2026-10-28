'use strict';

// Exercise the actual admission CLI in fresh repository fixtures. No install,
// network request, lifecycle preparation, npm pack or publish is executed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run } = require('../tools/nexowatt-lock-provenance-check.cjs');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function cli(directory) {
    return spawnSync(process.execPath, [path.join(directory, 'tools/nexowatt-lock-provenance-check.cjs')], {
        cwd: directory, encoding: 'utf8', timeout: 5000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
    });
}

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-release-admission-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(path.join(directory, 'tools'));
    fs.mkdirSync(path.join(directory, 'src-admin'));
    for (const tool of ['nexowatt-lock-provenance-check.cjs', 'nexowatt-security-inventory.cjs']) {
        fs.copyFileSync(path.join(root, 'tools', tool), path.join(directory, 'tools', tool));
    }
    for (const folder of ['', 'src-admin']) {
        const manifest = { name: 'audit-fixture', version: '1.0.0', dependencies: { sample: '1.0.0' } };
        const lock = { ...manifest, lockfileVersion: 3, packages: {
            '': manifest,
            'node_modules/sample': { version: '1.0.0', resolved: 'https://registry.npmjs.org/sample/-/sample-1.0.0.tgz', integrity: `sha512-${Buffer.alloc(64).toString('base64')}` },
        } };
        fs.writeFileSync(path.join(directory, folder, 'package.json'), JSON.stringify(manifest));
        fs.writeFileSync(path.join(directory, folder, 'package-lock.json'), JSON.stringify(lock));
    }
    return directory;
}

test('local publish and release paths require actual admission; candidate packaging remains separate', () => {
    const scripts = packageJson.scripts;
    assert.equal(scripts['check:eos-production-release'], 'node tools/nexowatt-lock-provenance-check.cjs');
    assert.match(scripts.prepublishOnly, /^npm run sync:eos-version && npm run check:eos-production-release && /);
    assert.match(scripts['check:eos-release'], /^npm run check:eos-production-release && /);
    assert.doesNotMatch(scripts.prepack, /production-release|lock-provenance/);
    assert.match(scripts.prepack, /nexowatt-prebuilt-release-selftest\.cjs$/);
});

test('actual repository CLI returns nonzero whenever its current lock metadata is blocked', () => {
    const expected = run(root);
    const child = cli(root);
    assert.equal(child.error, undefined);
    assert.equal(child.status, expected.status === 'PASS' ? 0 : 1);
    const actual = JSON.parse(child.stdout);
    assert.equal(actual.status, expected.status);
    assert.deepEqual(actual.scopes, expected.scopes);
});

test('complete fixture metadata admits without fetching or executing any package', t => {
    const child = cli(fixture(t));
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0);
    assert.equal(JSON.parse(child.stdout).status, 'PASS');
});

test('missing integrity in one scope rejects the real admission process', t => {
    const directory = fixture(t);
    const filename = path.join(directory, 'src-admin/package-lock.json');
    const lock = JSON.parse(fs.readFileSync(filename, 'utf8'));
    delete lock.packages['node_modules/sample'].integrity;
    fs.writeFileSync(filename, JSON.stringify(lock));
    const child = cli(directory);
    assert.equal(child.error, undefined);
    assert.equal(child.status, 1);
    const report = JSON.parse(child.stdout);
    assert.equal(report.status, 'BLOCKED');
    assert(report.scopes.find(scope => scope.name === 'frontend').issues.some(issue => issue.code === 'STRONG_INTEGRITY_MISSING'));
});

test('missing lockfile fails closed instead of permitting a publish check', t => {
    const directory = fixture(t);
    fs.unlinkSync(path.join(directory, 'package-lock.json'));
    const child = cli(directory);
    assert.equal(child.error, undefined);
    assert.equal(child.status, 1);
    assert.match(child.stderr, /could not inspect required manifests/);
});
