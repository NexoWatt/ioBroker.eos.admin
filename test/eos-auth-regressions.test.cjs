'use strict';
// Shipped runtime methods with controlled controller/request boundaries.
// This is not an installed Express/ioBroker/browser integration test.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const security=require('../build/lib/eosRequestSecurity');
const code=fs.readFileSync(path.join(root,'build/lib/web.js'),'utf8');
const exportsObject={};
vm.runInNewContext(code,{exports:exportsObject,module:{exports:exportsObject},__dirname:path.join(root,'build/lib'),Buffer,URL,console,process:{env:{}},require:name=>name.startsWith('node:')?require(name):name==='./eosRequestSecurity'?security:{}},{filename:'shipped-build/lib/web.js',timeout:5000});
const makeWeb=()=>Object.assign(Object.create(exportsObject.default.prototype),{settings:{auth:true,secure:true}});
function response(){return{code:0,body:undefined,locals:{},headers:{},cookies:[],status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(name,value){this.headers[name]=value;},clearCookie(...args){this.cookies.push(args);}};}

test('login redirect rejects remote, protocol-relative, encoded separator, backslash and control origins',()=>{
 const web=makeWeb();
 for(const origin of ['//other.invalid/x/index.html','https://other.invalid/x/index.html','/\\other.invalid/x/index.html','/%5Cother.invalid/x/index.html','%2f%2fother.invalid/x/index.html','/a/../x/index.html','/a/./x/index.html','/a\n/x/index.html','/a/index.html?next=other','/login/index.html']){
  assert.equal(web.getSafeLoginOrigin({url:'/logout?origin='+encodeURIComponent(origin)}),null,origin);
 }
 assert.equal(web.getSafeLoginOrigin({url:'/logout?origin='+encodeURIComponent('/proxy/eos/index.html')}),'/proxy/eos');
 assert.equal(web.getSafeLoginOrigin({url:'/logout'}),null);
 assert.equal(web.getSafeLoginOrigin({url:'/logout?origin=/index.html'}),null);
});

test('production same-origin caller binds HTTPS versus HTTP and rejects forged forwarded origin',()=>{
 const web=makeWeb(),req={headers:{host:'eos.local:8188',origin:'https://eos.local:8188',cookie:'access_token=audit-placeholder'}};
 assert.equal(web.isEosSameOriginWrite(req),true);
 assert.equal(web.isEosSameOriginWrite({headers:{...req.headers,origin:'http://eos.local:8188'}}),false);
 assert.equal(web.isEosSameOriginWrite({headers:{...req.headers,origin:'https://other.invalid','x-forwarded-host':'other.invalid','x-forwarded-proto':'https'}}),false);
 web.settings.secure=false;
 assert.equal(web.isEosSameOriginWrite(req),false);
 assert.equal(web.isEosSameOriginWrite({headers:{...req.headers,origin:'http://eos.local:8188'}}),true);
 assert.equal(web.isEosSameOriginWrite({headers:{host:'eos.local',authorization:'Bearer audit-placeholder'}}),true);
 assert.equal(web.isEosSameOriginWrite({headers:{host:'eos.local',cookie:'access_token=audit-placeholder'}}),false);
});

test('all retired passwordless endpoints deny even legacy-enabled accounts and existing claim cookies',async()=>{
 const web=makeWeb();web.settings.eosPasswordlessFirstLogin=true;
 let touched=false;web.adapter=new Proxy({}, {get(){touched=true;throw new Error('Controller must not be reached');}});
 for(const name of ['getEosPasswordlessFirstLoginStatus','startEosPasswordlessFirstLogin','saveEosPasswordlessFirstLogin']){
  const res=response();await web[name]({user:'admin',headers:{cookie:'nexowatt_eos_first_login=old-claim'},body:{user:'legacy',password:'test-only'},ip:'192.168.1.2'},res);
  assert.equal(res.code,410);assert.equal(res.body.error,'passwordlessActivationDisabled');assert.equal(res.body.eligible,false);assert.equal(res.cookies[0][0],'nexowatt_eos_first_login');
 }
 assert.equal(touched,false);
});

