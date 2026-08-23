#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');const fail=m=>{console.error(`[NexoWatt EOS login layout] ${m}`);process.exit(1)};const must=(c,m)=>{if(!c)fail(m)};
const css=read('adminWww/css/nexowatt-native-shell.css'),sourceCss=read('src-admin/public/css/nexowatt-native-shell.css');
const login=read('src-admin/src/login/Login.tsx'),stableLogin=read('adminWww/static/js/nexowatt-stable-login.js'),stable=read('adminWww/static/js/nexowatt-stable-v99.js'),index=read('adminWww/index.html'),info=JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json'));
must(css===sourceCss,'login CSS source/build drift');
for(const marker of ['outer frame is decorative only','orderly login, moderately enlarged','width: min(440px, calc(100vw - 20px)) !important','height: min(580px, calc(100dvh - 20px)) !important','width: min(380px, calc(100vw - 52px)) !important','min-height: 510px !important','height: auto !important','overflow: visible !important'])must(css.includes(marker),`login marker missing: ${marker}`);
must(!css.includes('width: min(520px, calc(100vw - 24px))')&&!css.includes('width: min(460px, calc(100vw - 56px))'),'oversized v96 geometry remains');
must(!/data-nw-login-card|data-nw-login-shell|min-height:590px|width:min\(460px|createElement\(['"]style/.test(stableLogin),'stable-login runtime mutates geometry');
must(!/width:min\(460px|min-height:540px|createElement\(['"]style/.test(stable),'stable v99 runtime injects login geometry');
must(login.includes('minHeight: 510')&&login.includes("overflowY: 'visible'")&&login.includes("maxHeight: 'none'"),'native Login source does not match product contract');
must(index.includes(`nexowatt-native-shell.css?v=${info.shellCacheTag}`)&&index.includes('nexowatt-stable-v99.js?v=99'),'v99 login assets not active');
console.log('[NexoWatt EOS login layout] OK');
