'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const filename = path.join(__dirname, '..', process.env.EOS_TEST_RUNTIME === 'build' ? 'build/lib' : 'src/lib', 'eosFileTransferSecurity.js');
function load(overrides = {}) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, Buffer, setTimeout, clearTimeout, ...overrides }, { filename });
    return module.exports;
}
function pair() {
    const req = Object.assign(new EventEmitter(), { aborted: false });
    const res = Object.assign(new EventEmitter(), {
        statusCode: 200, headers: {}, writableEnded: false,
        setHeader(k,v) { this.headers[k] = v; },
        status(v) { this.statusCode = v; return this; },
        json(v) { this.body = v; this.writableEnded = true; return this; },
        send(v) { this.body = v; this.headersSent = true; this.writableEnded = true; this.writableFinished = true; this.emit('finish'); return this; },
        destroy() { this.destroyed = true; this.emit('close'); },
    });
    return { req, res };
}
function setup(overrides = {}) {
    const calls = [];
    const adapter = {
        async readDirAsync(...args) { calls.push(['dir', ...args]); return [{ file:'file.txt', isDir:false, stats:{size:4} }]; },
        async readFileAsync(...args) { calls.push(['file', ...args]); return { file:Buffer.from('safe'), mimeType:'text/html' }; },
        ...overrides,
    };
    return { adapter, calls, ...pair(), namespace:'vis.0', filePath:'file.txt', user:'system.user.guest' };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('URL parser accepts ordinary files and strips real queries before decoding', () => {
    const { parseDbFileRequest } = load();
    assert.deepEqual(JSON.parse(JSON.stringify(parseDbFileRequest('/vis.0/folder/hello%20world.txt?0&x=1'))), {namespace:'vis.0',filePath:'folder/hello world.txt'});
    assert.equal(parseDbFileRequest('/vis.0/').filePath, 'index.html');
});
test('URL parser rejects encoded routing delimiters, double encoding, traversal, malformed URLs and excessive depth', () => {
    const { parseDbFileRequest } = load();
    for (const input of ['/vis.0/private.json%3F.ico', '/vis.0/a%3fmanifest.json', '/vis.0/a%2fb', '/vis.0/a%5cb', '/vis.0/%252e%252e/x', '/vis.0/a%23b', '/vis.0/%00', '/vis.0/%zz', '/vis.0/../file', '/vis.0/a//b', '/vis.0/a\\b', '/vis.0/x:y', '//foo', '/vis.0/'+ 'a/'.repeat(18)+'b', 'https://invalid/x']) assert.throws(() => parseDbFileRequest(input), /FILE_PATH_INVALID/, input);
});
test('single file read propagates authenticated caller ACL to both operations and ignores attacker MIME', async () => {
    const fixture = setup();
    await load().serveDbFile(fixture);
    assert.equal(fixture.res.statusCode,200);assert.equal(fixture.res.body.toString(),'safe');
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls)), [['dir','vis.0','',{user:'system.user.guest'}],['file','vis.0','file.txt',{user:'system.user.guest'}]]);
    assert.equal(fixture.res.headers['Content-Type'],'text/plain; charset=utf-8');
    assert.equal(fixture.res.headers['X-Content-Type-Options'],'nosniff');
    assert.match(fixture.res.headers['Content-Security-Policy'],/^sandbox;/);
});
test('missing or malformed identity and invalid direct-call path perform no database IO', async () => {
    for (const user of [undefined,null,'guest',[],['system.user.admin']]) {
        const fixture=setup();fixture.user=user;
        await load().serveDbFile(fixture);assert.equal(fixture.res.statusCode,403);assert.equal(fixture.calls.length,0);
    }
    const fixture=setup();fixture.filePath='../private.txt';
    await load().serveDbFile(fixture);assert.equal(fixture.res.statusCode,400);assert.equal(fixture.calls.length,0);
});
test('explicit authenticated user names containing @ retain their identity for ACL checks', async () => {
    const fixture=setup();fixture.user='system.user.operator@example';
    await load().serveDbFile(fixture);assert.equal(fixture.res.statusCode,200);
    assert.equal(fixture.calls[1][3].user,'system.user.operator@example');
});
test('directory exports are denied without recursive reads or archive allocation', async () => {
    let fileReads=0;
    const fixture=setup({async readDirAsync(){return [{file:'file.txt',isDir:true,stats:{size:0}}];},async readFileAsync(){fileReads++;}});
    await load().serveDbFile(fixture);
    assert.equal(fixture.res.statusCode,403);assert.equal(fixture.res.body.error,'DIRECTORY_EXPORT_DISABLED');assert.equal(fileReads,0);
});
test('missing metadata, oversized declared files and excessive parent entries fail before reading file bytes', async () => {
    const cases = [ [[],404], [[{file:'file.txt',isDir:false}],503], [[{file:'file.txt',isDir:false,stats:{size:16*1024*1024+1}}],413], [Array.from({length:1001},()=>({file:'file.txt',stats:{size:1}})),413] ];
    for(const [entries,status] of cases){
        let reads=0;const fixture=setup({async readDirAsync(){return entries;},async readFileAsync(){reads++;}});
        await load().serveDbFile(fixture);assert.equal(fixture.res.statusCode,status);assert.equal(reads,0);
    }
});
test('actual oversized response is rejected even if metadata was small', async () => {
    const fixture=setup({async readFileAsync(){return {file:Buffer.alloc(16*1024*1024+1)};}});
    await load().serveDbFile(fixture);assert.equal(fixture.res.statusCode,413);assert.equal(fixture.res.body.error,'FILE_SIZE_LIMIT');
});
test('active file types are attachments with isolated restrictive response headers', async () => {
    for(const ext of ['html','svg','js','xml','pdf']){
        const fixture=setup({async readDirAsync(){return [{file:'file.'+ext,isDir:false,stats:{size:4}}];}});fixture.filePath='file.'+ext;
        await load().serveDbFile(fixture);assert.equal(fixture.res.statusCode,200);
        assert.equal(fixture.res.headers['Content-Type'],'application/octet-stream');assert.match(fixture.res.headers['Content-Disposition'],/^attachment;/);
    }
});
test('database errors fail closed and do not expose internal details', async () => {
    const fixture=setup({async readDirAsync(){throw new Error('internal-path secret-token');}});
    await load().serveDbFile(fixture);assert.equal(fixture.res.statusCode,403);assert.equal(JSON.stringify(fixture.res.body),'{"error":"FILE_READ_UNAVAILABLE"}');
});
test('concurrent stalled requests reserve both slots even after the five-second deadline', async () => {
    const timers=[];
    const api=load({setTimeout(fn,ms){assert.equal(ms,5000);timers.push(fn);return timers.length;},clearTimeout(){}});
    const resolvers=[];
    const make=()=>setup({readDirAsync(){return new Promise(resolve=>resolvers.push(resolve));}});
    const one=make(),two=make();const first=api.serveDbFile(one),second=api.serveDbFile(two);
    const three=setup();await api.serveDbFile(three);assert.equal(three.res.statusCode,503);assert.equal(three.calls.length,0);
    timers.forEach(fn=>fn());await Promise.all([first,second]);
    assert.equal(one.res.statusCode,504);assert.equal(two.res.statusCode,504);
    const four=setup();await api.serveDbFile(four);assert.equal(four.res.statusCode,503);
    resolvers.forEach(resolve=>resolve([]));await flush();
    const five=setup();await api.serveDbFile(five);assert.equal(five.res.statusCode,200);
});
test('aborted client cannot trigger a late file read and reservation is released after DB settles', async () => {
    const api=load();let resolveDir;let reads=0;
    const fixture=setup({readDirAsync(){return new Promise(resolve=>{resolveDir=resolve;});},async readFileAsync(){reads++;}});
    const pending=api.serveDbFile(fixture);fixture.req.aborted=true;fixture.req.emit('aborted');await pending;
    resolveDir([{file:'file.txt',isDir:false,stats:{size:4}}]);await flush();
    assert.equal(reads,0);assert.equal(fixture.res.body,undefined);
    const next=setup();await api.serveDbFile(next);assert.equal(next.res.statusCode,200);
});
test('slow output keeps both reservations until deadline destroys unfinished responses', async () => {
    const timers=[];
    const api=load({setTimeout(fn,ms){assert.equal(ms,5000);timers.push(fn);return timers.length;},clearTimeout(){}});
    const slow=()=>{const fixture=setup();fixture.res.send=function(v){this.body=v;this.headersSent=true;this.writableEnded=true;return this;};return fixture;};
    const one=slow(),two=slow();const first=api.serveDbFile(one),second=api.serveDbFile(two);await flush();
    const three=setup();await api.serveDbFile(three);assert.equal(three.res.statusCode,503);assert.equal(three.calls.length,0);
    timers.slice().forEach(fn=>fn());await Promise.all([first,second]);await flush();
    assert.equal(one.res.destroyed,true);assert.equal(two.res.destroyed,true);
    const four=setup();await api.serveDbFile(four);assert.equal(four.res.statusCode,200);
});
