'use strict';

// Real npm lifecycle execution, isolated package, injected registry metadata.
// --dry-run is mandatory; the registry is unreachable loopback and credentials
// are not copied into the fixture. This does not assert a real npm upload.
// Copy preparation is an explicit orchestration stub here, like version/default
// preparation. Its real manifest, retirement and backup behavior is tested by
// eos-copy-update.test.cjs and the complete old-release overlay validation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repository = path.resolve(__dirname, '..');
const sourcePackage = JSON.parse(fs.readFileSync(path.join(repository, 'package.json'), 'utf8'));
const repairModule = path.join(repository, 'tools/nexowatt-repair-lock-metadata.cjs');
const admissionModule = path.join(repository, 'tools/nexowatt-lock-provenance-check.cjs');
const inventoryModule = path.join(repository, 'tools/nexowatt-security-inventory.cjs');

function npmCli() {
    const candidates = [process.env.npm_execpath,
        path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
        path.join(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
    for (const candidate of candidates) if (candidate && /\.(?:c?js)$/.test(candidate) && fs.existsSync(candidate)) return candidate;
    assert.fail('npm CLI unavailable; run this lifecycle test through npm run test:eos-security-audit.');
}

function fixture(t, failRegistry = false, failCopyPreparation = false) {
    // A space in the path also exercises the normal Windows VS Code layout.
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos direct publish-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(path.join(directory, 'tools'));
    fs.mkdirSync(path.join(directory, 'src-admin'));
    const scripts = {};
    for (const match of `${sourcePackage.scripts.prepublishOnly} ${sourcePackage.scripts['repair:eos-lock']}`.matchAll(/npm run ([a-zA-Z0-9:._-]+)/g)) {
        scripts[match[1]] = `node fixture.cjs ${match[1]}`;
    }
    // These are the delivered orchestration strings, not a reconstructed chain.
    for (const name of ['prepublishOnly', 'repair:eos-lock', 'security:inventory', 'check:eos-production-release']) scripts[name] = sourcePackage.scripts[name];
    scripts.prepack = 'node fixture.cjs prepack';
    const manifest = { name: 'eos-direct-publish-fixture', version: '1.0.0',
        license: 'UNLICENSED', files: ['marker.txt'], dependencies: { sample: '1.2.3' }, scripts };
    for (const folder of ['', 'src-admin']) {
        const pkg = folder ? { name: 'eos-direct-publish-frontend-fixture', version: '1.0.0', dependencies: { sample: '1.2.3' } } : manifest;
        fs.writeFileSync(path.join(directory, folder, 'package.json'), JSON.stringify(pkg));
        fs.writeFileSync(path.join(directory, folder, 'package-lock.json'), JSON.stringify({ name: pkg.name,
            version: pkg.version, lockfileVersion: 3, packages: { '': pkg, 'node_modules/sample': { version: '1.2.3' } } }));
    }
    fs.writeFileSync(path.join(directory, 'marker.txt'), 'isolated npm dry-run fixture\n');
    const runner = `
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { repair } = require(${JSON.stringify(repairModule)});
const { run: admit } = require(${JSON.stringify(admissionModule)});
const { generate: inventory } = require(${JSON.stringify(inventoryModule)});
const record = event => fs.appendFileSync('events.jsonl', JSON.stringify(event) + '\\n');
async function main(event) {
    if (event === 'prepare-copy-update') {
        record(event);
        if (${JSON.stringify(failCopyPreparation)}) {
            const error = new Error('Injected copy preparation rejection');
            error.code = 'COPY_UPDATE_REJECTED';
            throw error;
        }
    } else if (event === 'repair') {
        record('repair:start');
        const result = await repair({ root: process.cwd(), write: true, fetchMetadata: async expected => {
            record('registry:' + expected.name + '@' + expected.version);
            if (${JSON.stringify(failRegistry)}) throw new Error('Injected network failure');
            return { ...expected, dist: { integrity: 'sha512-' + Buffer.alloc(64, 7).toString('base64'),
                tarball: 'https://registry.npmjs.org/' + expected.name + '/-/' + expected.name.split('/').at(-1) + '-' + expected.version + '.tgz' } };
        }});
        if (result.versionChanges !== 0) throw new Error('Unexpected version mutation');
        record('repair:complete');
    } else {
        if (['security:inventory', 'check:eos-production-release', 'prepack'].includes(event) && admit(process.cwd()).status !== 'PASS') throw new Error('Unadmitted lock reached downstream lifecycle');
        if (event === 'security:inventory') inventory(process.cwd(), path.join(process.cwd(), 'reports/security'));
        record(event);
    }
}
module.exports = event => main(event).catch(error => { record('failure:' + (error.code || 'FIXTURE_FAILURE')); process.exitCode = 1; });
if (require.main === module) module.exports(process.argv[2]);
`;
    fs.writeFileSync(path.join(directory, 'fixture.cjs'), runner);
    for (const [tool, event] of [['nexowatt-prepare-copy-update.cjs', 'prepare-copy-update'],
        ['nexowatt-repair-lock-metadata.cjs', 'repair'],
        ['nexowatt-security-inventory.cjs', 'security:inventory'], ['nexowatt-lock-provenance-check.cjs', 'check:eos-production-release']]) {
        fs.writeFileSync(path.join(directory, 'tools', tool), `require('../fixture.cjs')(${JSON.stringify(event)});\n`);
    }
    for (const name of ['user.npmrc', 'global.npmrc']) fs.writeFileSync(path.join(directory, name), '');
    return directory;
}

function publishDryRun(directory) {
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
        !/^npm_config_/i.test(name) && !/(?:token|password|secret|auth)/i.test(name)));
    env.npm_config_dry_run = 'true';
    env.npm_config_ignore_scripts = 'false';
    env.npm_config_audit = 'false';
    env.npm_config_fund = 'false';
    const result = spawnSync(process.execPath, [npmCli(), 'publish', '--dry-run', '--ignore-scripts=false',
        '--registry=http://127.0.0.1:9', '--fetch-retries=0', '--fetch-timeout=1000',
        `--userconfig=${path.join(directory, 'user.npmrc')}`, `--globalconfig=${path.join(directory, 'global.npmrc')}`,
        `--cache=${path.join(directory, 'cache')}`], {
        cwd: directory, env, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
    });
    assert.equal(result.error, undefined, result.error?.message);
    return result;
}
const events = directory => fs.readFileSync(path.join(directory, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const locks = directory => ['', 'src-admin'].map(folder => fs.readFileSync(path.join(directory, folder, 'package-lock.json'), 'utf8'));

test('plain publish lifecycle repairs exact missing metadata before inventory, admission and packaging; a repeated publish needs no registry fetch', { timeout: 120000 }, t => {
    const directory = fixture(t);
    const before = locks(directory).map(JSON.parse);
    const first = publishDryRun(directory);
    assert.equal(first.status, 0, first.stderr);
    const observed = events(directory);
    assert.deepEqual(observed.slice(0, 7), ['prepare-copy-update', 'sync:eos-version', 'repair:start', 'registry:sample@1.2.3',
        'repair:complete', 'security:inventory', 'check:eos-production-release']);
    assert.ok(observed.indexOf('check:eos-production-release') < observed.indexOf('check:eos-stability'));
    assert.ok(observed.indexOf('check:eos-stability') < observed.indexOf('prepack'));
    const inventory = JSON.parse(fs.readFileSync(path.join(directory, 'reports/security/inventory-summary.json'), 'utf8'));
    assert.equal(inventory.inventories.length, 2);
    for (const scope of inventory.inventories) {
        assert.equal(scope.withoutIntegrityCount, 0);
        assert.equal(scope.manifestDrift.length, 0);
    }
    for (const [index, serialized] of locks(directory).entries()) {
        const actual = JSON.parse(serialized);
        assert.match(actual.packages['node_modules/sample'].integrity, /^sha512-/);
        delete actual.packages['node_modules/sample'].resolved;
        delete actual.packages['node_modules/sample'].integrity;
        assert.deepEqual(actual, before[index]);
    }
    const repairedLocks = locks(directory);
    fs.writeFileSync(path.join(directory, 'events.jsonl'), '');
    const second = publishDryRun(directory);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(locks(directory), repairedLocks);
    assert.deepEqual(events(directory).slice(0, 6), ['prepare-copy-update', 'sync:eos-version', 'repair:start', 'repair:complete',
        'security:inventory', 'check:eos-production-release']);
    assert.equal(events(directory).some(event => event.startsWith('registry:')), false);
});

test('plain publish lifecycle stops on registry failure before inventory, admission, subsequent checks or packaging', { timeout: 60000 }, t => {
    const directory = fixture(t, true);
    const before = locks(directory);
    const result = publishDryRun(directory);
    assert.notEqual(result.status, 0);
    assert.deepEqual(events(directory), ['prepare-copy-update', 'sync:eos-version', 'repair:start', 'registry:sample@1.2.3', 'failure:REGISTRY_UNAVAILABLE']);
    assert.deepEqual(locks(directory), before);
    assert.equal(fs.existsSync(path.join(directory, 'reports')), false);
});

test('plain publish lifecycle stops a rejected copy preparation before version sync or lock repair', { timeout: 60000 }, t => {
    const directory = fixture(t, false, true);
    const before = locks(directory);
    const result = publishDryRun(directory);
    assert.notEqual(result.status, 0);
    assert.deepEqual(events(directory), ['prepare-copy-update', 'failure:COPY_UPDATE_REJECTED']);
    assert.deepEqual(locks(directory), before);
    assert.equal(fs.existsSync(path.join(directory, 'reports')), false);
});
