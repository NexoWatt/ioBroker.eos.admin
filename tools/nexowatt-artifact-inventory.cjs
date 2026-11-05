#!/usr/bin/env node
'use strict';
// Development evidence only: no package code execution, install or network.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const webserverVendor = require('./nexowatt-vendored-webserver.cjs');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function read(base, relative, max = 32 * 1024 * 1024) {
    if (typeof relative !== 'string' || !relative || relative.includes('\0') || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe evidence path');
    const actual = fs.realpathSync(path.resolve(base, relative)), allowed = fs.realpathSync(base);
    if (!actual.startsWith(`${allowed}${path.sep}`) || !fs.statSync(actual).isFile() || fs.statSync(actual).size > max) throw new Error('Evidence file outside root or size limit');
    return fs.readFileSync(actual);
}
function json(base, relative) { const raw = read(base, relative); return { raw, value: JSON.parse(raw) }; }
function tree(label, folder) {
    const lock = json(folder, 'package-lock.json'), manifest = json(folder, 'package.json');
    const components = [], absentOptional = [], failures = [];
    for (const [location, entry] of Object.entries(lock.value.packages)) {
        if (!location) continue;
        if (!location.startsWith('node_modules/')) throw new Error('Unsupported lock location');
        if (!fs.existsSync(path.join(folder, location, 'package.json'))) {
            (entry.optional ? absentOptional : failures).push({ location, version: entry.version, reason: entry.optional ? 'Optional package not installed on this platform' : 'Required package absent' });
            continue;
        }
        const installed = json(folder, `${location}/package.json`), expected = entry.name || location.slice(location.lastIndexOf('node_modules/') + 13);
        if (installed.value.name !== expected || installed.value.version !== entry.version) failures.push({ location, reason: 'Installed identity differs from lock' });
        components.push({ location, name: installed.value.name, version: installed.value.version,
            purl: `pkg:npm/${encodeURIComponent(installed.value.name).replace('%2F', '/')}@${encodeURIComponent(installed.value.version)}`,
            license: installed.value.license || entry.license || null, dev: entry.dev === true, optional: entry.optional === true,
            packageManifestSha256: hash(installed.raw), tarballIntegrity: entry.integrity, resolved: entry.resolved });
    }
    return { label, folder: label === 'backend' ? '.' : 'src-admin', manifestSha256: hash(manifest.raw), lockSha256: hash(lock.raw), components, absentOptional, failures };
}
function reviewedVendor(backend) {
    const folder = path.join(root, 'src-admin');
    const location = 'src/vendor/acorn';
    const provenance = json(folder, `${location}/PROVENANCE.json`);
    const source = backend.components.find(item => item.name === provenance.value.name && item.version === provenance.value.version);
    if (!source || provenance.value.name !== 'acorn' || provenance.value.registryIntegrity !== source.tarballIntegrity) throw new Error('Vendored parser provenance does not match audited package');
    const files = [];
    for (const [filename, original] of Object.entries(provenance.value.sourceFiles)) {
        const bytes = read(folder, `${location}/${filename}`);
        const upstream = read(root, `${source.location}/${original}`);
        if (hash(bytes) !== provenance.value.sha256[filename] || !bytes.equals(upstream)) throw new Error('Vendored parser differs from audited upstream bytes');
        files.push({ filename, upstream: `${source.location}/${original}`, bytes: bytes.length, sha256: hash(bytes) });
    }
    return { ...source, location, vendored: true, provenanceSha256: hash(provenance.raw), files, chunks: new Set(), modules: new Set() };
}
function composition(frontend, backend) {
    const www = path.join(root, 'adminWww'), manifest = json(www, 'NEXOWATT_EOS_FRONTEND_MANIFEST.json');
    const byLocation = new Map(frontend.components.map(item => [item.location, item]));
    const vendor = reviewedVendor(backend);
    const packages = new Map(), chunks = [], unclassifiedModules = [], virtual = new Set(), own = new Set(), all = new Set();
    for (const [filename, chunk] of Object.entries(manifest.value.chunks || {}).sort(([a], [b]) => a.localeCompare(b))) {
        const bytes = read(www, filename), locations = new Set();
        if (!Array.isArray(chunk.modules) || chunk.modules.length > 100000) throw new Error('Invalid module inventory');
        for (const moduleId of chunk.modules) {
            if (typeof moduleId !== 'string' || moduleId.length > 8192) throw new Error('Invalid module identifier');
            all.add(moduleId);
            if (moduleId.startsWith('node_modules/')) {
                const parts = moduleId.split('/'), at = parts.lastIndexOf('node_modules');
                const location = parts.slice(0, at + (parts[at + 1]?.startsWith('@') ? 3 : 2)).join('/');
                const component = byLocation.get(location);
                if (!component) { unclassifiedModules.push({ chunk: filename, module: moduleId, expectedPackageLocation: location }); continue; }
                locations.add(location);
                if (!packages.has(location)) packages.set(location, { ...component, chunks: new Set(), modules: new Set() });
                packages.get(location).chunks.add(filename); packages.get(location).modules.add(moduleId);
            } else if (moduleId.startsWith(`${vendor.location}/`)) {
                const vendorFilename = moduleId.slice(vendor.location.length + 1);
                if (!vendor.files.some(file => file.filename === vendorFilename)) { unclassifiedModules.push({ chunk: filename, module: moduleId }); continue; }
                vendor.chunks.add(filename); vendor.modules.add(moduleId);
            } else if (moduleId.startsWith('src/vendor/')) unclassifiedModules.push({ chunk: filename, module: moduleId });
            else if (moduleId.startsWith('src/') || moduleId === 'index.html') own.add(moduleId);
            else if (moduleId.startsWith('\0') || moduleId.startsWith('virtual:') || moduleId === '__vite-browser-external') virtual.add(moduleId);
            else unclassifiedModules.push({ chunk: filename, module: moduleId });
        }
        chunks.push({ filename, bytes: bytes.length, sha256: hash(bytes), declaredModuleCount: chunk.modules.length,
            packageLocations: [...locations].sort(), imports: chunk.imports || [], dynamicImports: chunk.dynamicImports || [] });
    }
    const additionalAssets = [];
    for (const [filename, declared] of Object.entries(manifest.value.assets || {})) {
        const bytes = read(www, filename), digest = hash(bytes);
        if (declared.sha256 && digest !== declared.sha256) throw new Error('Declared asset digest mismatch');
        additionalAssets.push({ filename, bytes: bytes.length, sha256: digest });
    }
    return { manifestSha256: hash(manifest.raw), productVersion: manifest.value.productVersion, sourceHash: manifest.value.sourceHash,
        scope: 'Actual chunk bytes and package associations from the Vite output-module manifest; installed packages are not automatically treated as browser content.',
        uniqueDeclaredModules: all.size, ownModuleCount: own.size, virtualModuleCount: virtual.size, chunks, additionalAssets,
        vendoredPackages: vendor.modules.size ? [{ ...vendor, chunks: [...vendor.chunks].sort(), modules: [...vendor.modules].sort() }] : [],
        checkedVendorSources: [{ name: vendor.name, version: vendor.version, location: vendor.location, provenanceSha256: vendor.provenanceSha256, bundledInThisManifest: vendor.modules.size > 0, files: vendor.files }],
        packages: [...packages.values()].map(item => ({ ...item, chunks: [...item.chunks].sort(), modules: [...item.modules].sort() })).sort((a, b) => a.location.localeCompare(b.location)), unclassifiedModules,
        limitations: ['Build module associations do not prove byte-level source attribution or that every export survives tree shaking.',
            'Dynamically loaded remote adapters/federation providers and deployed-device state are outside this artifact inventory.',
            'Standalone vendored assets are inventoried separately by nexowatt-security-inventory; unknown embedded third-party fragments are not inferred.'] };
}
function peers(trees) {
    const source = json(root, 'reports/security/inventory-summary.json'), scopes = [];
    for (const inventory of source.value.inventories || []) {
        const current = trees.find(item => item.label === inventory.label);
        if (!current || inventory.inputHashes?.lock !== current.lockSha256) throw new Error('Regenerate lock inventory before artifact inventory');
        const folder = current.label === 'backend' ? root : path.join(root, 'src-admin');
        const edges = (inventory.unresolvedEdges || []).map(edge => {
            const pkg = json(folder, `${edge.location}/package.json`).value;
            const optional = edge.peer === true && edge.optional === true && pkg.peerDependenciesMeta?.[edge.dependency]?.optional === true;
            return { ...edge, verifiedInInstalledManifest: optional, classification: optional ? 'Declared optional peer absent from lock resolution' : 'Unresolved reference requires review' };
        });
        scopes.push({ label: current.label, unresolvedReferenceCount: edges.length, optionalPeersVerified: edges.filter(edge => edge.verifiedInInstalledManifest).length, edges });
    }
    return { inventorySummarySha256: hash(source.raw), scopes, limitation: 'Optional references remain unresolved; this is not a closed universal SBOM dependency graph.' };
}
function notices(frontend, backend) {
    const outputRoot = path.join(root, 'docs/third-party/admin8');
    fs.mkdirSync(outputRoot, { recursive: true });
    const selected = [...frontend.packages, ...frontend.vendoredPackages].map(item => ({ ...item, scope: 'frontend', base: path.join(root, 'src-admin') }));
    for (const name of ['@node-oauth/oauth2-server', 'acorn']) {
        const item = backend.components.find(component => component.name === name);
        if (!item) throw new Error(`Required notice package absent: ${name}`);
        selected.push({ ...item, scope: 'backend', base: root });
    }
    const records = [];
    const sourceFile = path.join(outputRoot, 'UPSTREAM-NOTICE-SOURCES.json');
    const upstreamSources = fs.existsSync(sourceFile) ? json(outputRoot, 'UPSTREAM-NOTICE-SOURCES.json').value.records : [];
    const copied = new Map();
    for (const item of selected) {
        const packageDir = path.join(item.base, item.location);
        const identifier = `${item.name.replace(/[^A-Za-z0-9._-]/g, '_')}-${item.version}`;
        const destination = path.join(outputRoot, identifier);
        fs.mkdirSync(destination, { recursive: true });
        const files = [];
        function collect(relative, depth) {
            if (depth > 2) throw new Error('Notice nesting exceeds limit');
            const entries = fs.readdirSync(path.join(packageDir, relative), { withFileTypes: true });
            for (const entry of entries) {
                const candidate = relative ? `${relative}/${entry.name}` : entry.name;
                if (!relative && !/^(?:licen[cs]e|notice|copying|copyright)s?(?:[._ -].*)?$/i.test(entry.name)) continue;
                if (entry.isSymbolicLink()) throw new Error('Symlink in notice source');
                if (entry.isDirectory()) { collect(candidate, depth + 1); continue; }
                if (!entry.isFile()) continue;
                const bytes = read(packageDir, candidate, 2 * 1024 * 1024), digest = hash(bytes);
                const output = path.join(destination, candidate);
                if (copied.has(output) && copied.get(output) !== digest) throw new Error('Conflicting license files for same package identity');
                fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, bytes); copied.set(output, digest);
                files.push({ source: `${item.scope === 'frontend' ? 'src-admin/' : ''}${item.location}/${candidate}`, delivered: `docs/third-party/admin8/${identifier}/${candidate}`, bytes: bytes.length, sha256: digest });
            }
        }
        collect('', 0);
        let status = files.length ? 'UPSTREAM_NOTICE_FILES_COPIED' : 'NO_NOTICE_FILE_IN_INSTALLED_PACKAGE';
        if (!files.length) {
            const fallback = upstreamSources.find(source => source.name === item.name && source.version === item.version);
            if (fallback) {
                if (fallback.tarballIntegrity !== item.tarballIntegrity) throw new Error('Upstream notice package integrity mismatch');
                const bytes = read(outputRoot, fallback.relative, 2 * 1024 * 1024);
                const blob = crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
                if (hash(bytes) !== fallback.sha256 || blob !== fallback.gitBlobSha) throw new Error('Upstream notice content mismatch');
                files.push({ source: fallback.url, delivered: `docs/third-party/admin8/${fallback.relative}`, bytes: bytes.length, sha256: hash(bytes), gitBlobSha: blob, registryGitHead: fallback.registryGitHead });
                status = fallback.kind;
            }
        }
        records.push({ name: item.name, version: item.version, scope: item.scope, location: item.location, assertedLicense: item.license,
            resolved: item.resolved, tarballIntegrity: item.tarballIntegrity, packageManifestSha256: item.packageManifestSha256,
            status, files });
    }
    const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), scope: 'Unmodified LICENSE/NOTICE/COPYING/COPYRIGHT files from actual bundled frontend packages plus maintained OAuth fork and Acorn; missing tarball texts may be supplied from verified exact-release repository sources. Package license fields and README declarations are not substitutes for missing full license text.',
        limitations: 'No legal compliance certification. Missing upstream notice files remain explicitly listed for review. Unknown third-party fragments and runtime federation providers are outside this collection.', records };
    fs.writeFileSync(path.join(outputRoot, 'NOTICE-PROVENANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
    return { report: 'docs/third-party/admin8/NOTICE-PROVENANCE.json', packages: records.length, files: records.reduce((total, item) => total + item.files.length, 0), missing: records.filter(item => !item.files.length || item.status === 'UPSTREAM_LICENSE_DECLARATION_ONLY').map(item => ({ name: item.name, version: item.version, scope: item.scope })) };
}
function main() {
    if (process.argv.length !== 2) throw new Error('Usage: node tools/nexowatt-artifact-inventory.cjs');
    const installed = [tree('backend', root), tree('frontend', path.join(root, 'src-admin'))];
    const vendorIssue = webserverVendor.inspectVendoredWebserver(json(root, 'package.json').value, json(root, 'package-lock.json').value, root);
    if (vendorIssue) throw new Error(vendorIssue);
    const vendorProof = json(root, webserverVendor.PROVENANCE);
    const vendoredBackend = { ...vendorProof.value, provenanceSha256: hash(vendorProof.raw),
        verification: 'All 39 source and emitted runtime files matched the pinned upstream-byte inventory',
        limitation: 'Source delivery uses EOS root dependency resolution, not the retained upstream package manifest.' };
    const frontend = composition(installed[1], installed[0]), references = peers(installed), licenseNotices = notices(frontend, installed[0]);
    const failures = installed.reduce((total, item) => total + item.failures.length, 0) + frontend.unclassifiedModules.length + references.scopes.reduce((total, scope) => total + scope.unresolvedReferenceCount - scope.optionalPeersVerified, 0);
    const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), toolSha256: hash(fs.readFileSync(__filename)),
        environment: { node: process.version, platform: process.platform, arch: process.arch }, status: failures ? 'REVIEW_REQUIRED' : 'RESOLVED_WITH_DECLARED_LIMITATIONS',
        limitations: 'Snapshot of local installed packages, source-vendored backend and built frontend; no CVE assessment, IEC/CRA certification, native-module execution or deployed-device attestation.', installed, vendoredBackend, frontend, references, licenseNotices };
    fs.mkdirSync(path.join(root, 'reports/security'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reports/security/artifact-inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ status: report.status, installed: installed.map(item => ({ label: item.label, count: item.components.length, absentOptional: item.absentOptional.length, failures: item.failures.length })), frontend: { chunks: frontend.chunks.length, packages: frontend.packages.length, vendoredPackages: frontend.vendoredPackages.length, modules: frontend.uniqueDeclaredModules, unclassified: frontend.unclassifiedModules.length }, optionalPeers: references.scopes.map(scope => ({ label: scope.label, unresolved: scope.unresolvedReferenceCount, verifiedOptional: scope.optionalPeersVerified })), licenseNotices }));
    if (failures) process.exitCode = 1;
}
try { main(); } catch (error) { console.error(`Artifact inventory failed: ${error.message}`); process.exitCode = 1; }
