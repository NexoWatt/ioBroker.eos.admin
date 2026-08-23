#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');const must=(ok,msg)=>{if(!ok){console.error(`[NexoWatt EOS stable v98] ${msg}`);process.exit(1)}};
const pkg=JSON.parse(read('package.json')),io=JSON.parse(read('io-package.json')),info=JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json')),css=read('adminWww/css/nexowatt-native-shell.css'),stable=read('adminWww/static/js/nexowatt-stable-v98.js'),login=read('adminWww/static/js/nexowatt-stable-login.js'),index=read('adminWww/index.html'),web=read('src/lib/web.ts'),built=read('build/lib/web.js'),account=read('adminWww/js/eos-account-management.js'),bootstrap=read('adminWww/assets/bootstrap-COulQZax-v84.js'),ems=read('adminWww/js/eos-ems-overview.js');
must(pkg.version==='7.9.98'&&io.version==='7.9.98'&&io.common.version==='7.9.98'&&info.version==='7.9.98','version drift');
must(info.shellCacheVersion===98&&info.shellCacheTag==='98','shell cache not v98');
must(css.includes('overflow-y: auto !important')&&css.includes('scrollbar-color: rgba(0, 229, 138'),'cockpit vertical scrollbar missing');
must(css.includes('.MuiInputLabel-root { display: none !important; }')&&bootstrap.includes('I18n.t("enterLogin")+" *"'),'clean login field contract missing');
must(stable.includes("VERSION = 'v98-scroll-login-password-write'")&&!login.includes('data-nw-login-card'),'stable runtime incorrect');
must(index.includes('nexowatt-stable-v98.js?v=98')&&index.includes('nexowatt-native-shell.css?v=98'),'v98 assets not loaded');
for(const code of [web,built])for(const marker of ['getEosPasswordUserName','setPasswordAsync(userName, password','checkPasswordAsync(userName, password','passwordVerificationFailed','updateEosAccountMetadata','extendForeignObjectAsync'])must(code.includes(marker),`password marker missing: ${marker}`);
must(account.includes('Startpasswort „nexowatt“')&&account.includes('credentials: \'include\''),'reset UI does not describe/use stable initial password flow');
must(ems.includes("REQUIRED_UI_VERSION = '0.8.198'")&&ems.includes('readUiAdapterInfo'),'working EMS diagnosis was lost');
console.log('[NexoWatt EOS stable v98] OK');
