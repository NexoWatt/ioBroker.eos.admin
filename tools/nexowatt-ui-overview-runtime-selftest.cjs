#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');const fail=msg=>{console.error(`[NexoWatt EOS UI overview runtime] ${msg}`);process.exit(1)};
const runtime=read('adminWww/js/eos-ems-overview.js');const source=read('src-admin/public/js/eos-ems-overview.js');const css=read('adminWww/css/eos-ems-overview.css');const index=read('adminWww/index.html');const role=read('adminWww/js/eos-role-ui.js');const shell=read('adminWww/js/nexowatt-native-shell.js');const intro=read('src-admin/src/tabs/Intro.tsx');const app=read('src-admin/src/App.tsx');const bundle=read('adminWww/assets/index-D2ymscJA-v84.js');
if(runtime!==source)fail('runtime source/build drift');
for(const marker of ['nexowatt-ems-overview-v1','nexowatt-ui.*.info.adminOverview.*','system.adapter.nexowatt-ui.*.alive','POLL_MS = 5000','STALE_MS = 20000','getForeignStates','Keine Kachel besitzt Schreibhoheit','currentDecisions','§14a-Fallback'])if(!runtime.includes(marker))fail(`runtime marker missing: ${marker}`);
for(const forbidden of ['setForeignState','setState(','sendToHost','writeFile','extendObject'])if(runtime.includes(forbidden))fail(`read-only runtime contains ${forbidden}`);
for(const marker of ['eos-ems-overview.css?v=96','eos-ems-overview.js?v=96','nexowatt-stable-v96.js?v=96'])if(!index.includes(marker))fail(`index marker missing: ${marker}`);
if(!css.includes('#eos-ems-overview-runtime')||!css.includes('.eos-ems-overview-metrics'))fail('EMS card CSS incomplete');
if(role.includes("overview.innerHTML = `")||!role.includes('never cover the real Admin Intro'))fail('obsolete role overview still active');
if(!shell.includes("label: 'Installateur'")||!shell.includes("label: 'Endkunde'"))fail('native hero is not role-aware');
if(!intro.includes('<NexoWattEmsOverview')||!intro.includes('getOverviewRoleConfig')||!intro.includes('admin ? this.getButtons() : null'))fail('React Intro integration incomplete');
if(!app.includes('NEXOWATT_EOS_ADMIN_SOCKET = new Connection'))fail('source socket exposure missing');
if(!bundle.includes('window.NEXOWATT_EOS_ADMIN_SOCKET=new M({'))fail('prebuilt socket exposure missing');
console.log('[NexoWatt EOS UI overview runtime] OK');
