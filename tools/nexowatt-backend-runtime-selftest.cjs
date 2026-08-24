#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'build', 'main.js');
const failures = [];
const visited = new Set();
const runtimeFiles = new Set();

function fail(message) {
    failures.push(message);
}

function resolveLocal(fromFile, specifier) {
    const base = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
    if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        const packageFile = path.join(base, 'package.json');
        if (fs.existsSync(packageFile)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                if (packageJson.main) candidates.unshift(path.resolve(base, packageJson.main));
            } catch (error) {
                fail(`${path.relative(root, packageFile)} is invalid JSON: ${error.message}`);
            }
        }
    }
    return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function inspect(file) {
    const absolute = path.resolve(file);
    if (visited.has(absolute)) return;
    visited.add(absolute);
    runtimeFiles.add(absolute);

    if (!fs.existsSync(absolute)) {
        fail(`missing runtime file ${path.relative(root, absolute)}`);
        return;
    }
    if (!absolute.endsWith('.js')) return;

    const text = fs.readFileSync(absolute, 'utf8');
    const patterns = [
        /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\brequire\.resolve\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text))) {
            const specifier = match[1];
            if (!specifier.startsWith('.')) continue;
            const target = resolveLocal(absolute, specifier);
            if (!target) {
                fail(`${path.relative(root, absolute)} -> ${specifier} cannot be resolved`);
                continue;
            }
            inspect(target);
        }
    }
}

if (!fs.existsSync(entry)) fail('build/main.js is missing');
else inspect(entry);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-backend-check-'));
try {
    for (const file of runtimeFiles) {
        if (!file.endsWith('.js')) continue;
        const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
        if (result.status !== 0) {
            fail(`${path.relative(root, file)} does not parse: ${(result.stderr || result.stdout || '').trim()}`);
        }
    }

    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const packed = spawnSync(npm, ['pack', '--dry-run', '--ignore-scripts', '--json'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, npm_config_loglevel: 'silent' },
    });
    if (packed.status !== 0) {
        fail(`npm pack --dry-run failed: ${(packed.stderr || packed.stdout || '').trim()}`);
    } else {
        try {
            const report = JSON.parse(packed.stdout);
            const files = new Set((report[0]?.files || []).map(item => item.path.replace(/\\/g, '/')));
            for (const file of runtimeFiles) {
                const relative = path.relative(root, file).replace(/\\/g, '/');
                if (!files.has(relative)) fail(`runtime dependency is missing from npm artifact: ${relative}`);
            }
        } catch (error) {
            fail(`cannot parse npm pack report: ${error.message}`);
        }
    }
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}

for (const required of [
    'build/main.js',
    'build/lib/web.js',
    'build/lib/eosAutoUpdate.js',
    'build/lib/eosRequestSecurity.js',
]) {
    if (!runtimeFiles.has(path.join(root, required))) {
        fail(`entrypoint closure does not include required module ${required}`);
    }
}

if (failures.length) {
    console.error(`[NexoWatt EOS backend runtime] ${failures.length} failure(s):\n${failures.join('\n')}`);
    process.exit(1);
}

console.log(`[NexoWatt EOS backend runtime] OK (${runtimeFiles.size} local runtime files resolve, parse and are included in npm pack)`);
