#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {normalizeEosPasswordTarget,setEosUserPasswordWithVerification}=require('../build/lib/eosPassword.js');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/lib/eosPassword.ts'),'utf8');
const web=fs.readFileSync(path.join(root,'src/lib/web.ts'),'utf8');

function adapterFixture({verify=true,persist=true,callback=false}={}){
  let password='old';
  let hash=persist?'$old':'';
  const calls=[];
  const adapter={
    calls,
    getForeignObjectAsync:async id=>id==='system.user.user'?{_id:id,common:{password:hash},native:{}}:null,
    checkPasswordAsync:async (user,value,options)=>{calls.push({kind:'check',user,value,options});return [verify&&user==='user'&&value===password,'system.user.user'];},
  };
  const set=async(user,value,options)=>{calls.push({kind:'set',user,value,options});if(user!=='user')throw new Error('shortUserNameRequired');if(persist){password=value;hash=`$hash:${value}`;}};
  if(callback) adapter.setPassword=(user,value,options,cb)=>set(user,value,options).then(()=>cb(),cb);
  else adapter.setPasswordAsync=set;
  return adapter;
}

(async()=>{
  assert.deepEqual(normalizeEosPasswordTarget('user'),{userId:'system.user.user',userName:'user'});
  assert.deepEqual(normalizeEosPasswordTarget('system.user.user'),{userId:'system.user.user',userName:'user'});
  assert.throws(()=>normalizeEosPasswordTarget('system.user.bad.name'),/invalidPasswordTarget/);
  for(const fixture of [adapterFixture(),adapterFixture({callback:true})]){
    const result=await setEosUserPasswordWithVerification(fixture,'system.user.user','Strong!2026');
    assert.equal(result.userName,'user');
    assert.equal(fixture.calls.find(c=>c.kind==='set').user,'user','password API must receive short user name');
    assert.deepEqual(fixture.calls.find(c=>c.kind==='set').options,{user:'system.user.admin'});
    assert.equal(fixture.calls.find(c=>c.kind==='check').user,'user','password check must receive short user name');
  }
  const noCheck=adapterFixture();delete noCheck.checkPasswordAsync;
  await setEosUserPasswordWithVerification(noCheck,'user','NoCheck!2026');
  await assert.rejects(()=>setEosUserPasswordWithVerification(adapterFixture({persist:false}),'user','Missing!2026'),/passwordNotPersisted/);
  await assert.rejects(()=>setEosUserPasswordWithVerification(adapterFixture({verify:false}),'user','Verify!2026'),/passwordVerificationFailed/);
  for(const marker of ['setPasswordAsync(userName','checkPasswordAsync(userName','common?.password','userId.replace(/^system\\.user\\./']) assert(source.includes(marker),`source marker missing: ${marker}`);
  assert(!/setForeignObject|common\.password\s*=/.test(source),'helper must never hash/write common.password itself');
  assert(web.includes('extendForeignObjectAsync')&&web.includes('passwordMetadataNotPersisted'),'first-login metadata persistence guard missing');
  assert(!web.includes('setForeignObjectAsync(access.userId, userObject)'),'stale full-user first-login write remains');
  console.log('[NexoWatt EOS password write] OK (short name, persistence, credential and native-only metadata)');
})().catch(error=>{console.error(error?.stack||error);process.exit(1);});
