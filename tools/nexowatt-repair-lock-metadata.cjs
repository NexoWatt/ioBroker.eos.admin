#!/usr/bin/env node
'use strict';

// Repair only absent metadata for already locked exact versions. Never install,
// update dependency versions, execute package scripts, rebuild, seal or publish.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inspect } = require('./nexowatt-lock-provenance-check.cjs');
const { requestHttpsJson } = require('../build/lib/eosHttpsClient.js');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = code => Object.assign(new Error(code), { code });
const packagePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function identity(location, entry) {
    const name = entry.name || location.slice(location.lastIndexOf('node_modules/') + 13);
    if (typeof name !== 'string' || !packagePattern.test(name) || typeof entry.version !== 'string' || !versionPattern.test(entry.version)) throw fail('LOCK_PACKAGE_IDENTITY_INVALID');
    return { name, version: entry.version };
}

function validateMetadata(value, expected) {
    if (!value || value.name !== expected.name || value.version !== expected.version || !value.dist) throw fail('REGISTRY_IDENTITY_MISMATCH');
    const { tarball, integrity } = value.dist;
    if (typeof integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity)) throw fail('REGISTRY_STRONG_INTEGRITY_MISSING');
    const bytes = Buffer.from(integrity.slice(7), 'base64');
    if (bytes.length !== 64 || `sha512-${bytes.toString('base64')}` !== integrity) throw fail('REGISTRY_INTEGRITY_INVALID');
    let url;
    try { url = new URL(tarball); } catch { throw fail('REGISTRY_TARBALL_INVALID'); }
    const basename = expected.name.split('/').at(-1);
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { throw fail('REGISTRY_TARBALL_INVALID'); }
    if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' || url.port || url.username || url.password || url.search || url.hash ||
        pathname !== `/${expected.name}/-/${basename}-${expected.version}.tgz`) throw fail('REGISTRY_TARBALL_INVALID');
    return { resolved: url.href, integrity };
}

async function defaultFetch(expected) {
    try {
        return await requestHttpsJson(`https://registry.npmjs.org/${encodeURIComponent(expected.name)}/${encodeURIComponent(expected.version)}`, {
            allowedHosts: ['registry.npmjs.org'], maxBytes: 4 * 1024 * 1024, budgetMs: 5000,
        });
    } catch { throw fail('REGISTRY_UNAVAILABLE'); }
}

