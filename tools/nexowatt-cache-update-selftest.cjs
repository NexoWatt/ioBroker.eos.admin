#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');const fail=m=>{console.error(`[NexoWatt EOS cache update] ${m}`);process.exit(1)};const must=(c,m)=>{if(!c)fail(m)};
const source=read('src/lib/web.ts'),built=read('build/lib/web.js'),index=read('adminWww/index.html'),dev=read('src-admin/index.html'),watch=read('adminWww/js/eos-release-watch.js');
for(const code of [source,built])for(const marker of ['isEosCurrentAsset','applyNoStoreHeaders','Surrogate-Control','this.indexHTML = await this.prepareIndex'])must(code.includes(marker),`server marker missing: ${marker}`);
for(const marker of ["const RELEASE = '7.9.99'",'nexowatt.eos.loadedRelease','cache: \'no-store\'','window.location.replace','navigator.serviceWorker?.getRegistrations'])must(watch.includes(marker),`watcher marker missing: ${marker}`);
for(const html of [index,dev])for(const marker of ['eos-release-watch.js?v=99','nexowatt-stable-v99.js?v=99','nexowatt-native-shell.css?v=99'])must(html.includes(marker),`index marker missing: ${marker}`);
must(index.includes('hostInit-v84.js?v=99')&&index.includes('index-CQZugZ1z-v84.js?v=99'),'productive module entry cache tags missing');
must(!/\?v=(?:97|98)(?:["'])/.test(index),'stale product cache tag remains');
console.log('[NexoWatt EOS cache update] OK (no-store entrypoints and release watcher)');
