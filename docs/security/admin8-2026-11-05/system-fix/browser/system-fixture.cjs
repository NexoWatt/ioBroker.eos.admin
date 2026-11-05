'use strict';
const fixtureLabel = 'Vorschau · synthetische Testdaten';
const host = {_id:'system.host.eos-demo',type:'host',common:{name:'eos-demo',hostname:'eos-demo',installedVersion:'7.2.5',platform:'Javascript/Node.js'},native:{hardware:{networkInterfaces:{eth0:[{address:'192.0.2.10',family:'IPv4',internal:false}]}}},ts:Date.now()};
const config={_id:'system.config',type:'config',common:{name:fixtureLabel,siteName:fixtureLabel,language:'de',licenseConfirmed:true,tipsDisabled:true,expertMode:false,country:'Germany',city:'Teststadt',latitude:50,longitude:10,currency:'€',tempUnit:'°C',defaultLogLevel:'info',defaultHistory:'',firstDayOfWeek:'monday',activeRepo:['stable'],diag:'none',isFloatComma:true,dateFormat:'DD.MM.YYYY'},native:{}};
const instances={};
for(const [name,title,localLink] of [['eos-admin','NexoWatt EOS Admin','http://%ip%:8081'],['nexowatt-ui','NexoWatt EOS Cockpit','http://%ip%:8082'],['nexowatt-backup','NexoWatt Sicherung','http://%ip%:8081/#tab-nexowatt-backup']])instances['system.adapter.'+name+'.0']={_id:'system.adapter.'+name+'.0',type:'instance',common:{name,title,titleLang:{de:title,en:title},enabled:true,host:'eos-demo',mode:'daemon',adminUI:{config:'json',...(name==='nexowatt-backup'?{tab:'html'}:{})},version:name==='eos-admin'?'8.0.2':'1.0.0',installedVersion:name==='eos-admin'?'8.0.2':'1.0.0',icon:'eos-fixture.svg',localLink,adminTab:name==='nexowatt-backup'?{name:'Sicherung',link:'/adapter/nexowatt-backup/tab.html',singleton:true}:undefined},native:{port:name==='eos-admin'?8081:8082,language:'de',auth:true,disableMcp:true}};
for(let i=0;i<8;i++){const name='test-navigation-'+i;instances['system.adapter.'+name+'.0']={_id:'system.adapter.'+name+'.0',type:'instance',common:{name,title:'Synthetic long navigation '+i,titleLang:{de:'Synthetische Navigation '+i,en:'Synthetic navigation '+i},enabled:true,host:'eos-demo',mode:'daemon',adminUI:{config:'json',tab:'html'},adminTab:{name:'Navigation Test '+i,link:'/adapter/'+name+'/tab.html',singleton:true},version:'1.0.0',installedVersion:'1.0.0',icon:'eos-fixture.svg'},native:{}};}
const objects={'system.certificates':{_id:'system.certificates',type:'config',common:{name:'Synthetic certificates'},native:{certificates:{}}},'system.config':config,[host._id]:host,...instances,'system.user.admin':{_id:'system.user.admin',type:'user',common:{name:'Demo Administrator',enabled:true},native:{}},'system.group.administrator':{_id:'system.group.administrator',type:'group',common:{name:'Administratoren',members:['system.user.admin']},native:{}},'system.meta.uuid':{_id:'system.meta.uuid',type:'meta',native:{uuid:'00000000-0000-4000-8000-000000000008'}},'system.repositories':{_id:'system.repositories',type:'config',common:{name:'Repositories'},native:{repositories:{stable:{link:'https://example.invalid/repo.json',json:{}}}}}};
const state=value=>({val:value,ack:true,ts:Date.now(),lc:Date.now(),from:'system.adapter.eos-admin.0'});
function states(){return Object.fromEntries(Object.keys(instances).map(id=>[id+'.alive',state(true)]).concat([[host._id+'.alive',state(true)],['nexowatt-ui.0.info.adminOverview.summaryJson',state(JSON.stringify({schemaVersion:1,generatedAt:Date.now(),updatedAt:Date.now(),available:true,status:'ok',headline:'Synthetische EMS-Vorschau',reason:'Lokale Testdaten – keine Verbindung zu einer Anlage.',binding:'none',ems:{available:true,status:'Normalbetrieb'},budget:{totalW:22000,remainingW:14200},charging:{available:true,activeCount:1,waitingCount:0,faultCount:0,actualW:4200,targetW:4200,status:'Testbetrieb'},storage:{available:true,socPercent:72,actualW:1800,targetW:1800,writeOk:true},currentDecisions:[{subsystem:'Test',severity:'info',title:fixtureLabel,reason:'Für die Ansicht wurden ausschließlich lokale Prüfdaten verwendet.'}]}))],['nexowatt-ui.0.info.adminOverview.eventsJson',state('[]')]]));}
function compactInstances(){return Object.fromEntries(Object.entries(instances).map(([id,obj])=>[id,{...obj.common,enabled:true,adminUI:{config:'json'},title:obj.common.title}]));}
async function setup(page,events,role='admin',control={}){
 const admin=role==='admin'||role==='service';
 objects['system.user.demo']={_id:'system.user.demo',type:'user',common:{name:'Demo Endkunde',enabled:true},native:{}};
 events.socket=[]; control.objects=objects; control.writes=[]; control.failNextConfigWrite=false; control.failNextSettingsRead=false;
 await page.routeWebSocket('**/*', ws=>{
  ws.onMessage(raw=>{
   let message;try{message=JSON.parse(String(raw));}catch{return;}
   const [type,id,name,args=[]]=message;
   if(type===1){ws.send('[2]');return;}
   events.socket.push({name,args});
   if(type!==3)return;
   let answer=[null,null];
   switch(name){
    case 'authenticate':answer=[true,true];break;
    case 'getVersion':answer=[null,'8.0.2','eos-admin'];break;
    case 'authEnabled':answer=[true,admin?'admin':'demo'];break;
    case 'getUserPermissions':answer=[null,{user:admin?'system.user.admin':'system.user.demo',groups:admin?['system.group.administrator']:['system.group.user'],object:{read:true,list:true,write:true,delete:true},state:{read:true,list:true,write:true,delete:true},file:{read:true,list:true,write:true,delete:true},users:{read:true,list:true,write:true,delete:true},other:{execute:true,http:true,sendto:true}}];break;
    case 'getCompactSystemConfig':answer=[null,config];break;
    case 'getCurrentInstance':answer=[null,'eos-admin.0'];break;
    case 'getIsEasyModeStrict':answer=[null,false];break;
    case 'getEasyMode':answer=[null,{configs:[]}];break;
    case 'getObject':if(args[0]==='system.repositories'&&control.failNextSettingsRead){control.failNextSettingsRead=false;answer=['Synthetic read failure'];}else answer=[null,objects[args[0]]||null];break;
    case 'getObjects':answer=[null,objects];break;
    case 'getForeignObjects':answer=[null,Object.fromEntries(Object.entries(objects).filter(([,v])=>!args[1]||v.type===args[1]))];break;
    case 'getAdapterInstances':answer=[null,Object.values(instances).filter(x=>typeof args[0]!=='string'||!args[0]||x.common.name===args[0])];break;
    case 'setObject': if(args[0]==='system.config'&&control.failNextConfigWrite){control.failNextConfigWrite=false;answer=['Synthetic write failure'];}else{objects[args[0]]=args[1];if(args[0]==='system.config'){Object.keys(config).forEach(key=>delete config[key]);Object.assign(config,args[1]);}control.writes.push({id:args[0],value:structuredClone(args[1])});answer=[null];}break;
    case 'getObjectView':answer=[null,{rows:Object.values(objects).filter(obj=>obj.type===args[1]&&obj._id>=(args[2]?.startkey||'')&&obj._id<=(args[2]?.endkey||'\uffff')).map(value=>({id:value._id,value}))}];break;
    case 'getCompactInstances':answer=[null,compactInstances()];break;
    case 'getCompactAdapters':answer=[null,Object.fromEntries(Object.values(instances).map(x=>[x.common.name,{version:x.common.version,icon:x.common.icon}]))];break;
    case 'getCompactHosts':answer=[null,[{_id:host._id,common:host.common,native:host.native}]];break;
    case 'getCompactInstalled':case 'getCompactRepository':answer=[{}];break;
    case 'getCompactSystemRepositories':answer=[null,objects['system.repositories']];break;
    case 'getHostByIp':answer=['192.0.2.10',host];break;
    case 'getForeignStates':case 'getStates':answer=[null,states()];break;
    case 'getState':answer=[null,states()[args[0]]||null];break;
    case 'getHistory':answer=[null,[]];break;
    case 'checkFeatureSupported':answer=[null,['CONTROLLER_MULTI_REPO','CONTROLLER_LICENSE_MANAGER'].includes(args[0])];break;
    case 'getAdapterName':answer=[null,'eos-admin'];break;
    case 'getLogFiles':answer=[null,[]];break;
    case 'sendToHost':answer=[args[1]==='getNotifications'?{result:{}}:args[1]==='getLogs'?[]:args[1]==='getHostInfo'||args[1]==='getHostInfoShort'?{Platform:'linux',Architecture:'x64',CPUs:4,'CPU model':'Synthetic preview',RAM:8589934592,'Node.js':'v24.22.1',time:Date.now(),hostname:'eos-demo'}:{}];break;
    case 'sendTo':answer=[{}];break;
    default:if(/^(set|del|extend|write|cmd|add|chmod)/i.test(name))answer=['Read-only browser fixture'];
   }
   ws.send(JSON.stringify([3,id,name,answer]));
  });
  ws.send(JSON.stringify([0,0,'___ready___',[]]));
 });
}
module.exports={setup,fixtureLabel};