async function repair({ root = path.resolve(__dirname, '..'), fetchMetadata = defaultFetch, write = false, progress = () => {} } = {}) {
    const scopes = [];
    const tasks = new Map();
    for (const [scope, folder] of [['backend', ''], ['frontend', 'src-admin']]) {
        const manifestPath = path.join(root, folder, 'package.json');
        const lockPath = path.join(root, folder, 'package-lock.json');
        for (const filename of [manifestPath, lockPath]) {
            const stat = fs.lstatSync(filename);
            if (!stat.isFile() || stat.isSymbolicLink()) throw fail('LOCK_INPUT_NOT_REGULAR');
        }
        const original = fs.readFileSync(lockPath);
        const manifestRaw = fs.readFileSync(manifestPath);
        const lock = JSON.parse(original);
        const manifest = JSON.parse(manifestRaw);
        const issues = inspect(manifest, lock);
        if (issues.some(issue => !['STRONG_INTEGRITY_MISSING', 'REGISTRY_ORIGIN_UNVERIFIED'].includes(issue.code))) throw fail('LOCK_REQUIRES_MANUAL_REVIEW');
        const locations = [...new Set(issues.map(issue => issue.location))];
        for (const location of locations) {
            const entry = lock.packages[location];
            // Existing malformed/weak/non-registry values are not silently replaced.
            if (issues.some(issue => issue.location === location &&
                ((issue.code === 'STRONG_INTEGRITY_MISSING' && entry.integrity !== undefined) ||
                 (issue.code === 'REGISTRY_ORIGIN_UNVERIFIED' && entry.resolved !== undefined)))) throw fail('EXISTING_METADATA_REQUIRES_REVIEW');
            const expected = identity(location, entry);
            const key = `${expected.name}@${expected.version}`;
            if (!tasks.has(key)) tasks.set(key, { expected, targets: [] });
            tasks.get(key).targets.push({ scope, location, entry });
        }
        scopes.push({ scope, manifestPath, lockPath, manifestRaw, manifest, original, lock, locations });
    }
    const queue = [...tasks.values()];
    let cursor = 0, completed = 0, firstFailure;
    const evidence = [];
    async function worker() {
        while (!firstFailure && cursor < queue.length) {
            const task = queue[cursor++];
            try {
                const metadata = validateMetadata(await fetchMetadata(task.expected), task.expected);
                for (const target of task.targets) {
                    for (const field of ['resolved', 'integrity']) {
                        if (target.entry[field] !== undefined && target.entry[field] !== metadata[field]) throw fail('EXISTING_METADATA_MISMATCH');
                        target.entry[field] = metadata[field];
                    }
                }
                evidence.push({ ...task.expected, ...metadata, retrievedAt: new Date().toISOString(),
                    locations: task.targets.map(({ scope, location }) => ({ scope, location })) });
                completed++;
                if (completed % 50 === 0 || completed === queue.length) progress(completed, queue.length);
            } catch (error) {
                firstFailure ||= fail(['REGISTRY_IDENTITY_MISMATCH', 'REGISTRY_STRONG_INTEGRITY_MISSING', 'REGISTRY_INTEGRITY_INVALID', 'REGISTRY_TARBALL_INVALID', 'EXISTING_METADATA_MISMATCH'].includes(error?.code) ? error.code : 'REGISTRY_UNAVAILABLE');
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
    if (firstFailure) throw firstFailure;
    for (const item of scopes) {
        if (inspect(item.manifest, item.lock).length) throw fail('REPAIRED_LOCK_NOT_ADMITTED');
        if (!fs.readFileSync(item.lockPath).equals(item.original) || !fs.readFileSync(item.manifestPath).equals(item.manifestRaw)) throw fail('CONCURRENT_INPUT_CHANGE');
        item.output = Buffer.from(`${JSON.stringify(item.lock, null, 2)}\n`);
    }
    const changed = scopes.filter(item => item.locations.length);
    const report = { schemaVersion: 1, utc: new Date().toISOString(), status: write ? 'REPAIRED' : 'DRY_RUN',
        environment: { node: process.version, platform: process.platform, arch: process.arch },
        toolSha256: hash(fs.readFileSync(__filename)),
        transportSha256: hash(fs.readFileSync(require.resolve('../build/lib/eosHttpsClient.js'))),
        scope: 'Official npm registry metadata for exact existing versions; no package tarball bytes, publisher attestation, install, build or CVE check.',
        versionChanges: 0, packageMetadataRequests: queue.length,
        locks: scopes.map(item => ({ scope: item.scope, repairedLocations: item.locations.length,
            beforeSha256: hash(item.original), afterSha256: hash(item.locations.length ? item.output : item.original) })),
        packages: evidence.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)) };
    if (!write || !changed.length) return report;
    const journalDir = path.join(root, 'reports/security/lock-repair', `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`);
    fs.mkdirSync(journalDir, { recursive: true, mode: 0o700 });
    const journalPath = path.join(journalDir, 'repair.json');
    fs.writeFileSync(journalPath, `${JSON.stringify({ ...report, status: 'PREPARED' }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    const staged = [], committed = [];
    try {
        for (const item of changed) {
            fs.writeFileSync(path.join(journalDir, `${item.scope}-package-lock.before.json`), item.original, { flag: 'wx', mode: 0o600 });
            item.temporary = `${item.lockPath}.repair-${crypto.randomBytes(8).toString('hex')}`;
            fs.writeFileSync(item.temporary, item.output, { flag: 'wx', mode: 0o600 });
            staged.push(item);
        }
        for (const item of staged) {
            if (!fs.readFileSync(item.lockPath).equals(item.original) || !fs.readFileSync(item.manifestPath).equals(item.manifestRaw)) throw fail('CONCURRENT_INPUT_CHANGE');
            fs.renameSync(item.temporary, item.lockPath);
            committed.push(item);
        }
        fs.writeFileSync(journalPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    } catch (error) {
        let rolledBack = true;
        for (const item of committed.reverse()) {
            try {
                if (!fs.readFileSync(item.lockPath).equals(item.output)) { rolledBack = false; continue; }
                fs.writeFileSync(item.temporary, item.original, { flag: 'wx', mode: 0o600 });
                fs.renameSync(item.temporary, item.lockPath);
            } catch { rolledBack = false; }
        }
        try { fs.writeFileSync(journalPath, `${JSON.stringify({ ...report, status: rolledBack ? 'ROLLED_BACK' : 'ROLLBACK_REQUIRES_REVIEW' }, null, 2)}\n`); } catch { /* Original backup files remain. */ }
        throw fail(rolledBack ? 'LOCK_WRITE_FAILED_ROLLED_BACK' : 'LOCK_WRITE_FAILED_REVIEW_BACKUP');
    } finally {
        for (const item of staged) {
            try { if (fs.existsSync(item.temporary)) fs.unlinkSync(item.temporary); } catch { /* Staged public metadata may remain; never replace the recorded commit/rollback outcome. */ }
        }
    }
    return { ...report, reportPath: path.relative(root, journalPath).split(path.sep).join('/') };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--write')) { console.error('Usage: node tools/nexowatt-repair-lock-metadata.cjs [--write]'); process.exitCode = 1; }
    else repair({ write: args.includes('--write'), progress: (n, total) => console.log(`Registry metadata: ${n}/${total}`) }).then(report => {
        console.log(`EOS lock metadata ${report.status}: ${report.locks.reduce((n, item) => n + item.repairedLocations, 0)} entries; 0 version changes.`);
        if (report.reportPath) console.log(`Evidence and original lock backups: ${report.reportPath}`);
    }).catch(error => {
        console.error(`EOS lock repair stopped: ${error?.code || 'LOCAL_INPUT_ERROR'}. No package was installed or published.`);
        if (error?.code === 'REGISTRY_UNAVAILABLE') console.error('Check direct HTTPS access to registry.npmjs.org, then retry npm publish. The repair runs automatically; TLS validation remains enabled.');
        process.exitCode = 1;
    });
}

module.exports = { identity, validateMetadata, repair };