test('HTTP credential query guard rejects bearer/password forms and preserves normal OAuth code/state',()=>{
 for(const key of ['token','TOKEN','access_token','refresh_token','pass','password','ssoLoginResponse']){
  for(const value of ['secret','',[],{}])assert.equal(security.hasEosUrlCredentials({[key]:value}),true,key);
 }
 assert.equal(security.hasEosUrlCredentials({user:'account-selector',code:'one-time-authorization-code',state:'csrf-state'}),false);
 const src=fs.readFileSync(path.join(root,'src/lib/web.ts'),'utf8');
 assert.ok(src.indexOf('hasEosUrlCredentials(req.query')<src.indexOf('this.oauth2Model = createOAuth2Server'));
 assert.ok(code.indexOf('hasEosUrlCredentials)(req.query')<code.indexOf('this.oauth2Model = (0, _webserver.createOAuth2Server)'));
});

test('EOS token readers no longer accept query credentials but preserve cookie and Authorization',async()=>{
 const web=makeWeb();let reads=0;
 web.adapter={getSession(id,cb){reads++;cb({user:'operator',aExp:Date.now()+60000});},async getForeignObjectAsync(){return{type:'user',common:{enabled:true}};}};
 const query={headers:{},query:{token:'audit-placeholder-session'}};
 assert.equal(web.readAccessTokenFromRequest(query),null);assert.equal(web.extractAccessToken(query),null);assert.equal(await web.readEosCurrentUser(query),null);assert.equal(reads,0);
 for(const headers of [{cookie:'access_token=audit-placeholder-session'},{authorization:'Bearer audit-placeholder-session'}]){
  assert.equal(await web.readEosCurrentUser({headers,query:{}}),'system.user.operator');
 }
});

test('file identity guard rejects anonymous and pending-password users and passes normalized caller',async()=>{
 for(const [userId,pending,expected] of [[null,false,401],['system.user.user',true,403],['system.user.user',false,0]]){
  const web=makeWeb();web.getEosRequestAccess=async()=>({userId,role:'enduser'});web.getEosFirstLoginPasswordState=async()=>({required:pending});
  const res=response();let next=false;
  await new Promise(resolve=>{const original=res.json;res.json=function(body){original.call(this,body);resolve();return this;};web.eosAuthenticatedRouteGuard()({},res,()=>{next=true;resolve();});});
  assert.equal(res.code,expected);assert.equal(next,expected===0);assert.equal(res.locals.eosAuthenticatedUser,expected===0?userId:undefined);
 }
});

test('SSO remains denied before OAuth and DB file routes have their own identity guard',()=>{
 const src=fs.readFileSync(path.join(root,'src/lib/web.ts'),'utf8');
 for(const text of [src,code]){
  assert.ok(text.includes("this.server.app.all(['/sso', '/sso-callback']"));
  assert.ok(text.indexOf("this.server.app.all(['/sso', '/sso-callback']")<text.indexOf('this.adapter.eosSessionSecurity.bindOAuthModel'));
  assert.ok(text.includes("this.server.app.use('/files/', this.eosAuthenticatedRouteGuard()"));
  assert.ok(text.includes("this.server.app.use('/adapter/', this.eosAuthenticatedRouteGuard()"));
  assert.ok(!text.includes("pathName.endsWith('.ico')"));
  assert.ok(!text.includes("pathName.endsWith('manifest.json')"));
  assert.ok(!text.includes('readFolderRecursive'));
 }
});

test('OAuth callback messages are HTML text, replacement metacharacters cannot restore markup',()=>{
 const start=code.indexOf('function escapeHtml('),end=code.indexOf('\nfunction ',start+1);
 assert.ok(start>=0&&end>start);
 const escape=vm.runInNewContext(`const matchHtmlRegExp=/[\"'&<>]/;${code.slice(start,end)};escapeHtml`);
 const payload='<img src=x onerror="audit-marker">$&\'&';
 const expression=code.match(/text = text\.replace\('%MESSAGE%', \(\) => escapeHtml\(String\(_result\?\.result \|\| ''\)\.slice\(0, 4096\)\)\);/);
 assert.ok(expression,'actual shipped success sink must use escaped callback replacement');
 const rendered=vm.runInNewContext(`let text='<div>%MESSAGE%</div>';${expression[0]};text`,{escapeHtml:escape,_result:{result:payload}});
 assert.ok(!rendered.includes('<img'));assert.ok(rendered.includes('&lt;img'));assert.ok(rendered.includes('$&'));
 assert.ok(code.includes("script-src 'none'"));
});
