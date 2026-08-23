#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');const json=rel=>JSON.parse(read(rel));
const fail=m=>{console.error(`[NexoWatt EOS account management] ${m}`);process.exit(1)};const must=(c,m)=>{if(!c)fail(m)};
const mainSource=read('src/main.ts'),mainBuilt=read('build/main.js'),webSource=read('src/lib/web.ts'),webBuilt=read('build/lib/web.js'),passwordSource=read('src/lib/eosPassword.ts');
const sourceUi=read('src-admin/public/js/eos-account-management.js'),builtUi=read('adminWww/js/eos-account-management.js'),roleUi=read('adminWww/js/eos-role-ui.js'),css=read('adminWww/css/nexowatt-native-shell.css'),index=read('adminWww/index.html'),info=json('NEXOWATT_EOS_BUILD_INFO.json'),shellTag=String(info.shellCacheTag||info.shellCacheVersion);
for(const code of [mainSource,mainBuilt])for(const marker of ['system.user.installer','system.user.guest','ensureEosDefaultRoleUsers','unknown random bootstrap secret','personal password setup is required'])must(code.includes(marker),`main marker missing: ${marker}`);
for(const code of [webSource,webBuilt]){
  for(const marker of ['getEosManagedAccounts','sendEosAccountManagement','resetEosAccountPassword','/nexowatt/account/manage','/nexowatt/account/reset','x-nexowatt-eos-account-reset','canResetInstaller','canResetEndUser',"targetUserId === 'system.user.admin'",'targetUserId === access.userId','const managedAccounts = await this.getEosManagedAccounts(access.role)','const managedTarget = managedAccounts.find(account => account.id === targetUserId)',"managedTarget?.role === 'installer'","managedTarget?.role === 'enduser'",'passwordResetAt','passwordResetBy',"passwordResetMode = 'initial-password'","setEosUserPassword(targetUserId, 'nexowatt')",'passwordlessFirstLoginAllowed = false','initialPasswordRequired: true','accountDisabled','passwordMetadataNotPersisted']) must(code.includes(marker),`web marker missing: ${marker}`);
  must(!code.includes('const explicitInstaller = targetAccess.groups.some'),'obsolete explicit installer re-classifier remains');
  must(!code.includes('const explicitEndUser = targetAccess.groups.some'),'obsolete explicit end-user re-classifier remains');
  must(!code.includes('setForeignObjectAsync(targetUserId, user)'),'reset still writes stale full user object');
}
for(const marker of ['setPasswordAsync(userName','checkPasswordAsync(userName','passwordNotPersisted','passwordVerificationFailed'])must(passwordSource.includes(marker),`password helper marker missing: ${marker}`);
for(const marker of ["VERSION = 'v100-account-management-password-write'","['admin', 'installer']",'nexowatt/account/manage','nexowatt/account/reset','X-NexoWatt-EOS-Account-Reset','data.canResetInstaller === true',"account.role === 'enduser'",'Admin/Service','Installateure','NEXOWATT_EOS_ACCOUNT_MANAGEMENT','ensureEntrySurface',"currentRoute() !== 'tab-users'",'eos-account-management-entry','Startpasswort „nexowatt“','passwordVerificationFailed'])must(sourceUi.includes(marker),`UI marker missing: ${marker}`);
must(sourceUi===builtUi,'account management source/build drift');
must(!sourceUi.includes("launcher.className = 'eos-account-management-launcher'"),'standalone account launcher remains');
must(!sourceUi.includes('new MutationObserver'),'account management adds a broad observer');
must(roleUi.includes("route === 'tab-users'"),'installer cannot reach Zugänge & Rechte');
must(!roleUi.includes('NEXOWATT_EOS_ACCOUNT_MANAGEMENT.open'),'overview opens account management outside Zugänge & Rechte');
must(index.includes(`eos-account-management.js?v=${shellTag}`),'account management cache tag stale');
for(const marker of ['.eos-account-management-entry','.eos-account-management-overlay','.eos-account-management-dialog','.eos-account-row','.eos-account-reset','html.eos-account-page-installer'])must(css.includes(marker),`CSS marker missing: ${marker}`);
console.log('[NexoWatt EOS account management] OK (managed-list authorization and real password reset)');
