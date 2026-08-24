#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {normalizeEosPasswordTarget,setEosUserPasswordWithVerification,verifyEosUserPasswordCredential}=require('../build/lib/eosPassword.js');
function adapter({canonicalFails=false, optionsFail=false, verify=true}={}){
 const user={_id:'system.user.user',common:{password:'$old'},native:{}};let accepted='old';const calls=[];
 const set=async(target,password,options)=>{calls.push({target,password,options});if(canonicalFails&&target==='system.user.user')throw new Error('canonicalRejected');if(optionsFail&&options)throw new Error('optionsRejected');user.common.password=`$${Date.now()}:${password}`;accepted=password};
 return {calls,getForeignObjectAsync:async id=>id==='system.user.user'?user:null,setPasswordAsync:set,checkPasswordAsync:async(target,password)=>[verify&&['system.user.user','user'].includes(target)&&password===accepted,'system.user.user']};
}
(async()=>{
 assert.deepEqual(normalizeEosPasswordTarget('user'),{userId:'system.user.user',userName:'user'});
 const normal=adapter();const a=await setEosUserPasswordWithVerification(normal,'system.user.user','Strong!2026');assert.equal(a.apiTarget,'system.user.user');
 await verifyEosUserPasswordCredential(normal,'system.user.user','Strong!2026');
 const legacy=adapter({canonicalFails:true});const b=await setEosUserPasswordWithVerification(legacy,'system.user.user','Legacy!2026');assert.equal(b.apiTarget,'user');
 const noOptions=adapter({optionsFail:true});const c=await setEosUserPasswordWithVerification(noOptions,'system.user.user','NoOptions!2026');assert.ok(['system.user.user','user'].includes(c.apiTarget));assert.ok(noOptions.calls.some(call=>call.options===null));
 await assert.rejects(()=>setEosUserPasswordWithVerification(adapter({verify:false}),'user','Fail!2026'),/passwordVerificationFailed/);
 console.log('[NexoWatt EOS password write v7100] OK');
})().catch(error=>{console.error(error.stack||error);process.exit(1)});
