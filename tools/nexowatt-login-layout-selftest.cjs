#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const read=r=>fs.readFileSync(path.join(root,r),'utf8');const fail=m=>{console.error(`[NexoWatt EOS login layout] ${m}`);process.exit(1)};const must=(c,m)=>{if(!c)fail(m)};
const css=read('adminWww/css/nexowatt-native-shell.css'),sourceCss=read('src-admin/public/css/nexowatt-native-shell.css'),login=read('src-admin/src/login/Login.tsx'),bundle=read('adminWww/assets/bootstrap-COulQZax-v84.js'),boot=read('adminWww/js/eos-role-bootstrap.js'),stableLogin=read('adminWww/static/js/nexowatt-stable-login.js'),stable=read('adminWww/static/js/nexowatt-stable-v7100.js'),index=read('adminWww/index.html'),info=JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json'));
must(css===sourceCss,'login CSS source/build drift');
for(const marker of ['NexoWatt EOS 7.10.0 – restored clean login geometry','NexoWatt EOS 7.10.0 final – static labels above login fields','width: min(424px, calc(100vw - 20px)) !important','width: min(372px, calc(100vw - 48px)) !important','position: static !important','transform: none !important','display: none !important','overflow: visible !important'])must(css.includes(marker),`login marker missing: ${marker}`);
must(!css.includes('width: min(520px, calc(100vw - 24px))')&&!css.includes('width: min(460px, calc(100vw - 56px))'),'oversized v96 geometry remains');
must(stableLogin.includes('normalizeGeometry')&&stableLogin.includes('MuiInputLabel-shrink')&&stableLogin.includes("removeAttribute('data-nw-login-card')")&&stableLogin.includes("removeAttribute('aria-hidden')"),'login cleanup/static-label runtime missing');
must(!/setAttribute\(['"]data-nw-login-card|createElement\(['"]style/.test(stableLogin),'stable-login runtime creates geometry attributes/styles');
must(!/width:min\(460px|min-height:540px|createElement\(['"]style/.test(stable),'stable runtime injects login geometry');
must(boot.includes("const card = form?.closest?.('.MuiPaper-root')")&&!boot.includes("closest?.('.MuiPaper-root,form,main,section')"),'login Paper ownership incorrect');
must(login.includes('minHeight: 0')&&login.includes('maxWidth: 372')&&login.includes("marginTop: 18")&&login.includes('width: 90')&&(login.match(/inputLabel: \{ shrink: true \}/g)||[]).length>=2,'native Login source does not match product contract');
for(const marker of ['p:"26px 28px 24px"','width:"calc(100% - 48px)"','maxWidth:372','width:90,height:90','marginTop:18','inputLabel:{shrink:!0}'])must(bundle.includes(marker),`productive login bundle marker missing: ${marker}`);
must(index.includes(`nexowatt-native-shell.css?v=${info.shellCacheTag}`)&&index.includes('nexowatt-stable-v7100.js?v=7100'),'v7100 login assets not active');
console.log('[NexoWatt EOS login layout] OK (single Paper, static labels, compact responsive geometry)');
