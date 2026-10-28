'use strict';
// Executes original shipped methods; controller and HTTP response boundaries are doubles.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../admin');
const source=fs.readFileSync(path.join(root,'build/lib/web.js'),'utf8');
const exportsObject={};
const sandbox={exports:exportsObject,module:{exports:exportsObject},__dirname:path.join(root,'build/lib'),Buffer,URL,console,process:{env:{}},require:name=>name.startsWith('node:')?require(name):name==='./eosRequestSecurity'?require(path.join(root,'build/lib/eosRequestSecurity.js')):{}};
vm.runInNewContext(source,sandbox,{filename:'original-shipped-build/lib/web.js',timeout:5000});
const web=Object.create(exportsObject.default.prototype);
web.settings={auth:true,secure:true};
web.eosPasswordClaims=new Map();web.eosPasswordClaimRates=new Map();
const observations=[];
function observe(name,result){observations.push({name,result});console.log(JSON.stringify({name,result}));}
for(const origin of ['//attacker.invalid/x/index.html','/%5Cattacker.invalid/x/index.html','/\\attacker.invalid/x/index.html']){
 const result=web.getSafeLoginOrigin({url:'/logout?origin='+encodeURIComponent(origin)});
 observe('redirect-prefix:'+origin,result);
 if(origin.startsWith('//'))assert.equal(result,'//attacker.invalid/x');
}
const badScheme=web.isEosSameOriginWrite({headers:{host:'eos.local:8188',origin:'http://eos.local:8188',cookie:'access_token=test-only-placeholder'},protocol:'https',socket:{encrypted:true}});
assert.equal(badScheme,true);observe('production-origin-check-accepts-http-origin-on-https',badScheme);
const sessionToken='audit-placeholder-access-token';
let lookups=[];
web.adapter={getSession(id,callback){lookups.push(id);callback({user:'operator',aExp:Date.now()+60000});},async getForeignObjectAsync(){return {type:'user',common:{enabled:true,password:'testhash'},native:{}};},log:{info(){},debug(){},warn(){}}};
function response(){return {code:0,jsonBody:null,cookies:[],setHeader(){},status(code){this.code=code;return this;},json(body){this.jsonBody=body;return this;},cookie(...args){this.cookies.push(args);return this;},clearCookie(){}};}
(async()=>{
 assert.equal(await web.readEosCurrentUser({headers:{},query:{token:sessionToken}}),'system.user.operator');
 observe('query-token-authenticates',{lookups});
 const user={_id:'system.user.legacy',type:'user',common:{enabled:true,password:'existing-hash'},native:{nexowattEosAccount:{passwordlessFirstLoginAllowed:true,forcePasswordChange:true}}};
 web.adapter.getForeignObjectAsync=async()=>user;
 web.getEosAccessForUserId=async()=>({role:'installer'});
 web.getEosFirstLoginPasswordState=async()=>({required:true,minLength:12});
 const request={headers:{host:'eos.local:8188',origin:'https://eos.local:8188','x-nexowatt-eos-passwordless-claim':'1'},ip:'192.168.5.10',socket:{remoteAddress:'192.168.5.10'},body:{user:'legacy'}};
 const claimResponse=response();
 await web.startEosPasswordlessFirstLogin(request,claimResponse);
 assert.equal(claimResponse.code,200);assert.equal(claimResponse.cookies.length,1);
 const claimToken=claimResponse.cookies[0][1];
 let wrote=false;
 web.setEosUserPassword=async(id,pw)=>{assert.equal(id,'system.user.legacy');assert.equal(pw,'Audit-Only-Example!42');wrote=true;};
 web.updateEosAccountMetadata=async(id,mutator)=>mutator(user.native,user.native.nexowattEosAccount);
 const complete={...request,headers:{host:'eos.local:8188',origin:'https://eos.local:8188','x-nexowatt-eos-passwordless-password':'1',cookie:'nexowatt_eos_first_login='+claimToken},body:{password:'Audit-Only-Example!42',passwordRepeat:'Audit-Only-Example!42'}};
 const completeResponse=response();await web.saveEosPasswordlessFirstLogin(complete,completeResponse);
 assert.equal(completeResponse.code,200);assert.equal(wrote,true);
 observe('unauthenticated-private-peer-claims-flagged-legacy-account',{claimStatus:claimResponse.code,passwordWriteInvoked:wrote,completionStatus:completeResponse.code,usesAuthenticatedIdentity:false,precondition:'enabled non-admin, passwordlessFirstLoginAllowed:true, required password setup'});
 const src=fs.readFileSync(path.join(root,'src/lib/web.ts'),'utf8');
 assert.ok(src.indexOf("this.server.app.all(['/sso', '/sso-callback']")<src.indexOf('this.oauth2Model = createOAuth2Server'));
 assert.ok(source.indexOf("this.server.app.all(['/sso', '/sso-callback']")<source.indexOf('this.oauth2Model = (0, _webserver.createOAuth2Server)'));
 observe('SSO-deny-routes-before-OAuth-registration-source-and-build',true);
 const sessionsEqual=fs.readFileSync(path.join(root,'src/lib/eosSessionSecurity.js')).equals(fs.readFileSync(path.join(root,'build/lib/eosSessionSecurity.js')));
 assert.equal(sessionsEqual,true);observe('session-security-source-equals-shipped-helper',true);
 observe('limits','No real Express router, installed dependencies, controller, browser or socket transport exercised. Password write is a spy, not a real account change.');
})().catch(error=>{console.error(error);process.exitCode=1;});
