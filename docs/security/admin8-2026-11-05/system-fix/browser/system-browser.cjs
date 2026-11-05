'use strict';
// Real release frontend in Chromium; in-memory controller and license responses only.
// No customer data, live controller, real keys, or external network requests.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function option(name, fallback) {
    const i = process.argv.indexOf(name);
    return i < 0 ? fallback : process.argv[i + 1];
}
const root = path.resolve(option('--root', path.join(__dirname, '../../../../..')));
const output = path.resolve(option('--output', path.join(__dirname, 'rerun')));
const modulePath = process.env.EOS_PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES && path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright')) || 'playwright';
const { chromium } = require(modulePath);
const executable = process.env.EOS_BROWSER_EXECUTABLE || chromium.executablePath();
const runtime = path.dirname(executable);
const assetRoot = path.join(root, 'adminWww');
const expectedVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
assert.equal(JSON.parse(fs.readFileSync(path.join(assetRoot,'NEXOWATT_EOS_FRONTEND_MANIFEST.json'))).productVersion,expectedVersion,'Build must match current product version');
const onePixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const licenseStatus = edition => ({ v:1,uuid:'00000000-0000-4000-8000-000000000008',valid:true,code:'LICENSE_VALID',edition,expiresAt:null,features:['energy','smartHome',...(edition==='pro'?['microgridMaster']:[])],limits:{chargePoints:edition==='pro'?20:3,batteries:edition==='pro'?10:2},adapters:['nexowatt-ui'] });
fs.mkdirSync(output,{recursive:true});
const result = { scope:'Actual shipped EOS Admin React frontend; synthetic authenticated HTTP/WebSocket and in-memory persistence; no real controller or appliance', version:expectedVersion, testedAt:new Date().toISOString(), node:process.version, manifestSha256:sha(fs.readFileSync(path.join(assetRoot,'NEXOWATT_EOS_FRONTEND_MANIFEST.json'))), scenarios:[] };

