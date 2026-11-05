'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const api = import('../src-admin/src/components/SystemSettings/eosLicenseApi.ts');
const UUID = '550e8400-e29b-41d4-a716-446655440000';
const valid = edition => ({v:1, valid:true,code:'LICENSE_VALID',uuid:UUID,edition,expiresAt:null,limits:{chargePoints:3,batteries:2},features:['energy']});
const missing = {v:1,valid:false,code:'LICENSE_MISSING',uuid:UUID,edition:null,expiresAt:null,limits:{},features:[]};

test('public status projection preserves Home/Pro and rejects hidden activation-code fields', async () => {
    const {parseLicenseStatus}=await api;
    for (const edition of ['home','pro']) {
        const result=parseLicenseStatus({...valid(edition),token:'synthetic-never-display',privateKey:'synthetic-never-display'});
        assert.equal(result.edition,edition);assert.equal(result.valid,true);
        assert.equal('token' in result,false);assert.equal('privateKey' in result,false);
    }
    assert.deepEqual(parseLicenseStatus(missing),{
        valid:false,code:'LICENSE_MISSING',uuid:UUID,edition:null,expiresAt:null,limits:{},features:[]
    });
});
test('license URL preserves root and prefixed Admin deployment paths', async () => {
    const {licenseEndpoint}=await api;
    assert.equal(licenseEndpoint('status','https://eos.example/index.html#system/tabEosLicenses'),'https://eos.example/nexowatt/license/status');
    assert.equal(licenseEndpoint('activate','https://eos.example/admin/index.html#system/tabEosLicenses'),'https://eos.example/admin/nexowatt/license/activate');
    assert.equal(licenseEndpoint('remove','https://eos.example/admin/'),'https://eos.example/admin/nexowatt/license/remove');
});
test('invalid or inconsistent status never becomes a valid license', async () => {
    const {parseLicenseStatus}=await api;
    for(const value of [null,[],{}, {...valid('home'),valid:'true'}, {...valid('home'),code:'LICENSE_EXPIRED'},
        {...valid('home'),uuid:null}, {...valid('home'),uuid:'-'.repeat(36)}, {...valid('home'),edition:'enterprise'}, {...valid('home'),limits:{chargePoints:'3',batteries:2}},
        {...valid('home'),limits:{chargePoints:NaN,batteries:2}}, {...valid('home'),expiresAt:Infinity},
        {...valid('home'),features:['<script>']}, {...valid('home'),features:Array(65).fill('energy')}]) {
        assert.throws(()=>parseLicenseStatus(value),/LICENSE_RESPONSE/);
    }
});
test('activation and removal use existing same-origin authenticated routes and exact CSRF bodies', async t => {
    const {requestLicense}=await api;const calls=[];
    t.mock.method(globalThis,'fetch',async (url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/remove') ? missing : valid('pro'));});
    const signal=new AbortController().signal;
    await requestLicense('status',signal);await requestLicense('activate',signal,'  synthetic-NWL2-code  ');await requestLicense('remove',signal);
    assert.deepEqual(calls.map(c=>c.url),['nexowatt/license/status','nexowatt/license/activate','nexowatt/license/remove']);
    assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.body,undefined);
    for(const c of calls){assert.equal(c.options.credentials,'same-origin');assert.equal(c.options.cache,'no-store');assert.equal(c.options.redirect,'error');}
    for(const c of calls.slice(1)){assert.equal(c.options.method,'POST');assert.equal(c.options.headers['X-EOS-License'],'1');}
    assert.deepEqual(JSON.parse(calls[1].options.body),{token:'synthetic-NWL2-code'});
    assert.deepEqual(JSON.parse(calls[2].options.body),{});
});
test('bad codes and invalid route names are rejected before any request', async t => {
    const {requestLicense}=await api;let count=0;
    t.mock.method(globalThis,'fetch',async()=>{count++;throw new Error('unexpected');});
    const signal=new AbortController().signal;
    for(const token of [undefined,'','   ','a'.repeat(16385)]) await assert.rejects(requestLicense('activate',signal,token),/LICENSE_FORMAT/);
    await assert.rejects(requestLicense('../context',signal),/LICENSE_REQUEST/);
    const aborted=new AbortController();aborted.abort();await assert.rejects(requestLicense('status',aborted.signal),{name:'AbortError'});
    assert.equal(count,0);
});
test('denied or unavailable API produces a safe error and never a false no-license status', async t => {
    const {requestLicense}=await api;
    for(const code of ['LICENSE_ADMIN_REQUIRED','LICENSE_HTTPS_REQUIRED','LICENSE_RATE_LIMIT']) {
        const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({error:code},{status:403}));
        await assert.rejects(requestLicense('status',new AbortController().signal),new RegExp(code));mock.mock.restore();
    }
    t.mock.method(globalThis,'fetch',async()=>Response.json({error:'private token echoed by misconfigured proxy'},{status:500}));
    await assert.rejects(requestLicense('status',new AbortController().signal),/SERVICE_UNAVAILABLE/);
});
test('oversized and malformed response bodies are rejected and stream cancelled', async t => {
    const {requestLicense}=await api;let cancelled=false;
    const mock=t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(65537));},cancel(){cancelled=true;}})));
    await assert.rejects(requestLicense('status',new AbortController().signal),/LICENSE_RESPONSE/);assert.equal(cancelled,true);mock.mock.restore();
    t.mock.method(globalThis,'fetch',async()=>new Response('not JSON'));
    await assert.rejects(requestLicense('status',new AbortController().signal),SyntaxError);
});
async function server(t,run) {
    const instance=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.write('{'); const timer=setInterval(()=>res.write(' '),40);res.on('close',()=>{clearInterval(timer);instance.transportClosed=true;});});
    instance.listen(0,'127.0.0.1');await once(instance,'listening');
    const originalFetch=globalThis.fetch;
    t.mock.method(globalThis,'fetch',(url,options)=>originalFetch(`http://127.0.0.1:${instance.address().port}/${url}`,options));
    try{await run(instance);}finally{instance.closeAllConnections();await new Promise(resolve=>instance.close(resolve));}
}
test('one total five-second deadline aborts the live response stream', {timeout:8000}, async t => {
    const {requestLicense}=await api;
    await server(t,async instance=>{const start=performance.now();await assert.rejects(requestLicense('status',new AbortController().signal),{name:'AbortError'});
        assert.ok(performance.now()-start>=4800 && performance.now()-start<6500);await delay(50);assert.equal(instance.transportClosed,true);});
});
test('closing the panel cancels the live response without waiting for the deadline', {timeout:2000}, async t => {
    const {requestLicense}=await api;
    await server(t,async instance=>{const controller=new AbortController();const pending=requestLicense('status',controller.signal);setTimeout(()=>controller.abort(),60);
        await assert.rejects(pending,{name:'AbortError'});await delay(50);assert.equal(instance.transportClosed,true);});
});

test('activation never reports success for a response without a valid entitlement', async t => {
    const {requestLicense}=await api;
    t.mock.method(globalThis,'fetch',async()=>Response.json(missing));
    await assert.rejects(requestLicense('activate',new AbortController().signal,'synthetic-code'),/LICENSE_RESPONSE/);
});

test('removal never reports success when the server still confirms an active license', async t => {
    const {requestLicense}=await api;
    t.mock.method(globalThis,'fetch',async()=>Response.json(valid('pro')));
    await assert.rejects(requestLicense('remove',new AbortController().signal),/LICENSE_RESPONSE/);
});
