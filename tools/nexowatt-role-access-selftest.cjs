#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const read=r=>fs.readFileSync(path.join(root,r),'utf8');const j=r=>JSON.parse(read(r));const fail=m=>{console.error('[NexoWatt EOS role access] '+m);process.exit(1)};const must=(v,m)=>{if(!v)fail(m)};
const source=read('src/main.ts'),built=read('build/main.js'),role=read('adminWww/js/eos-role-ui.js'),boot=read('adminWww/js/eos-role-bootstrap.js'),index=read('adminWww/index.html'),io=j('io-package.json');
for(const code of [source,built]){
 for(const marker of ['system.group.installateur','system.group.endkunde','ensureEosRoleModel',"command === 'changePassword'",'password administration is Service-only',"users: { list: true, read: true, write: false"] )must(code.includes(marker),`backend marker missing: ${marker}`);
 must(!code.includes("personal password setup is required"),'socket still blocks standard password mode');
}
must(role.includes("route !== 'tab-users'")&&role.includes('filterNativeUsersPage'),'native user/account administration is not blocked for restricted roles');
must(role.includes("v7105-admin-authoritative-rbac"),'authoritative role UI version missing');
must(!index.includes('eos-account-management.js'),'custom reset runtime is still active');
must(boot.includes('NEXOWATT_EOS_STANDARD_PASSWORD_MODE')&&!boot.includes('installIntegratedFirstLogin(base);')&&!boot.includes('showFirstLoginPassword(resolved, base);'),'forced first-login UI remains');
must(io.native.eosRequireFirstLoginPassword===false&&io.native.eosRequireFirstLoginPasswordChange===false,'standard password defaults not active');
console.log('[NexoWatt EOS role access] OK (Admin full authority, restricted account administration, End User read-only datapoints)');
