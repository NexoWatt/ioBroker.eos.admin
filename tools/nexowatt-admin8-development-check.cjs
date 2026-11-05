#!/usr/bin/env node
'use strict';
// Integration tests run on the real installed build toolchain. A source-bound
// receipt allows the finished repository to publish without installing tools or
// silently skipping those tests. Any relevant change invalidates the receipt.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const receiptPath = path.join(root, 'release-manifests/admin8-development-validation.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const DEVELOPMENT_TESTS = ['eos-admin8-backend.test.cjs', 'eos-admin8-web.test.cjs', 'eos-instance-proxy.test.cjs'];
function commands() {
    return [
        ['node_modules/mocha/bin/mocha.js', 'test/package', '--exit'],
        ['--test', ...fs.readdirSync(path.join(root, 'test')).filter(name => /^eos-.*\.test\.cjs$/.test(name)).sort().map(name => `test/${name}`)],
        ['tools/nexowatt-admin8-objectbrowser-fixtures.mjs', '--check'],
        ['tools/nexowatt-admin8-objectbrowser-selftest.mjs'],
        ['tools/nexowatt-markdown-security-selftest.mjs'],
        ['tools/nexowatt-custom-config-security-selftest.mjs'],
        ['tools/nexowatt-admin8-overview-selftest.cjs'],
        ['tools/nexowatt-admin8-public-assets-selftest.mjs'],
    ];
}
function inputs() {
    const files = [];
    function walk(relative) {
        const absolute = path.join(root, relative);
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) throw new Error(`Symlink in validated build inputs: ${relative}`);
        if (stat.isDirectory()) for (const name of fs.readdirSync(absolute).sort()) walk(`${relative}/${name}`);
        else if (stat.isFile()) files.push(relative);
    }
    for (const dir of ['src', 'build', 'test', 'tools', 'src-admin/src', 'src-admin/public', 'src-admin/build-tools']) walk(dir);
    for (const file of ['package.json', 'package-lock.json', 'io-package.json', 'tsconfig.json', 'tsconfig.build.json', 'tasks.mts', 'src-admin/package.json', 'src-admin/package-lock.json', 'src-admin/index.html', 'src-admin/vite.config.ts', 'src-admin/tsconfig.json', 'adminWww/NEXOWATT_EOS_FRONTEND_MANIFEST.json']) walk(file);
    return Object.fromEntries([...new Set(files)].sort().map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
}
function verifyDevelopmentReceipt() {
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    const current = inputs();
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (receipt.schemaVersion !== 1 || receipt.version !== pkg.version || receipt.inputHash !== sha(JSON.stringify(current)) || JSON.stringify(receipt.inputs) !== JSON.stringify(current)) throw new Error('Admin8 development validation is missing or stale; rebuild and validate the changed sources before sealing');
    const expected = commands();
    if (receipt.commands.length !== expected.length || receipt.commands.some((record, i) => record.status !== 0 || JSON.stringify(record.args) !== JSON.stringify(expected[i]))) throw new Error('Admin8 development validation did not pass every required test');
    for (const [index, record] of receipt.commands.entries()) {
        const expectedLog = `docs/security/admin8-2026-11-04/development-${index + 1}.log`;
        if (record.log !== expectedLog || !/^[a-f0-9]{64}$/.test(record.outputSha256) || sha(fs.readFileSync(path.join(root, expectedLog))) !== record.outputSha256) throw new Error('Admin8 development test output changed or is missing');
    }
    console.log(`[NexoWatt EOS Admin8 development evidence] OK: ${Object.keys(current).length} unchanged inputs, ${expected.length} successful test commands`);
    return receipt;
}
function runDevelopmentChecks() {
    const before = inputs();
    const evidenceRoot = path.join(root, 'docs/security/admin8-2026-11-04');
    fs.mkdirSync(evidenceRoot, { recursive: true });
    const records = commands().map((args, i) => {
        const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 12 * 1024 * 1024 });
        const output = `${result.stdout || ''}${result.stderr || ''}${result.error ? `\n${result.error.message}` : ''}`;
        const log = `development-${i + 1}.log`;
        fs.writeFileSync(path.join(evidenceRoot, log), output);
        process.stdout.write(output);
        if (result.error || result.status !== 0) throw new Error(`Admin8 development check failed: ${args.join(' ')} (${result.status})`);
        return { args, status: 0, outputSha256: sha(output), log: `docs/security/admin8-2026-11-04/${log}` };
    });
    const after = inputs();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Build inputs changed while tests ran; receipt not written');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify({ schemaVersion: 1, version: pkg.version, node: process.version, testedAt: new Date().toISOString(), inputHash: sha(JSON.stringify(after)), inputs: after, commands: records }, null, 2) + '\n');
    verifyDevelopmentReceipt();
}
if (require.main === module) {
    try { process.argv.includes('--write') ? runDevelopmentChecks() : verifyDevelopmentReceipt(); }
    catch (error) { console.error(`[NexoWatt EOS Admin8 development evidence] ${error.message}`); process.exitCode = 1; }
}
module.exports = { DEVELOPMENT_TESTS, verifyDevelopmentReceipt, runDevelopmentChecks };
