'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
function option(name) {
 const index = process.argv.indexOf(name);
 if (index < 0) return undefined;
 const value = process.argv[index + 1];
 if (!value || value.startsWith('--')) throw new Error(name + ' requires a value');
 return value;
}
function loadPlaywright() {
 if (process.env.EOS_PLAYWRIGHT_MODULE) return require(process.env.EOS_PLAYWRIGHT_MODULE);
 try { return require('playwright'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
 if (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) return require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'));
 throw new Error('Install Playwright separately or set EOS_PLAYWRIGHT_MODULE');
}
const { chromium } = loadPlaywright();
const root = path.resolve(option('--root') || process.env.EOS_ADMIN_ROOT || path.join(__dirname, '../../../..'));
const output = path.resolve(option('--output') || path.join(__dirname, 'rerun'));
fs.mkdirSync(output, { recursive: true });
const custom = path.join(root, 'admin/custom');
const hostMode = process.argv.includes('--host');
const hostName = hostMode ? 'eos-preview.test' : 'eos-easyaccess.test';
const executable = process.env.EOS_BROWSER_EXECUTABLE || chromium.executablePath();
const runtime = path.dirname(executable);
const files = fs.readdirSync(path.join(custom, 'assets'));
const gui = files.find(f => f.includes('__loadShare___mf_0_iobroker_mf_1_gui_mf_2_components__'));
const dom = files.find(f => f.includes('__loadShare__react_mf_2_dom_mf_1_client__'));
const result = { environment: { node: process.version, scope: 'Real shipped EasyAccess remote and its actual bundled React/GUI/JSONConfig; synthetic socket, isolated browser; no live controller' }, errors: [], console: [], requests: [], external: [], missing: [] };
(async () => {
 const sparticuz = process.env.EOS_BROWSER_PROFILE === 'sparticuz';
 const browser = await chromium.launch({ executablePath: executable, headless: true, env: sparticuz ? { ...process.env, LD_LIBRARY_PATH: [runtime, path.join(runtime,'lib'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'), FONTCONFIG_PATH: path.join(runtime,'fonts') } : process.env, args: sparticuz ? ['--no-sandbox', '--no-zygote', '--single-process', '--in-process-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
 result.environment.browser = await browser.version();
 const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
 if (hostMode) {
  await require(path.join(root, 'docs/security/admin8-2026-11-04/browser/overview-fixture.cjs')).setup(page, result, 'admin');
  result.environment.scope = 'Real EOS Admin frontend plus actual shipped EasyAccess remote and vendor bundles; synthetic authenticated fixture/socket; no live controller';
 }
 page.on('pageerror', e => result.errors.push(e.message));
 page.on('console', m => { if (['warning','error'].includes(m.type())) result.console.push({ type: m.type(), text: m.text() }); });
 await page.route('**/*', async route => {
  const url = new URL(route.request().url()); result.requests.push(url.pathname);
  if (url.hostname !== hostName) { result.external.push(url.href); return route.abort(); }
  if (hostMode && !url.pathname.startsWith('/custom/')) {
   let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
   if (/^adapter\/(?:eos-admin|nexowatt-ui|nexowatt-backup)\/eos-fixture\.svg$/.test(rel)) rel = 'img/eos/eos-logo.svg';
   if (rel === 'nexowatt/security/context') return route.fulfill({ json:{authenticated:true,user:'system.user.admin',isAdmin:true,role:'admin'} });
   if (rel.startsWith('nexowatt/')) return route.fulfill({ status:200,json:{available:false,enabled:false,authenticated:false,role:'unknown'} });
   const hostRoot = path.join(root,'adminWww');
   const hostFile = path.resolve(hostRoot,rel);
   if (!hostFile.startsWith(hostRoot+path.sep) || !fs.existsSync(hostFile) || !fs.statSync(hostFile).isFile()) {result.missing.push(rel);return route.fulfill({status:404,body:'Missing host fixture asset'});}
   let body = fs.readFileSync(hostFile);
   if (rel === 'index.html') body=Buffer.from(body.toString().replaceAll("'@@disableDataReporting@@'",'true').replaceAll("'@@auth@@'","'true'").replaceAll("'@@ssoActive@@'",'false').replaceAll("'@@socketPath@@'","''").replace(/@@[^@]+@@/g,''));
   const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'}[path.extname(hostFile)]||'application/octet-stream';
   return route.fulfill({status:200,contentType:mime,body});
  }
  if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title>EasyAccess integration test</title></head><body><h1>EasyAccess – synthetic test</h1><div id="mount"></div></body></html>' });
  if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
  const rel = decodeURIComponent(url.pathname).replace(/^\/custom\//, '');
  const file = path.resolve(custom, rel);
  if (!url.pathname.startsWith('/custom/') || !file.startsWith(custom + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { result.missing.push(url.pathname); return route.fulfill({ status:404,body:'Missing fixture asset' }); }
  return route.fulfill({ contentType: file.endsWith('.js') ? 'text/javascript' : 'application/json', body: fs.readFileSync(file) });
 });
 await page.goto('http://' + hostName + (hostMode ? '/#tab-intro' : '/'));
 if (hostMode) {
  await page.locator('.eos-native-intro-grid').waitFor({timeout:25000});
  result.hostReady = true;
  await page.evaluate(()=>{const mount=document.createElement('div');mount.id='mount';document.body.appendChild(mount);});
 }
 try {
  result.mount = await page.evaluate(async ({ gui, dom, hostMode }) => {
   const remote = await import('/custom/customComponents.js');
   await remote.init({});
   const exposed = (await remote.get('./Components'))();
   const Component = exposed.default.ConfigCustomEasyAccess;
   const g = await import('/custom/assets/' + gui);
   // In the real host the existing React renderer owns the component. The remote's
   // separate demo bootstrap renderer is outside its production import graph.
   const client = hostMode ? globalThis.__mf_module_cache__?.share['default:react-dom/client'] : (await import('/custom/assets/' + dom)).t;
   if (typeof client?.createRoot !== 'function') throw new Error('Expected host or standalone React renderer is unavailable');
   const reactRoot = client.createRoot(document.getElementById('mount'));
   window.fixtureChanges = []; window.fixtureReads = 0;
   let data = { accessAllowedConfigs: ['alpha.0'], accessAllowedTabs: [] };
   const fixtures = [
    { _id:'system.adapter.zeta.0',common:{adminUI:{config:'json'},adminTab:true} },
    { _id:'system.adapter.alpha.0',common:{adminUI:{config:'json'}} },
    { _id:'system.adapter.hidden.0',common:{adminUI:{config:'none'}} },
    { _id:'system.adapter.<img src=x onerror=window.xssTriggered=true>.0',common:{adminUI:{config:'json'}} }
   ];
   const props = { attr:'accessAllowedConfigs',schema:{type:'custom',newLine:true},alive:true,expertMode:true,custom:false,
    oContext:{adapterName:'eos-admin',instance:0,themeType:'light',socket:{getAdapterInstances:async()=>{window.fixtureReads++;return fixtures;}},forceUpdate:()=>{},registerOnForceUpdate:()=>{},unregisterOnForceUpdate:()=>{}},onError:()=>{},
    onChange:(next,_unused,callback)=>{window.fixtureChanges.push(structuredClone(next));data=next;render();callback?.();}
   };
   function render(){reactRoot.render(g.Mr(Component,{...props,data}));}
   render();
   return { exports:Object.keys(exposed),rendererSource:hostMode?'existing EOS Admin share scope':'standalone remote bootstrap',reactVersion:globalThis.__mf_module_cache__?.share['default:react']?.version||null };
  }, { gui, dom, hostMode });
  await page.locator('input[type="checkbox"]').first().waitFor({ timeout: 10000 });
  result.before = { rows:await page.locator('tbody tr').allTextContents(),checkboxes:await page.locator('input[type="checkbox"]').count(),checked:await page.locator('input[type="checkbox"]:checked').count() };
  const row=page.locator('tbody tr').filter({hasText:'zeta.0'});
  await row.locator('input[type="checkbox"]').first().click();
  await page.waitForFunction(()=>window.fixtureChanges.length===1);
  result.afterConfig = await page.evaluate(()=>structuredClone(window.fixtureChanges));
  await row.locator('input[type="checkbox"]').nth(1).click();
  await page.waitForFunction(()=>window.fixtureChanges.length===2);
  result.afterTab = await page.evaluate(()=>({changes:window.fixtureChanges,reads:window.fixtureReads,xssTriggered:window.xssTriggered===true,injectedImages:document.querySelectorAll('#mount img').length}));
  await page.screenshot({path:path.join(output,'easyaccess-browser.png'),fullPage:true});
 } catch(e) { result.errors.push(e.stack||e.message); }
 await browser.close();
 result.artifact = Object.fromEntries(['customComponents.js','mf-manifest.json'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(custom,f))).digest('hex')]));
 fs.writeFileSync(path.join(output,'easyaccess-browser.json'),JSON.stringify(result,null,2)+'\n');
 assert.equal(result.errors.length,0,JSON.stringify(result.errors));
 assert.equal(result.console.length,0,JSON.stringify(result.console));
 assert.equal(result.external.length,0); assert.equal(result.missing.length,0);
 assert.equal(result.before.rows.length,3); assert.equal(result.before.checkboxes,4); assert.equal(result.before.checked,1);
 assert.deepEqual(result.afterConfig[0].accessAllowedConfigs,['alpha.0','zeta.0']);
 assert.deepEqual(result.afterTab.changes[1].accessAllowedTabs,['zeta.0']);
 assert.equal(result.afterTab.reads,1);assert.equal(result.afterTab.xssTriggered,false);assert.equal(result.afterTab.injectedImages,0);
 console.log(JSON.stringify({result:'passed',rows:3,checkboxes:4,changes:2,externalRequests:0,missing:0,errors:0,console:result.console}));
})().catch(e=>{console.error(e);process.exitCode=1;});
