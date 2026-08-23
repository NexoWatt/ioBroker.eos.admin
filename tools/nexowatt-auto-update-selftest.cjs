#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {NexoWattStableUpdateManager,isNexoWattRepositoryEntry}=require('../build/lib/eosAutoUpdate.js');
const objects=new Map();
objects.set('system.adapter.eos-admin.0',{_id:'system.adapter.eos-admin.0',common:{name:'eos-admin',version:'7.9.100'},native:{eosNexoWattAutoUpdate:true}});
objects.set('system.config',{_id:'system.config',common:{activeRepo:['stable'],adapterAutoUpgrade:{repositories:{stable:false},defaultPolicy:'none'}},native:{}});
objects.set('system.repositories',{_id:'system.repositories',native:{repositories:{stable:{json:{'eos-admin':{name:'eos-admin',version:'7.9.100',meta:'https://github.com/NexoWatt/ioBroker.eos-admin'},'nexowatt-ui':{name:'nexowatt-ui',version:'0.8.198',publisher:'NexoWatt'},'nexowatt-beta':{name:'nexowatt-beta',version:'1.0.0-beta.1',publisher:'NexoWatt'},admin:{name:'admin',version:'7.7.0',publisher:'ioBroker'}}}}}});
objects.set('system.adapter.eos-admin',{_id:'system.adapter.eos-admin',common:{name:'eos-admin',version:'7.9.100',automaticUpgrade:'patch'},native:{}});
objects.set('system.adapter.nexowatt-ui',{_id:'system.adapter.nexowatt-ui',common:{name:'nexowatt-ui',version:'0.8.197'},native:{}});
objects.set('system.adapter.admin',{_id:'system.adapter.admin',common:{name:'admin',version:'7.7.0',automaticUpgrade:'minor'},native:{}});
const copy=v=>JSON.parse(JSON.stringify(v));
const refresh=[];
const adapter={namespace:'eos-admin.0',host:'eos-host',log:{debug(){},info(){},warn(){},error(){}},getForeignObjectAsync:async id=>copy(objects.get(id)||null),setForeignObjectAsync:async(id,obj)=>{objects.set(id,copy(obj));},extendForeignObjectAsync:async(id,part)=>{const base=copy(objects.get(id)||{_id:id,common:{},native:{}});base.native={...(base.native||{}),...(part.native||{})};base.common={...(base.common||{}),...(part.common||{})};objects.set(id,base);},getObjectViewAsync:async()=>({rows:[...objects.entries()].filter(([id])=>/^system\.adapter\.[^.]+$/.test(id)).map(([id,value])=>({id,value:copy(value)}))}),sendToHostAsync:async(...args)=>{refresh.push(args);}};
(async()=>{
 assert.equal(isNexoWattRepositoryEntry('nexowatt-ui',{publisher:'NexoWatt'}),true);
 assert.equal(isNexoWattRepositoryEntry('admin',{publisher:'ioBroker'}),false);
 const manager=new NexoWattStableUpdateManager(adapter);
 const enabled=await manager.reconcile('test');
 assert.equal(enabled.enabled,true);assert.equal(enabled.repository,'stable');assert.deepEqual(enabled.managedAdapters,['eos-admin','nexowatt-ui']);
 assert.equal(objects.get('system.adapter.eos-admin').common.automaticUpgrade,'major');
 assert.equal(objects.get('system.adapter.nexowatt-ui').common.automaticUpgrade,'major');
 assert.equal(objects.get('system.adapter.admin').common.automaticUpgrade,'minor');
 assert.equal(objects.get('system.config').common.adapterAutoUpgrade.repositories.stable,true);
 // A manual user change while EOS management is active must not be overwritten on disable.
 objects.get('system.adapter.nexowatt-ui').common.automaticUpgrade='minor';
 const disabled=await manager.setEnabled(false);assert.equal(disabled.enabled,false);
 assert.equal(objects.get('system.adapter.eos-admin').common.automaticUpgrade,'patch');
 assert.equal(objects.get('system.adapter.nexowatt-ui').common.automaticUpgrade,'minor');
 assert.equal(objects.get('system.adapter.admin').common.automaticUpgrade,'minor');
 assert.equal(objects.get('system.config').common.adapterAutoUpgrade.repositories.stable,false);
 manager.stop();
 console.log('[NexoWatt EOS auto update] OK (native policy, stable-only scope, third-party isolation and restore)');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
