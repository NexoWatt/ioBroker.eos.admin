#!/usr/bin/env node
'use strict';

// Offline, dependency-free preparation of a reviewed ZIP copied over an older
// checkout. This never repairs current hashes or creates a new release seal.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PACKAGE = 'iobroker.eos-admin';
const MANIFEST = 'NEXOWATT_EOS_PREBUILT_MANIFEST.json';
const CATALOG = 'tools/vendor/eos-retired-release-files.json';
const BACKUP = '.eos-backup';
const ROOTS = Object.freeze(['src', 'build', 'src-admin/src', 'src-admin/public', 'src-admin/build-tools', 'adminWww', 'admin', 'public', 'tools', 'packages/eos-license-client', 'test']);
const FILES = Object.freeze(['tasks.mts', 'tsconfig.json', 'tsconfig.build.json', 'src-admin/vite.config.ts', 'src-admin/tsconfig.json', 'src-admin/index.html', 'release-manifests/admin8-development-validation.json']);
const MAX_FILES = 20000;
const MAX_JSON = 8 * 1024 * 1024;
const MAX_FILE = 128 * 1024 * 1024;
const MAX_TOTAL = 1024 * 1024 * 1024;
const DIGEST = /^[a-f0-9]{64}$/;

function fail(message) { throw new Error(message); }
function assertNodeVersion(value = process.versions.node) {
    const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
    const supported = match && ((Number(match[1]) === 22 && (Number(match[2]) > 23 || (Number(match[2]) === 23 && Number(match[3]) >= 4))) || (Number(match[1]) === 24 && (Number(match[2]) > 22 || (Number(match[2]) === 22 && Number(match[3]) >= 1))));
    if (!supported) {
        fail(`Node.js ${value} wird nicht unterstützt. Benötigt: >=22.23.4 und <23 oder >=24.22.1 und <25. Aktives Programm: ${process.execPath}. Node.js innerhalb der unterstützten Hauptversion aktualisieren, VS Code neu öffnen und node --version prüfen. Es wurde nichts bereinigt.`);
    }
}
function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validPath(relative) {
    if (typeof relative !== 'string' || relative.length > 1024 || !relative || relative.includes('\\') || path.posix.isAbsolute(relative)) fail(`Ungültiger Dateipfad: ${String(relative).slice(0,120)}`);
    for (const part of relative.split('/')) {
        if (!part || part === '.' || part === '..' || part.length > 255 || /[<>:"|?*\x00-\x1f\x7f]/.test(part) || /[ .]$/.test(part) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)) fail(`Unsicherer Dateipfad: ${relative}`);
    }
    return relative;
}
function inScope(relative) { return FILES.includes(relative) || ROOTS.some(base => relative.startsWith(`${base}/`)); }
function noLinks(root, relative, allowMissing = false) {
    let current = root;
    const parts = relative ? validPath(relative).split('/') : [];
    const locations = [root];
    for (const part of parts) { current = path.join(current, part); locations.push(current); }
    for (let i = 0; i < locations.length; i++) {
        let stat;
        try { stat = fs.lstatSync(locations[i]); }
        catch (error) { if (allowMissing && error.code === 'ENOENT') return null; throw error; }
        if (stat.isSymbolicLink()) fail(`Verknüpfung/Junction ist hier nicht zulässig: ${locations[i]}`);
        if (i < locations.length - 1 && !stat.isDirectory()) fail(`Elternpfad ist kein Ordner: ${locations[i]}`);
        if (i === locations.length - 1) return stat;
    }
    return null;
}
function sameIdentity(a, b) { return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.isFile() && b.isFile(); }
function readSnapshot(root, relative, expectedIdentity) {
    const absolute = path.join(root, validPath(relative));
    const before = noLinks(root, relative);
    if (!before || !before.isFile() || before.size > MAX_FILE) fail(`Keine zulässige normale Datei: ${relative}`);
    if (expectedIdentity && !sameIdentity(before, expectedIdentity)) fail(`Datei wurde während der Prüfung ersetzt: ${relative}`);
    const fd = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const opened = fs.fstatSync(fd);
        if (!sameIdentity(before, opened)) fail(`Datei wurde während des Öffnens ersetzt: ${relative}`);
        const hash = crypto.createHash('sha256');
        const buffer = Buffer.allocUnsafe(65536);
        let count = 0;
        for (;;) {
            const n = fs.readSync(fd, buffer, 0, buffer.length, null);
            if (!n) break;
            count += n;
            if (count > MAX_FILE) fail(`Datei ist zu groß: ${relative}`);
            hash.update(buffer.subarray(0, n));
        }
        if (!sameIdentity(opened, fs.fstatSync(fd)) || !sameIdentity(opened, noLinks(root, relative))) fail(`Datei wurde während des Lesens verändert: ${relative}`);
        return { sha256: hash.digest('hex'), bytes: count, identity: opened };
    } finally { fs.closeSync(fd); }
}
function readJson(root, relative) {
    const stat = noLinks(root, relative);
    if (!stat || !stat.isFile() || stat.size > MAX_JSON) fail(`Ungültige oder zu große JSON-Datei: ${relative}`);
    const fd = fs.openSync(path.join(root, relative), fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const opened = fs.fstatSync(fd);
        if (!sameIdentity(stat, opened)) fail(`JSON-Datei wurde während des Öffnens ersetzt: ${relative}`);
        const bytes = Buffer.alloc(opened.size);
        let count = 0;
        while (count < bytes.length) {
            const n = fs.readSync(fd, bytes, count, bytes.length-count, null);
            if (!n) break;
            count += n;
        }
        if (count !== bytes.length || !sameIdentity(opened, fs.fstatSync(fd)) || !sameIdentity(opened, noLinks(root, relative))) fail(`JSON-Datei wurde während des Lesens verändert: ${relative}`);
        return JSON.parse(bytes.toString('utf8'));
    } finally { fs.closeSync(fd); }
}
function checkUnique(paths) {
    const seen = new Set();
    for (const relative of paths) {
        validPath(relative);
        const key = relative.toLowerCase();
        if (seen.has(key)) fail(`Unter Windows kollidierende Pfade: ${relative}`);
        seen.add(key);
    }
}
function walkScoped(root) {
    const result = [];
    let entries = 0;
    function walk(relative) {
        const stat = noLinks(root, relative, true);
        if (!stat) return;
        if (++entries > MAX_FILES * 2) fail('Zu viele Dateien oder Ordner im Releasebereich.');
        if (stat.isFile()) { result.push(relative); return; }
        if (!stat.isDirectory()) fail(`Spezialdatei im Releasebereich: ${relative}`);
        const names = fs.readdirSync(path.join(root, relative)).sort();
        checkUnique(names);
        for (const name of names) walk(`${relative}/${name}`);
    }
    for (const base of ROOTS) walk(base);
    for (const file of FILES) if (noLinks(root, file, true)) result.push(file);
    if (result.length > MAX_FILES) fail('Zu viele Dateien im Releasebereich.');
    checkUnique(result);
    return result.sort();
}
function makePlan(root) {
    const rootStat = noLinks(root, '');
    if (!rootStat || !rootStat.isDirectory()) fail('Der Projektpfad ist kein normaler Ordner.');
    const backupStat = noLinks(root, BACKUP, true);
    if (backupStat && !backupStat.isDirectory()) fail('Der Sicherungspfad ist kein normaler Ordner.');
    const pkg = readJson(root, 'package.json');
    const originalManifestHash = readSnapshot(root, MANIFEST).sha256;
    const manifest = readJson(root, MANIFEST);
    if (pkg.name !== PACKAGE || typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) fail('Unerwartetes Paket oder ungültige Version.');
    if (!plainObject(manifest) || manifest.format !== 1 || manifest.package !== PACKAGE || manifest.version !== pkg.version || manifest.algorithm !== 'sha256' || JSON.stringify(manifest.trackedRoots) !== JSON.stringify(ROOTS) || JSON.stringify(manifest.trackedFiles) !== JSON.stringify(FILES) || !plainObject(manifest.files)) fail('Die aktuelle Release-Versiegelung hat eine unerwartete Struktur.');
    const current = Object.keys(manifest.files);
    if (!current.length || current.length > MAX_FILES || current.length !== manifest.fileCount || !current.includes(CATALOG) || FILES.some(file => !current.includes(file))) fail('Die aktuelle Release-Versiegelung ist unvollständig.');
    checkUnique(current);
    let total = 0;
    for (const relative of current.sort()) {
        if (!inScope(relative) || !DIGEST.test(manifest.files[relative])) fail(`Ungültiger Eintrag der aktuellen Versiegelung: ${relative}`);
        let snap;
        try { snap = readSnapshot(root, relative); }
        catch (error) { fail(`Aktuelle Release-Datei fehlt oder ist nicht lesbar: ${relative}. ZIP vollständig kopieren. ${error.message}`); }
        total += snap.bytes;
        if (total > MAX_TOTAL) fail('Der Releasebereich überschreitet die zulässige Gesamtgröße.');
        if (snap.sha256 !== manifest.files[relative]) fail(`Aktuelle Release-Datei verändert: ${relative}. ZIP vollständig kopieren; eigene Änderungen benötigen einen neuen geprüften Build. Es wurde nichts bereinigt.`);
    }
    // The catalog is read only after its exact bytes passed the current seal.
    const catalog = readJson(root, CATALOG);
    if (!plainObject(catalog) || catalog.format !== 1 || catalog.package !== PACKAGE || catalog.targetVersion !== pkg.version || !Array.isArray(catalog.sources) || !catalog.sources.length || !plainObject(catalog.files)) fail('Ungültiger Altdatei-Katalog.');
    const retired = Object.keys(catalog.files);
    if (retired.length > MAX_FILES) fail('Altdatei-Katalog ist zu groß.');
    checkUnique(retired);
    checkUnique([...current, ...retired]);
    const currentSet = new Set(current);
    for (const relative of retired) {
        const hashes = catalog.files[relative];
        if (!inScope(relative) || currentSet.has(relative) || !Array.isArray(hashes) || !hashes.length || hashes.length > 32 || hashes.some(hash => typeof hash !== 'string' || !DIGEST.test(hash))) fail(`Ungültiger Altdatei-Eintrag: ${relative}`);
    }
    const candidates = [];
    const blocked = [];
    for (const relative of walkScoped(root)) {
        if (currentSet.has(relative)) continue;
        const snap = readSnapshot(root, relative);
        total += snap.bytes;
        if (total > MAX_TOTAL) fail('Der Releasebereich überschreitet die zulässige Gesamtgröße.');
        if (!Object.hasOwn(catalog.files, relative) || !catalog.files[relative].includes(snap.sha256)) blocked.push(relative);
        else candidates.push({ relative, ...snap });
    }
    if (blocked.length) fail(`Unbekannte oder lokal veränderte Zusatzdateien im Releasebereich (${blocked.length}):\n${blocked.slice(0,20).join('\n')}\nDiese Dateien bleiben erhalten. Eigene Änderungen sichern/prüfen; kein automatisches Löschen oder Neuversiegeln.`);
    if (readSnapshot(root, MANIFEST).sha256 !== originalManifestHash) fail('Release-Versiegelung wurde während der Prüfung verändert.');
    return { version: pkg.version, manifestSha256: originalManifestHash, candidates, currentCount: current.length };
}
function writeExclusive(file, content) {
    const fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function copyVerified(root, item, destination) {
    const snap = readSnapshot(root, item.relative, item.identity);
    if (snap.sha256 !== item.sha256) fail(`Altdatei vor Sicherung verändert: ${item.relative}`);
    const source = fs.openSync(path.join(root, item.relative), fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    let dest;
    try {
        if (!sameIdentity(item.identity, fs.fstatSync(source))) fail(`Altdatei vor Sicherung ersetzt: ${item.relative}`);
        dest = fs.openSync(destination, 'wx', 0o600);
        const buffer = Buffer.allocUnsafe(65536);
        const hash = crypto.createHash('sha256');
        let count = 0;
        for (;;) {
            const n = fs.readSync(source, buffer, 0, buffer.length, null);
            if (!n) break;
            count += n;
            if (count > MAX_FILE) fail('Altdatei während der Sicherung zu groß geworden.');
            hash.update(buffer.subarray(0,n));
            let written = 0;
            while (written < n) written += fs.writeSync(dest, buffer, written, n-written);
        }
        fs.fsyncSync(dest);
        if (count !== item.bytes || hash.digest('hex') !== item.sha256 || !sameIdentity(item.identity, fs.fstatSync(source)) || !sameIdentity(item.identity, noLinks(root, item.relative))) fail(`Altdatei während der Sicherung verändert: ${item.relative}`);
    } finally { if (dest !== undefined) fs.closeSync(dest); fs.closeSync(source); }
}
function prepareCopyUpdate(options = {}) {
    assertNodeVersion();
    const root = path.resolve(options.root || path.join(__dirname, '..'));
    let plan = makePlan(root);
    if (options.check === true || !plan.candidates.length) return { checked: plan.currentCount, retiredFiles: plan.candidates.length, applied: false, backupDirectory: null };
    const backupRoot = path.join(root, BACKUP);
    if (!noLinks(root, BACKUP, true)) fs.mkdirSync(backupRoot, { mode: 0o700 });
    noLinks(root, BACKUP);
    const lock = path.join(backupRoot, '.lock');
    try { fs.mkdirSync(lock, { mode: 0o700 }); }
    catch (error) { fail(`Kopier-Update ist gesperrt (${lock}). Ein anderer Lauf arbeitet noch oder ein abgebrochener Lauf muss anhand seines Journals geprüft werden. ${error.code || ''}`); }
    const lockIdentity = fs.lstatSync(lock);
    let session = null;
    let journal = null;
    let moved = [];
    function saveJournal() {
        const target = path.join(session, 'journal.json');
        const temporary = path.join(session, `journal-${crypto.randomBytes(8).toString('hex')}.tmp`);
        writeExclusive(temporary, `${JSON.stringify(journal, null, 2)}\n`);
        fs.renameSync(temporary, target);
    }
    try {
        writeExclusive(path.join(lock, 'owner.json'), `${JSON.stringify({ pid: process.pid, started: new Date().toISOString() })}\n`);
        // Recheck under our cooperative lock; no current file is changed by this tool.
        plan = makePlan(root);
        if (!plan.candidates.length) return { checked: plan.currentCount, retiredFiles: 0, applied: false, backupDirectory: null };
        session = fs.mkdtempSync(path.join(backupRoot, 'r-'));
        fs.chmodSync(session, 0o700);
        const records = plan.candidates.map((item, index) => ({ path: item.relative, sha256: item.sha256, bytes: item.bytes, snapshot: `${String(index+1).padStart(6,'0')}.bin`, retired: `${String(index+1).padStart(6,'0')}.retired` }));
        journal = { format: 1, package: PACKAGE, version: plan.version, manifestSha256: plan.manifestSha256, started: new Date().toISOString(), status: 'COPYING', files: records };
        saveJournal();
        for (let i = 0; i < plan.candidates.length; i++) copyVerified(root, plan.candidates[i], path.join(session, records[i].snapshot));
        for (const record of records) {
            const stored = readSnapshot(root, path.relative(root, path.join(session, record.snapshot)).replace(/\\/g,'/'));
            if (stored.sha256 !== record.sha256 || stored.bytes !== record.bytes) fail(`Sicherung stimmt nicht mit der Altdatei überein: ${record.path}`);
        }
        journal.status = 'BACKED_UP'; saveJournal();
        for (let i = 0; i < plan.candidates.length; i++) {
            const item = plan.candidates[i];
            const snap = readSnapshot(root, item.relative, item.identity);
            if (snap.sha256 !== item.sha256) fail(`Altdatei vor Auslagerung verändert: ${item.relative}`);
            noLinks(root, path.relative(root, session).replace(/\\/g,'/'));
            const target = path.join(session, records[i].retired);
            if (fs.existsSync(target)) fail('Sicherungsziel wurde unerwartet belegt.');
            // Keep the exact file moved out of the source tree. Do not blindly
            // unlink a pathname that a concurrent editor may have replaced.
            fs.renameSync(path.join(root, item.relative), target);
            moved.push({ relative: item.relative, target });
            const actual = readSnapshot(root, path.relative(root, target).replace(/\\/g,'/'));
            if (actual.sha256 !== item.sha256) fail(`Altdatei während der Auslagerung ersetzt: ${item.relative}`);
        }
        const finalPlan = makePlan(root);
        if (finalPlan.candidates.length || finalPlan.manifestSha256 !== plan.manifestSha256) fail('Release-Dateibaum wurde während der Auslagerung verändert.');
        journal.status = 'COMPLETE'; journal.completed = new Date().toISOString(); saveJournal();
        return { checked: plan.currentCount, retiredFiles: moved.length, applied: true, backupDirectory: session };
    } catch (error) {
        const recovery = [];
        for (const item of moved.reverse()) {
            try {
                const parent = path.posix.dirname(item.relative);
                noLinks(root, parent);
                if (noLinks(root, item.relative, true)) { recovery.push(item.relative); continue; }
                // The moved file is preserved even if a new source pathname
                // now exists. Never overwrite that newer file during rollback.
                noLinks(root, path.relative(root, item.target).replace(/\\/g,'/'));
                fs.copyFileSync(item.target, path.join(root, item.relative), fs.constants.COPYFILE_EXCL);
            } catch { recovery.push(item.relative); }
        }
        if (journal) {
            journal.status = recovery.length ? 'RECOVERY_REQUIRED' : 'ROLLED_BACK';
            journal.error = error.message; journal.recoveryRequired = recovery;
            try { saveJournal(); } catch { /* Copies and original moved files remain available. */ }
        }
        fail(`${error.message}${session ? `\nSicherung und Wiederherstellungsjournal: ${session}` : ''}${recovery.length ? '\nEinige Dateien konnten nicht automatisch zurückgelegt werden; keine vorhandene Datei wurde überschrieben.' : ''}`);
    } finally {
        try {
            const current = fs.lstatSync(lock);
            if (!current.isSymbolicLink() && current.isDirectory() && current.dev === lockIdentity.dev && current.ino === lockIdentity.ino) {
                const owner = path.join(lock,'owner.json');
                const ownerStat = fs.lstatSync(owner);
                if (ownerStat.isFile() && !ownerStat.isSymbolicLink()) fs.unlinkSync(owner);
                fs.rmdirSync(lock);
            }
        } catch { /* A retained lock safely prevents an automatic retry. */ }
    }
}

if (require.main === module) {
    try {
        const unknown = process.argv.slice(2).filter(arg => arg !== '--check');
        if (unknown.length) fail(`Unbekannte Option: ${unknown.join(' ')}`);
        const result = prepareCopyUpdate({ check: process.argv.includes('--check') });
        console.log(`[NexoWatt EOS Kopier-Update] OK: ${result.checked} aktuelle Dateien unverändert; ${result.retiredFiles} bekannte Altdateien ${result.applied ? 'gesichert und ausgelagert' : 'zur Auslagerung erkannt'}.${result.backupDirectory ? ` Sicherung: ${result.backupDirectory}` : ''}`);
    } catch (error) { console.error(`[NexoWatt EOS Kopier-Update] ${error.message}`); process.exitCode = 1; }
}
module.exports = { prepareCopyUpdate, assertNodeVersion, ROOTS, FILES, CATALOG, BACKUP };
