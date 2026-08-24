#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const read=r=>fs.readFileSync(path.join(root,r),'utf8');const fail=m=>{console.error('[NexoWatt EOS standard password flow] '+m);process.exit(1)};const must=(v,m)=>{if(!v)fail(m)};
const source=read('src/main.ts'),built=read('build/main.js'),boot=read('adminWww/js/eos-role-bootstrap.js'),role=read('adminWww/js/eos-role-ui.js'),index=read('adminWww/index.html'),io=JSON.parse(read('io-package.json'));
for(const code of [source,built]){
 must(code.includes("EOS_STABLE_INITIAL_PASSWORD = 'nexowatt'"),'initial password constant missing');
 must(code.includes("if (created || !String(object.common?.password || '').trim())")||code.includes("if (created || !String(object.common?.password || '').trim())"),'password is not limited to new/passwordless accounts');
 for(const marker of ['nexowattPasswordChangeRequired: false','eosPasswordChangeRequired: false','nexowattFirstLoginPending: false','eosFirstLoginRequired: false','forcePasswordChange: false','standardPasswordMode: true']) must(code.includes(marker),`legacy first-login flag is not cleared: ${marker}`);
 must(code.includes("command === 'changePassword'")&&code.includes('password target outside EOS role scope'),'native password command role guard missing');
}
must(io.native.eosRequireFirstLoginPassword===false&&io.native.eosRequireFirstLoginPasswordChange===false,'forced first-password defaults remain');
must(!boot.includes('installIntegratedFirstLogin(base);')&&!boot.includes('showFirstLoginPassword(resolved, base);'),'forced password surface remains active');
must(!index.includes('eos-account-management.js'),'custom reset runtime remains active');
must(role.includes('filterNativeUsersPage')&&role.includes("route === 'tab-users'"),'role-scoped native Users page missing');
console.log('[NexoWatt EOS standard password flow] OK (nexowatt only on creation, native password editor, no forced reset flow)');
