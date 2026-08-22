#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');const must=(ok,msg)=>{if(!ok){console.error(`[NexoWatt EOS stable v96] ${msg}`);process.exit(1)}};
const pkg=JSON.parse(read('package.json'));const io=JSON.parse(read('io-package.json'));const info=JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json'));const css=read('adminWww/css/nexowatt-native-shell.css');const boot=read('adminWww/js/eos-role-bootstrap.js');const role=read('adminWww/js/eos-role-ui.js');const stable=read('adminWww/static/js/nexowatt-stable-v96.js');const index=read('adminWww/index.html');
must(pkg.version==='7.9.96'&&io.version==='7.9.96'&&io.common.version==='7.9.96'&&info.version==='7.9.96','version drift');
must(info.shellCacheVersion===96&&info.shellCacheTag==='96','shell cache is not v96');
must(css.includes('width: min(460px, calc(100vw - 56px)) !important')&&css.includes('overflow: visible !important'),'spacious login override missing');
must(!/showFirstLoginPassword[\s\S]{0,5000}form\.elements\.username\.value = claim\.userName/.test(boot),'undefined claim variable remains in first-password flow');
must(boot.includes('form.elements.username.value = userName;')&&boot.includes('controller.abort(), 8000'),'first-password repair incomplete');
must(role.includes('never cover the real Admin Intro')&&!role.includes('overview.innerHTML = `'),'old action-tile overview remains');
must(stable.includes("VERSION = 'v96-spacious-login-first-password-fix'")&&stable.includes('width:min(460px'),'stable v96 login runtime incomplete');
must(index.includes('nexowatt-stable-v96.js?v=96'),'stable v96 runtime not loaded');
console.log('[NexoWatt EOS stable v96] OK');