let lastPage;
async function createScenario(browser,name,role,viewport,options={}) {
    const context=await browser.newContext({viewport,locale:'de-DE'});
    const page=await context.newPage();lastPage=page;
    const data={name,role,viewport,checks:[],errors:[],console:[],missing:[],externalBlocked:[],syntheticMaps:[],requests:[],dialogs:[]};
    const control={role,license:licenseStatus('home'),licenseCalls:[],failNextLicense:false};
    const fixtureFile=path.join(__dirname,'system-fixture.cjs');delete require.cache[fixtureFile];
    await require(fixtureFile).setup(page,data,role,control);
    if(options.emptySiteName)control.objects['system.config'].common.siteName='';
    page.on('pageerror',e=>data.errors.push(e.message));
    page.on('console',m=>{if(['warning','error'].includes(m.type()))data.console.push({type:m.type(),text:m.text()});});
    page.on('dialog',async d=>{data.dialogs.push({type:d.type(),message:d.message()});await d.accept();});
    await page.route('**/*',async route=>{
        const request=route.request();const url=new URL(request.url());
        data.requests.push({method:request.method(),path:url.pathname});
        if(/(^|\.)tile\.osm\.org$/.test(url.hostname)){data.syntheticMaps.push(url.pathname);return route.fulfill({contentType:'image/png',body:onePixel});}
        if(url.hostname==='nominatim.openstreetmap.org'){data.syntheticMaps.push(url.pathname);return route.fulfill({json:[]});}
        if(url.hostname!=='eos-preview.test'){data.externalBlocked.push(url.href);return route.abort();}
        let rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
        if(rel==='favicon.ico')return route.fulfill({status:204,body:''});
        if(/^adapter\/[a-z0-9-]+\/eos-fixture\.svg$/.test(rel))rel='img/eos/eos-logo.svg';
        if(rel==='logout')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic logout</title>'});
        if(rel==='nexowatt/security/context')return route.fulfill({json:{authenticated:true,user:control.role==='admin'?'system.user.admin':'system.user.demo',isAdmin:control.role==='admin',role:control.role}});
        if(rel.startsWith('nexowatt/license/')){
            control.licenseCalls.push({method:request.method(),path:rel,headers:{origin:request.headers().origin,'x-eos-license':request.headers()['x-eos-license']},body:request.postDataJSON()});
            if(control.role!=='admin')return route.fulfill({status:403,json:{error:'LICENSE_ADMIN_REQUIRED'}});
            if(control.failNextLicense){control.failNextLicense=false;return route.fulfill({status:503,json:{error:'SERVICE_UNAVAILABLE'}});}
            if(rel.endsWith('/activate')){
                assert.equal(request.headers()['x-eos-license'],'1');
                assert.equal(request.headers().origin,'https://eos-preview.test');
                control.license=licenseStatus('pro');
            }else if(rel.endsWith('/remove')){
                assert.equal(request.headers()['x-eos-license'],'1');
                assert.equal(request.headers().origin,'https://eos-preview.test');
                control.license={...licenseStatus(null),valid:false,code:'LICENSE_MISSING',features:[],limits:{},adapters:[]};
            }
            return route.fulfill({json:control.license});
        }
        if(rel.startsWith('nexowatt/'))return route.fulfill({json:{available:false,enabled:false,authenticated:false,role:'unknown'}});
        const filename=path.resolve(assetRoot,rel);
        if(!filename.startsWith(assetRoot+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){data.missing.push(rel);return route.fulfill({status:404,body:'Missing synthetic fixture asset'});}
        let body=fs.readFileSync(filename);
        const contentType={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'}[path.extname(filename)]||'application/octet-stream';
        if(rel==='index.html')body=Buffer.from(body.toString().replaceAll("'@@disableDataReporting@@'",'true').replaceAll("'@@auth@@'","'true'").replaceAll("'@@ssoActive@@'",'false').replaceAll("'@@socketPath@@'","''").replace(/@@[^@]+@@/g,''));
        return route.fulfill({contentType,body});
    });
    await page.goto('https://eos-preview.test/#tab-intro',{waitUntil:'domcontentloaded'});
    await page.locator('.eos-native-intro-grid').waitFor({timeout:25000});
    return {context,page,data,control};
}
async function visibleUnclipped(locator,viewport) {
    await locator.waitFor({state:'visible',timeout:10000});
    await locator.click({trial:true,timeout:10000});
    const box=await locator.boundingBox();
    assert(box&&box.width>20&&box.height>20,'Control has no usable hit area');
    assert(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'Control extends beyond viewport');
    const hit=await locator.evaluate(el=>{const b=el.getBoundingClientRect();const at=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return !!at&&(el===at||el.contains(at));});
    assert(hit,'Control center is clipped or covered');
    return box;
}
async function openNavigation(page) {
    if(await page.locator('[data-eos-tab="tab-system"]').isVisible())return;
    const menu=page.locator('[data-eos-menu-toggle="1"]').filter({visible:true}).first();
    await menu.click();
    await page.locator('[data-eos-tab="tab-system"]').waitFor({state:'visible'});
}
async function runAdmin(browser,name,viewport,options) {
    const s=await createScenario(browser,name,'admin',viewport,options);const {page,data,control}=s;
    result.scenarios.push(data);
    const system=page.locator('[data-eos-tab="tab-system"]');
    const expert=page.locator('[data-eos-expert-control="1"]');
    await openNavigation(page);
    data.controls={system:await visibleUnclipped(system,viewport),expert:await visibleUnclipped(expert,viewport)};
    data.navigation=await page.locator('.MuiDrawer-paper > .MuiList-root').evaluate(el=>{
        const before=el.scrollLeft;el.scrollLeft=el.scrollWidth;
        return {width:el.clientWidth,contentWidth:el.scrollWidth,before,after:el.scrollLeft};
    });
    assert(data.navigation.contentWidth>data.navigation.width,'Synthetic long navigation must overflow');
    await visibleUnclipped(system,viewport);await visibleUnclipped(expert,viewport);
    data.checks.push('System/Expert controls remain reachable while long adapter navigation scrolls');
    await expert.click();
    if(await page.getByRole('dialog').count())await page.getByRole('dialog').getByRole('button').last().click();
    await page.waitForFunction(()=>sessionStorage.getItem('App.expertMode')==='true');
    assert.equal(await expert.getAttribute('aria-pressed'),'true');
    await expert.click();
    await page.waitForFunction(()=>sessionStorage.getItem('App.expertMode')==='false');
    assert.equal(await expert.getAttribute('aria-pressed'),'false');
    data.checks.push('Visible System and Expert controls; expert session mode enables and disables');
    await openNavigation(page);await system.click();
    await page.locator('#siteName').waitFor({timeout:15000});
    assert.equal(await page.locator('#city').inputValue(),'Teststadt');
    assert.equal(await page.locator('#latitude').inputValue(),'50');
    assert.equal(await page.locator('#longitude').inputValue(),'10');
    data.checks.push('Native system settings open and retain customer/site and location fields');
    data.systemText=(await page.getByRole('dialog').first().innerText()).slice(0,4000);
    if(process.argv.includes('--inspect')){
        await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
        await s.context.close();return;
    }
    await page.locator('#siteName').fill('Prüfanlage 8.0.2');
    const saveButton=page.getByRole('button',{name:/Speichern und schließen|Save & Close/i});
    control.failNextConfigWrite=true;
    await saveButton.click();
    await page.locator('[data-eos-system-save-error]').waitFor();
    assert.equal(await page.locator('#siteName').inputValue(),'Prüfanlage 8.0.2');
    assert.equal(await saveButton.isEnabled(),true);
    data.checks.push('Synthetic save failure preserves edits and releases Save button for retry');
    await saveButton.click();
    await page.locator('#siteName').waitFor({state:'detached',timeout:10000});
    assert.equal(control.objects['system.config'].common.siteName,'Prüfanlage 8.0.2');
    assert.equal(control.objects['system.config'].common.city,'Teststadt');
    data.checks.push('Save persists customer/site name and preserves location');
    await openNavigation(page);await system.click();await page.locator('#siteName').waitFor();
    assert.equal(await page.locator('#siteName').inputValue(),'Prüfanlage 8.0.2');
    await page.locator('#siteName').fill('Nicht speichern');
    await page.getByRole('dialog').first().getByRole('button',{name:/^(Schließen|Abbrechen)$/}).click();
    await page.locator('#ar_dialog_confirm_ok_').click();
    await page.locator('#siteName').waitFor({state:'detached'});
    assert.equal(control.objects['system.config'].common.siteName,'Prüfanlage 8.0.2');
    await openNavigation(page);await system.click();await page.locator('#siteName').waitFor();
    assert.equal(await page.locator('#siteName').inputValue(),'Prüfanlage 8.0.2');
    data.checks.push('Discard leaves stored configuration unchanged');
    await page.getByRole('tab',{name:'EOS Home / Pro'}).click();
    await page.getByText('EOS Home',{exact:true}).waitFor({timeout:10000});
    data.checks.push('Native EOS licensing tab renders valid Home status');
    control.failNextLicense=true;
    await page.locator('[data-eos-license-refresh]').click();
    await page.locator('[data-eos-license-panel] [role="alert"]').filter({hasText:/nicht bereit/}).waitFor();
    assert.equal(await page.getByText('EOS Home',{exact:true}).count(),0);
    await page.locator('[data-eos-license-refresh]').click();
    await page.getByText('EOS Home',{exact:true}).waitFor();
    data.checks.push('License request failure removes stale confirmation and refresh restores status');
    const syntheticCode='NWL2.SYNTHETIC_BROWSER_FIXTURE_NOT_A_REAL_KEY';
    await page.locator('#eos-license-code').fill(syntheticCode);
    await page.locator('[data-eos-license-activate]').click();
    await page.getByText('EOS Pro',{exact:true}).waitFor();
    assert.equal(await page.locator('#eos-license-code').inputValue(),'');
    assert.equal(await page.evaluate(code=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>String(value).includes(code)),syntheticCode),false);
    data.checks.push('Synthetic activation sends same-origin guarded request, displays Pro, clears input, does not persist code in browser storage');
    await page.locator('[data-eos-license-remove]').click();
    await page.getByRole('dialog').last().getByRole('button',{name:'Abbrechen',exact:true}).click();
    assert.equal(control.licenseCalls.filter(c=>c.path.endsWith('/remove')).length,0);
    await page.locator('[data-eos-license-remove]').click();
    await page.getByRole('dialog').last().getByRole('button',{name:'Entfernen',exact:true}).click();
    await page.getByText('Keine Lizenz aktiviert.',{exact:true}).waitFor();
    assert.equal(control.licenseCalls.filter(c=>c.path.endsWith('/remove')).length,1);
    data.checks.push('License removal requires confirmation; cancel sends nothing; confirm shows unlicensed status');
    data.licenseText=(await page.getByRole('dialog').first().innerText()).slice(0,5000);
    assert.equal(await page.locator('a[href="/nexowatt/license"]').count(),0);
    data.checks.push('No floating standalone license link remains');
    data.writes=control.writes.map(w=>({id:w.id,siteName:w.value.common?.siteName}));
    data.licenseCalls=control.licenseCalls.map(c=>({...c,body:c.body?{keys:Object.keys(c.body)}:null}));
    await page.getByRole('dialog').first().getByRole('button',{name:/^(Schließen|Abbrechen)$/}).click();
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nexowatt-eos-policy',{detail:{policy:{authenticated:true,role:'enduser'}}})));
    await page.locator('[data-eos-expert-control]').waitFor({state:'detached'});
    assert.equal(await page.locator('[data-eos-tab="tab-system"]').count(),0);
    data.checks.push('Authenticated policy downgrade removes administrator controls immediately');
    await s.context.close();
}
async function runEnduser(browser){
    const s=await createScenario(browser,'enduser','enduser',{width:1440,height:1000});result.scenarios.push(s.data);
    assert.equal(await s.page.locator('[data-eos-tab="tab-system"]').count(),0);
    assert.equal(await s.page.locator('[data-eos-expert-control]').count(),0);
    await s.page.goto('https://eos-preview.test/#system/tabEosLicenses');
    await s.page.waitForTimeout(250);
    assert.equal(await s.page.locator('#siteName').count(),0);
    assert.equal(s.control.licenseCalls.length,0);
    s.data.checks.push('Enduser has no System/Expert control; direct System/license route denied before license request');
    await s.context.close();
}
(async()=>{
    const sparticuz=process.env.EOS_BROWSER_PROFILE==='sparticuz';
    const launchOptions={headless:true,executablePath:executable,env:sparticuz?{...process.env,LD_LIBRARY_PATH:[runtime,path.join(runtime,'lib'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),FONTCONFIG_PATH:path.join(runtime,'fonts')}:process.env,args:sparticuz?['--no-sandbox','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]};
    let browser=await chromium.launch(launchOptions);
    result.browser=await browser.version();
    try{
        await runAdmin(browser,'desktop',{width:1900,height:1000});
        if(!process.argv.includes('--inspect')){
            await browser.close();browser=await chromium.launch(launchOptions);
            await runAdmin(browser,'mobile',{width:390,height:844},{emptySiteName:true});
            await browser.close();browser=await chromium.launch(launchOptions);
            await runEnduser(browser);
        }
        for(const scenario of result.scenarios){
            assert.equal(scenario.errors.length,0,scenario.name+' page errors');
            assert.equal(scenario.missing.length,0,scenario.name+' missing assets');
            assert.equal(scenario.externalBlocked.length,0,scenario.name+' unexpected external requests');
            const unexpectedConsole=scenario.console.filter(item=>!/^Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/.test(item.text));
            assert.equal(unexpectedConsole.length,0,scenario.name+' unexpected console errors/warnings');
        }
        result.status='passed';
    }catch(error){result.status='failed';result.failure=error.stack;if(lastPage&&!lastPage.isClosed()){result.failureBody=(await lastPage.locator('body').innerText()).slice(0,15000);await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
    finally{fs.writeFileSync(path.join(output,'system-browser-result.json'),JSON.stringify(result,null,2)+'\n');await browser.close();}
    console.log(JSON.stringify({status:result.status,version:result.version,browser:result.browser,checks:result.scenarios.map(s=>({name:s.name,checks:s.checks}))}));
})().catch(error=>{console.error(error);process.exitCode=1;});
