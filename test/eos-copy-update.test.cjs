'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { prepareCopyUpdate, assertNodeVersion, ROOTS, FILES, CATALOG, BACKUP } = require('../tools/nexowatt-prepare-copy-update.cjs');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function fixture(t, retired = { 'src/old.ts': 'old source', 'admin/custom/old.js': 'old custom', 'adminWww/assets/old.css': 'old CSS' }) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-copy-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    function put(relative, bytes) { fs.mkdirSync(path.dirname(path.join(root,relative)), { recursive: true }); fs.writeFileSync(path.join(root,relative),bytes); }
    for (const dir of ROOTS) fs.mkdirSync(path.join(root,dir), { recursive: true });
    put('package.json', JSON.stringify({ name: 'iobroker.eos-admin', version: '8.0.0' }));
    const current = {};
    for (const file of [...FILES,'src/current.ts','admin/current.json']) { put(file,'current:'+file); current[file]=sha('current:'+file); }
    const catalog = { format:1, package:'iobroker.eos-admin', targetVersion:'8.0.0', sources:[{version:'7.10.12'}], files:Object.fromEntries(Object.entries(retired).map(([file,data])=>[file,[sha(data)]])) };
    function sealCatalog() { const data=JSON.stringify(catalog); put(CATALOG,data);current[CATALOG]=sha(data);seal(); }
    function seal() { put('NEXOWATT_EOS_PREBUILT_MANIFEST.json',JSON.stringify({format:1,package:'iobroker.eos-admin',version:'8.0.0',algorithm:'sha256',fileCount:Object.keys(current).length,trackedRoots:ROOTS,trackedFiles:FILES,files:current})); }
    sealCatalog();
    for (const [file,data] of Object.entries(retired)) put(file,data);
    put('.git/config','git configuration');put('node_modules/keep.txt','installed dependencies');put('local-private.txt','local data');
    return {root,put,retired,current,catalog,seal,sealCatalog};
}
function files(root, prefix='') {
    const result={};
    for (const entry of fs.readdirSync(path.join(root,prefix),{withFileTypes:true})) {
        const rel=prefix ? `${prefix}/${entry.name}` : entry.name;
        if(entry.isDirectory())Object.assign(result,files(root,rel));
        else if(entry.isFile())result[rel]=sha(fs.readFileSync(path.join(root,rel)));
        else result[rel]='special';
    }
    return result;
}

