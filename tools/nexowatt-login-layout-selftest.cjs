#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');let bad=false;const fail=msg=>{console.error(`[NexoWatt EOS login layout] ${msg}`);bad=true;};
const css=read('adminWww/css/nexowatt-native-shell.css');const sourceCss=read('src-admin/public/css/nexowatt-native-shell.css');const login=read('src-admin/src/login/Login.tsx');const stableLogin=read('adminWww/static/js/nexowatt-stable-login.js');const stable=read('adminWww/static/js/nexowatt-stable-v97.js');const index=read('adminWww/index.html');const info=JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json'));
if(css!==sourceCss)fail('login CSS source/build drift');
for(const marker of ['outer frame is decorative only','orderly login, moderately enlarged','width: min(440px, calc(100vw - 20px)) !important','height: min(580px, calc(100dvh - 20px)) !important','width: min(380px, calc(100vw - 52px)) !important','min-height: 510px !important','height: auto !important','overflow: visible !important'])if(!css.includes(marker))fail(`login marker missing: ${marker}`);
if(css.includes('width: min(520px, calc(100vw - 24px))')||css.includes('width: min(460px, calc(100vw - 56px))')||css.includes('min-height: 540px !important'))fail('oversized v96 login geometry remains');
if(!css.includes('[data-nw-login-card="true"]:not(.MuiPaper-root)')||!css.includes('padding: 0 !important'))fail('stale nested-card neutralization missing');
if(/data-nw-login-card|data-nw-login-shell|min-height:590px|width:min\(460px|createElement\(['"]style/.test(stableLogin))fail('stable-login runtime still mutates geometry');
if(/width:min\(460px|min-height:540px|createElement\(['"]style/.test(stable))fail('stable v97 runtime injects geometry');
if(!login.includes("minHeight: 510")||!login.includes("overflowY: 'visible'")||!login.includes("maxHeight: 'none'"))fail('native Login source does not match v97 contract');
if(!index.includes(`nexowatt-native-shell.css?v=${info.shellCacheTag}`)||!index.includes('nexowatt-stable-v97.js?v=97'))fail('v97 login assets not active');
if(bad)process.exit(1);console.log('[NexoWatt EOS login layout] OK');
