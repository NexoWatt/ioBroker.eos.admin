#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const must=(c,m)=>{if(!c){console.error(`[NexoWatt EOS stable v100] ${m}`);process.exit(1)}};
const pkg=JSON.parse(read('package.json'));
const io=JSON.parse(read('io-package.json'));
const info=JSON.parse(read('NEXOWATT_EOS_BUILD_INFO.json'));
const source=read('src/lib/eosAutoUpdate.ts');
const built=read('build/lib/eosAutoUpdate.js');
const web=read('src/lib/web.ts');
const webBuilt=read('build/lib/web.js');
const ui=read('adminWww/js/eos-auto-update.js');
const index=read('adminWww/index.html');
must(pkg.version==='7.9.100'&&io.version==='7.9.100'&&io.common.version==='7.9.100'&&info.version==='7.9.100','version drift');
must(io.native.eosNexoWattAutoUpdate===true,'auto update is not enabled by default');
for(const marker of ['adapterAutoUpgrade','automaticUpgrade','isNexoWattRepositoryEntry','previousPolicies','previousRepositoryEnabled','getRepository']){
  must(source.includes(marker)&&built.includes(marker),`manager marker missing: ${marker}`);
}
must(source.includes("const POLICY: NexoWattAutoUpdatePolicy = 'major'")&&built.includes("const POLICY = 'major'"),'manager major policy marker missing');
must(source.includes("auto.defaultPolicy = 'none'")&&source.includes('stableVersion'),'non-NexoWatt/stable isolation missing');
must(web.includes('/nexowatt/updates/status')&&web.includes('/nexowatt/updates/settings')&&webBuilt.includes('/nexowatt/updates/settings'),'update API missing');
must(ui.includes('Automatische Adapter-Updates')&&ui.includes('X-NexoWatt-EOS-Auto-Update')&&ui.includes('jederzeit änderbar'),'admin toggle missing');
must(index.includes('eos-auto-update.css?v=100')&&index.includes('eos-auto-update.js?v=100')&&index.includes('nexowatt-stable-v100.js?v=100'),'v100 assets missing');
must(!index.includes('?v=99')&&!index.includes('stable-v99'),'stale v99 browser assets active');
console.log('[NexoWatt EOS stable v100] OK');