test('accepts supported security patch lines and rejects unsupported versions',()=>{
    for(const v of ['22.23.4','v22.23.5','22.24.0','24.22.1','24.22.2','24.23.0'])assert.doesNotThrow(()=>assertNodeVersion(v));
    for(const v of ['22.23.3','22.22.99','23.99.0','24.21.0','24.22.0','25.0.0','24.22.1-rc.1','invalid'])assert.throws(()=>assertNodeVersion(v),/Node.js.*nicht unterstützt/);
});
test('flat ZIP overlay retires only exact old files, preserving Git, modules and local data',t=>{
    const f=fixture(t);const before=files(f.root);
    const check=prepareCopyUpdate({root:f.root,check:true});
    assert.equal(check.retiredFiles,3);assert.deepEqual(files(f.root),before,'--check must be read-only');
    const result=prepareCopyUpdate({root:f.root});assert.equal(result.retiredFiles,3);assert.equal(result.applied,true);
    const journal=JSON.parse(fs.readFileSync(path.join(result.backupDirectory,'journal.json')));
    assert.equal(journal.status,'COMPLETE');assert.equal(journal.files.length,3);
    for(const record of journal.files){
        assert.equal(fs.existsSync(path.join(f.root,record.path)),false);
        assert.equal(sha(fs.readFileSync(path.join(result.backupDirectory,record.snapshot))),record.sha256);
        assert.equal(sha(fs.readFileSync(path.join(result.backupDirectory,record.retired))),record.sha256);
        assert.match(record.snapshot,/^\d{6}\.bin$/);
    }
    for(const rel of Object.keys(before).filter(p=>!Object.hasOwn(f.retired,p)))assert.equal(sha(fs.readFileSync(path.join(f.root,rel))),before[rel],rel);
    const after=files(f.root);assert.equal(prepareCopyUpdate({root:f.root}).retiredFiles,0);assert.deepEqual(files(f.root),after,'second run must not write');
});
for(const kind of ['unknown extra','modified old','modified current','missing current','tampered catalog'])test(`${kind} stops without any writes`,t=>{
    const f=fixture(t);
    if(kind==='unknown extra')f.put('tools/own-change.cjs','own work');
    if(kind==='modified old')f.put('src/old.ts','edited local work');
    if(kind==='modified current')f.put('src/current.ts','edited current');
    if(kind==='missing current')fs.unlinkSync(path.join(f.root,'src/current.ts'));
    if(kind==='tampered catalog')f.put(CATALOG,'{}');
    const before=files(f.root);assert.throws(()=>prepareCopyUpdate({root:f.root}));assert.deepEqual(files(f.root),before);assert.equal(fs.existsSync(path.join(f.root,BACKUP)),false);
});
for(const rel of ['../outside','src/../../outside','src/CON.txt','src/trailing.','src/with:ads','src\\escape.ts','/absolute'])test(`rejects malicious catalog path ${rel}`,t=>{
    const f=fixture(t);f.catalog.files[rel]=[sha('malicious')];f.sealCatalog();const before=files(f.root);
    assert.throws(()=>prepareCopyUpdate({root:f.root}));assert.deepEqual(files(f.root),before);
});
test('manifest cannot redefine roots or retire current files',t=>{
    const f=fixture(t);const manifest=JSON.parse(fs.readFileSync(path.join(f.root,'NEXOWATT_EOS_PREBUILT_MANIFEST.json')));
    manifest.trackedRoots.push('.git');f.put('NEXOWATT_EOS_PREBUILT_MANIFEST.json',JSON.stringify(manifest));
    const before=files(f.root);assert.throws(()=>prepareCopyUpdate({root:f.root}),/Struktur/);assert.deepEqual(files(f.root),before);
});
test('current and retired case aliases are refused',t=>{
    const f=fixture(t);f.catalog.files['src/CURRENT.ts']=[sha('old case')];f.sealCatalog();const before=files(f.root);
    assert.throws(()=>prepareCopyUpdate({root:f.root}),/kollidierende/);assert.deepEqual(files(f.root),before);
});
for(const kind of ['current file','source directory','backup directory','root'])test(`refuses ${kind} symlink/junction`,t=>{
    const f=fixture(t);const external=fs.mkdtempSync(path.join(os.tmpdir(),'eos-copy-external-'));t.after(()=>fs.rmSync(external,{recursive:true,force:true}));
    fs.writeFileSync(path.join(external,'outside'),'unchanged outside');let root=f.root;
    try {
        if(kind==='current file'){fs.unlinkSync(path.join(f.root,'src/current.ts'));fs.symlinkSync(path.join(external,'outside'),path.join(f.root,'src/current.ts'));}
        if(kind==='source directory'){fs.rmSync(path.join(f.root,'src'),{recursive:true});fs.symlinkSync(external,path.join(f.root,'src'),'junction');}
        if(kind==='backup directory')fs.symlinkSync(external,path.join(f.root,BACKUP),'junction');
        if(kind==='root'){root=path.join(external,'linked');fs.symlinkSync(f.root,root,'junction');}
    } catch(error){if(error.code==='EPERM'&&process.platform==='win32'){t.skip('Creating file symlinks needs OS permission');return;}throw error;}
    const before=files(f.root);assert.throws(()=>prepareCopyUpdate({root}),/Verknüpfung|Junction/);assert.deepEqual(files(f.root),before);assert.equal(fs.readFileSync(path.join(external,'outside'),'utf8'),'unchanged outside');
});
test('existing lock stops and leaves its owner and all sources unchanged',t=>{
    const f=fixture(t);f.put(`${BACKUP}/.lock/owner.json`,'existing owner');const before=files(f.root);
    assert.throws(()=>prepareCopyUpdate({root:f.root}),/gesperrt/);assert.deepEqual(files(f.root),before);
});
test('backup write failure never removes a source',t=>{
    const f=fixture(t);const before=files(f.root);const original=fs.openSync;
    fs.openSync=function(file,...args){if(String(file).endsWith('000002.bin'))throw Object.assign(new Error('simulated full disk'),{code:'ENOSPC'});return original.call(this,file,...args);};
    try{assert.throws(()=>prepareCopyUpdate({root:f.root}),/simulated full disk/);}finally{fs.openSync=original;}
    for(const [rel,hash] of Object.entries(before))assert.equal(sha(fs.readFileSync(path.join(f.root,rel))),hash,rel);
});
test('mid-retirement failure restores removed paths and retains verified backups',t=>{
    const f=fixture(t);const before=files(f.root);const original=fs.renameSync;
    fs.renameSync=function(from,to){if(String(to).endsWith('000002.retired'))throw new Error('simulated rename failure');return original.call(this,from,to);};
    try{assert.throws(()=>prepareCopyUpdate({root:f.root}),/simulated rename failure/);}finally{fs.renameSync=original;}
    for(const [rel,hash] of Object.entries(before))assert.equal(sha(fs.readFileSync(path.join(f.root,rel))),hash,rel);
    const sessions=fs.readdirSync(path.join(f.root,BACKUP));assert.equal(sessions.length,1);
    const journal=JSON.parse(fs.readFileSync(path.join(f.root,BACKUP,sessions[0],'journal.json')));assert.equal(journal.status,'ROLLED_BACK');
    for(const item of journal.files)assert.equal(sha(fs.readFileSync(path.join(f.root,BACKUP,sessions[0],item.snapshot))),item.sha256);
});
test('corrupt backup is detected before the first source is moved',t=>{
    const f=fixture(t);const before=files(f.root);const original=fs.fsyncSync;let corrupted=false;
    fs.fsyncSync=function(fd){const result=original.call(this,fd);if(!corrupted){const sessions=fs.existsSync(path.join(f.root,BACKUP))?fs.readdirSync(path.join(f.root,BACKUP)).filter(n=>n.startsWith('r-')):[];if(sessions.length){const snapshot=path.join(f.root,BACKUP,sessions[0],'000001.bin');if(fs.existsSync(snapshot)){fs.writeFileSync(snapshot,'corrupt backup');corrupted=true;}}}return result;};
    try{assert.throws(()=>prepareCopyUpdate({root:f.root}),/Sicherung stimmt nicht/);}finally{fs.fsyncSync=original;}
    assert.equal(corrupted,true);for(const [rel,hash] of Object.entries(before))assert.equal(sha(fs.readFileSync(path.join(f.root,rel))),hash,rel);
});
test('concurrent source replacement is preserved and never blindly unlinked',t=>{
    const f=fixture(t);const original=fs.renameSync;let replaced;
    fs.renameSync=function(from,to){if(String(to).endsWith('000001.retired')){replaced=from;fs.writeFileSync(from,'new user edits during rename');}return original.call(this,from,to);};
    try{assert.throws(()=>prepareCopyUpdate({root:f.root}),/während der Auslagerung ersetzt/);}finally{fs.renameSync=original;}
    assert.equal(fs.readFileSync(replaced,'utf8'),'new user edits during rename');
});
test('rollback refuses to overwrite a newly created source pathname',t=>{
    const f=fixture(t);const original=fs.renameSync;let first;
    fs.renameSync=function(from,to){if(String(to).endsWith('000001.retired'))first=from;if(String(to).endsWith('000002.retired')){fs.writeFileSync(first,'new replacement');throw new Error('second move interrupted');}return original.call(this,from,to);};
    try{assert.throws(()=>prepareCopyUpdate({root:f.root}),/nicht automatisch zurückgelegt/);}finally{fs.renameSync=original;}
    assert.equal(fs.readFileSync(first,'utf8'),'new replacement');
    const session=fs.readdirSync(path.join(f.root,BACKUP))[0];const j=JSON.parse(fs.readFileSync(path.join(f.root,BACKUP,session,'journal.json')));assert.equal(j.status,'RECOVERY_REQUIRED');
    assert.equal(sha(fs.readFileSync(path.join(f.root,BACKUP,session,j.files[0].retired))),j.files[0].sha256);
});
