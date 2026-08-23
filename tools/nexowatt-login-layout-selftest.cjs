#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');let bad=false;const fail=msg=>{console.error(`[NexoWatt EOS login layout] ${msg}`);bad=true;};
const css=read('adminWww/css/nexowatt-native-shell.css');const sourceCss=read('src-admin/public/css/nexowatt-native-shell.css');const login=read('src-admin/src/login/Login.tsx');const stableLogin=read('adminWww/static/js/nexowatt-stable-login.js');const stable=read('adminWww/static/js/nexowatt-stable-v98.js');const index=read('adminWww/index.html');const info=JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json'));const bootstrap=read('adminWww/assets/bootstrap-COulQZax-v84.js');
if(css!==sourceCss)fail('login CSS source/build drift');
for(const marker of ['NexoWatt EOS 7.9.98 – stable scrolling','html.eos-app body','overflow: hidden !important','overflow-y: auto !important','width: min(456px','width: min(400px','min-height: 0 !important','overflow: visible !important','.MuiInputLabel-root { display: none !important; }','.MuiOutlinedInput-input::placeholder','margin-top: 28px !important'])if(!css.includes(marker))fail(`login marker missing: ${marker}`);
if(!login.includes("minHeight: 0")||!login.includes("maxWidth: 400")||!login.includes('placeholder={`${I18n.t(\'enterLogin\')} *`}')||!login.includes('placeholder={`${I18n.t(\'enterPassword\')} *`}'))fail('native Login source does not use clean v98 placeholders');
if(!bootstrap.includes('placeholder:')||!bootstrap.includes('I18n.t("enterLogin")+" *"')||!bootstrap.includes('I18n.t("enterPassword")+" *"'))fail('productive login bundle does not use placeholders');
if(/label:.*I18n\.t\("enterLogin"\)|label:.*I18n\.t\("enterPassword"\)/.test(bootstrap.slice(1335000,1340500)))fail('productive login bundle still uses floating labels');
if(/data-nw-login-card|data-nw-login-shell|min-height:590px|width:min\(460px|createElement\(['"]style/.test(stableLogin))fail('stable-login runtime mutates geometry');
if(/width:min\(460px|min-height:540px|createElement\(['"]style/.test(stable))fail('stable v98 runtime injects geometry');
if(!index.includes(`nexowatt-native-shell.css?v=${info.shellCacheTag}`)||!index.includes('nexowatt-stable-v98.js?v=98'))fail('v98 login assets not active');
if(bad)process.exit(1);console.log('[NexoWatt EOS login layout] OK');
