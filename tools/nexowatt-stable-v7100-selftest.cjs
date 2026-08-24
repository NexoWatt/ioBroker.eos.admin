#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const read=r=>fs.readFileSync(path.join(root,r),'utf8');const must=(v,m)=>{if(!v){console.error(`[NexoWatt EOS stable v7100] ${m}`);process.exit(1)}};
const p=JSON.parse(read('package.json')),io=JSON.parse(read('io-package.json')),info=JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json')),css=read('adminWww/css/nexowatt-native-shell.css'),stable=read('adminWww/static/js/nexowatt-stable-v7100.js'),login=read('adminWww/static/js/nexowatt-stable-login.js'),boot=read('adminWww/js/eos-role-bootstrap.js'),password=read('src/lib/eosPassword.ts'),web=read('src/lib/web.ts'),index=read('adminWww/index.html'),auto=read('src/lib/eosAutoUpdate.ts');
must(p.version==='7.10.0'&&io.version==='7.10.0'&&io.common.version==='7.10.0'&&info.version==='7.10.0','version drift');
must(info.shellCacheVersion===7100&&info.shellCacheTag==='7100','cache tag drift');
must(index.includes('nexowatt-stable-v7100.js?v=7100')&&index.includes('eos-auto-update.js?v=7100'),'active assets missing');
must(stable.includes('ensureCockpitScroll')&&stable.includes('disableCockpitScroll')&&stable.includes("overflowY: 'scroll'")&&stable.includes("paper.addEventListener('wheel'")&&stable.includes('var(--nx-content-top, 154px)'),'scroll runtime missing or route cleanup incomplete');
must(css.includes('restored clean login geometry')&&css.includes('static labels above login fields')&&css.includes('position: static !important')&&css.includes('overflow-y: scroll !important'),'login/scroll CSS missing');
must(login.includes('MuiInputLabel-shrink')&&login.includes('normalizeGeometry')&&login.includes("removeAttribute('aria-hidden')"),'login static-label runtime missing');
must(boot.includes("const card = form?.closest?.('.MuiPaper-root')")&&!boot.includes("closest?.('.MuiPaper-root,form,main,section')"),'login Paper ownership incorrect');
must(boot.includes('waitForPasswordSocket')&&boot.includes('socket.changePassword')&&boot.includes('passwordAlreadyWritten')&&boot.includes('postWithTimeout'),'native user-editor password path missing');
must(password.includes('apiTarget: normalized.userId')&&password.includes('apiTarget: normalized.userName')&&password.includes('verifyAfterWrite')&&password.includes('verifyEosUserPasswordCredential'),'password compatibility/verification missing');
must(web.includes('EosPasswordSetupTicket')&&web.includes('passwordAlreadyWritten')&&web.includes('verifyEosUserPasswordCredential'),'setup ticket/finalization path missing');
must(!/issueEosPasswordSetupTicket[\s\S]{0,600}invalidateEosPasswordSetupTicketsForUser\(userId\)/.test(web),'policy refresh invalidates first-login ticket');
must(auto.includes('eosNexoWattAutoUpdate !== false')&&auto.includes("const POLICY: NexoWattAutoUpdatePolicy = 'major'"),'NexoWatt stable auto-update default missing');
console.log('[NexoWatt EOS stable v7100] OK');
