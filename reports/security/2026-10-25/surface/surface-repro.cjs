'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../admin');
const built = fs.readFileSync(path.join(root, 'build/lib/web.js'), 'utf8');
function between(start, end) {
  const a = built.indexOf(start), b = built.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a);
  return built.slice(a, b);
}
function capture(code, web, extras = {}) {
  let fn;
  web.server = { app: { use(...args) { fn = args.at(-1); } } };
  vm.runInNewContext(`(function(){${code}\n}).call(web)`, {
    web, _nodeFs: fs, _nodePath: path, Buffer, setTimeout, clearTimeout,
    get404Page: s => s, escapeHtml: s => s, ...extras,
  }, { timeout: 1000, filename: 'actual-shipped-web-fragment.js' });
  assert.equal(typeof fn, 'function');
  return fn;
}
function response() {
  return { statusCode: 200, headers: {}, set(k,v){this.headers[k]=v;return this;}, setHeader(k,v){this.headers[k]=v;return this;}, contentType(v){this.headers['Content-Type']=v;return this;}, status(v){this.statusCode=v;return this;}, send(v){this.body=v;return this;}, redirect(v){this.statusCode=302;this.location=v;return this;} };
}
const gateCode = between('// route middleware to make sure a user is logged in', '\n      } else {');
const filesCode = between("this.server.app.use('/files/'", '\n      // handler for oauth2 redirects');
const callbackCode = between("this.server.app.use('/oauth2_callbacks/'", '\n      // 404 handler');
test('built unauth gate accepts encoded-query suffix; file route returns synthetic private file with service context', async () => {
  const calls = [];
  const web = { settings: { auth: true }, adapter: { namespace: 'eos-admin.0', log: { warn(){} },
    async fileExists(...args){calls.push(['exists',...args]);return true;},
    async readFileAsync(...args){calls.push(['read',...args]);return { mimeType:'application/json', file:Buffer.from('{"auditSyntheticPrivate":true}') };}
  }, wwwDir:path.join(root,'adminWww'), LOGIN_PAGE:'/index.html?login' };
  const gate = capture(gateCode,web);
  const fullUrl = '/files/vis.0/private.json%3F.ico';
  const req = {url:fullUrl,originalUrl:fullUrl,headers:{},isAuthenticated:()=>false};
  const res=response();let next=false;
  gate(req,res,()=>{next=true;});assert.equal(next,true);
  const files = capture(filesCode,web);
  await files({...req,url:'/vis.0/private.json%3F.ico'},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.toString(),'{"auditSyntheticPrivate":true}');
  assert.deepEqual(calls,[['exists','vis.0','private.json'],['read','vis.0','private.json']]);
});
test('built file route makes no caller ACL decision for an authenticated low-privilege request', async () => {
  let argumentsUsed;
  const web={settings:{auth:true,accessLimit:true,accessAllowedConfigs:[],accessAllowedTabs:[]},adapter:{namespace:'eos-admin.0',log:{warn(){}},async fileExists(){return true;},async readFileAsync(...args){argumentsUsed=args;return {file:Buffer.from('synthetic-secret'),mimeType:'text/plain'};}}};
  const fn=capture(filesCode,web);const res=response();
  await fn({url:'/vis.0/private.txt',user:'guest',headers:{}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.toString(),'synthetic-secret');assert.deepEqual(argumentsUsed,['vis.0','private.txt']);
});
test('built OAuth callback emits adapter error/success HTML without escaping', () => {
  for(const key of ['error','result']){
    const marker='<img src=x onerror="window.__EOS_AUDIT_MARKER__=1">';
    const web={baseDir:root,systemLanguage:'en',adapter:{sendTo(instance,command,query,done){assert.equal(instance,'audit.0');done({[key]:marker});}}};
    const fn=capture(callbackCode,web);const res=response();fn({url:'/audit.0/?state=synthetic'},res);
    assert.equal(res.headers['Content-Type'],'text/html');assert.ok(res.body.includes(marker));assert.ok(!res.body.includes('&lt;img'));
  }
});
test('shipped frontend news condition evaluates synthetic code in its JavaScript context', () => {
  const bundle=fs.readFileSync(path.join(root,'adminWww/assets/bootstrap-COulQZax-v84.js'),'utf8');
  const match=bundle.match(/eval\(`\$\{context\.noObjects\} \$\{message\["number-of-objects"\]\}`\)/);
  assert.ok(match,'actual shipped eval expression');
  const ctx={context:{noObjects:1},message:{'number-of-objects':'; globalThis.__EOS_AUDIT_MARKER__ = true; true'},result:null};
  vm.runInNewContext('result = '+match[0],ctx,{timeout:1000});
  assert.equal(ctx.__EOS_AUDIT_MARKER__,true);assert.equal(ctx.result,true);
});
