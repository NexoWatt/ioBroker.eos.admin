'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function option(name) {
 const index = process.argv.indexOf(name);
 if (index === -1) return undefined;
 const value = process.argv[index + 1];
 if (!value || value.startsWith('--')) throw new Error(name + ' requires a path');
 return value;
}
function playwright() {
 if (process.env.EOS_PLAYWRIGHT_MODULE) return require(process.env.EOS_PLAYWRIGHT_MODULE);
 for (const name of ['playwright', 'playwright-core']) {
  try { return require(name); } catch (error) {
   if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
 }
 throw new Error('Install Playwright 1.62.1 separately or set EOS_PLAYWRIGHT_MODULE to its absolute module path. See README.md.');
}
const { chromium } = playwright();
const repositoryRoot = path.resolve(option('--root') || process.env.EOS_ADMIN_ROOT || path.join(__dirname, '../../../..'));
const outputRoot = path.resolve(option('--output') || process.env.EOS_BROWSER_OUTPUT_ROOT || path.join(__dirname, 'rerun'));
fs.mkdirSync(outputRoot, { recursive: true });
const accessRole = process.argv.includes('--enduser') ? 'enduser' : 'admin';
const overview = process.argv.includes('--overview') || process.argv.includes('--enduser');
const root = path.join(repositoryRoot, 'adminWww');
(async () => {
 const args = process.env.EOS_BROWSER_PROFILE === 'sparticuz'
  ? ['--no-sandbox', '--no-zygote', '--single-process', '--in-process-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : [];
 const browser = await chromium.launch({headless: true, ...(process.env.EOS_BROWSER_EXECUTABLE ? {executablePath: path.resolve(process.env.EOS_BROWSER_EXECUTABLE)} : {}), args});
 const page = await browser.newPage({viewport:{width:1440,height:overview?1200:1000},locale:'de-DE'});
 const events = {console:[], errors:[], missing:[], blocked:[], requests:[], artifactManifestSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'NEXOWATT_EOS_FRONTEND_MANIFEST.json'))).digest('hex')};
 if (overview) await require('./overview-fixture.cjs').setup(page,events,accessRole);
 page.on('console', msg => { if(msg.type()==='error'||msg.type()==='warning') events.console.push({type:msg.type(),text:msg.text()}); });
 page.on('pageerror', error => (events.errors.push(error.message),console.log('PAGEERROR',error.message)));
 await page.route('**/*', async route => {
  const url=new URL(route.request().url());events.requests.push(url.href);
  if(url.hostname!=='eos-preview.test') { events.blocked.push(url.href); return route.abort(); }
  let rel=decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if(/^adapter\/(?:eos-admin|nexowatt-ui|nexowatt-backup)\/eos-fixture\.svg$/.test(rel)) rel='img/eos/eos-logo.svg';
  if(rel==='logout') return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Preview reserve session closed</title>'});
  if(rel==='nexowatt/security/context')return route.fulfill({json:overview?{authenticated:true,user:accessRole==='admin'?'system.user.admin':'system.user.demo',isAdmin:accessRole==='admin',role:accessRole}:{authenticated:false,role:'unknown'}});
  if(rel.startsWith('nexowatt/'))return route.fulfill({status:200,json:{available:false,enabled:false,authenticated:false,role:'unknown'}});
  const filename=path.resolve(root,rel);
  if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()) {events.missing.push(rel);return route.fulfill({status:404,body:'Fixture resource not found'});}
  let body=fs.readFileSync(filename);
  const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'}[path.extname(filename)]||'application/octet-stream';
  if(rel==='index.html')body=Buffer.from(body.toString().replaceAll("'@@disableDataReporting@@'",'true').replaceAll("'@@auth@@'", "'true'").replaceAll("'@@ssoActive@@'",'false').replaceAll("'@@socketPath@@'","''").replace(/@@[^@]+@@/g,''));
  return route.fulfill({status:200,contentType:mime,body});
 });
 await page.goto(overview?'http://eos-preview.test/#tab-intro':'http://eos-preview.test/?login',{waitUntil:'domcontentloaded'});
 try { await page.locator(overview?'[data-eos-tab="tab-objects"]':'input[type="password"]').first().waitFor({timeout:25000}); if(overview) { await page.locator('.eos-native-intro-grid').waitFor({timeout:10000}); const before=events.socket.filter(item=>item.name==='getForeignStates').length; await page.waitForTimeout(1200); events.emsReadsAfterReady=events.socket.filter(item=>item.name==='getForeignStates').length-before; } } catch(e) { events.errors.push(e.message); }
 await page.screenshot({path:path.join(outputRoot,overview?(accessRole==='enduser'?'admin8-enduser-preview.png':'admin8-overview-preview.png'):'admin8-login-preview.png'),fullPage:true});
 events.role=accessRole; events.uiChecks={expertControls:await page.locator('[data-eos-expert-control]').count(),userTab:await page.locator('[data-eos-tab="tab-users"]').count(),userTabVisible:await page.locator('[data-eos-tab="tab-users"]').first().isVisible(),objectTab:await page.locator('[data-eos-tab="tab-objects"]').count(),nativeHero:await page.locator('[data-eos-native-react-overview]').count(),legacyHero:await page.locator('[data-eos-runtime-overview-hero]').count()}; events.title=await page.title();events.body=(await page.locator('body').innerText()).slice(0,5000);
 fs.writeFileSync(path.join(outputRoot,overview?(accessRole==='enduser'?'browser-enduser-result.json':'browser-overview-result.json'):'browser-login-result.json'),JSON.stringify(events,null,2));
 await browser.close();
 const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'browser-verification-summary.json'), 'utf8'));
 assert.equal(events.artifactManifestSha256, expected.artifactManifestSha256, 'The input artifact differs from the recorded release');
 for (const key of ['console', 'errors', 'missing', 'blocked']) assert.equal(events[key].length, 0, key + ' must be empty');
 assert(events.requests.includes('http://eos-preview.test/remoteEntry-eos-8.0.0.js'));
 assert(!events.requests.includes('http://eos-preview.test/remoteEntry.js'));
 const publicRequests = events.requests.filter(url => /\/js\/(eos|nexowatt)/.test(url));
 assert(publicRequests.length >= 15);
 for (const request of publicRequests) assert.equal(new URL(request).searchParams.get('eos-release'), '8.0.0');
 if (overview) {
  assert.equal(events.uiChecks.nativeHero, 1);
  assert.equal(events.uiChecks.legacyHero, 0);
  assert.equal(events.uiChecks.objectTab, 1);
  assert.equal(events.uiChecks.expertControls, accessRole === 'admin' ? 1 : 0);
  assert.equal(events.uiChecks.userTabVisible, accessRole === 'admin');
  assert(events.emsReadsAfterReady <= 1, 'Unexpected repeated EMS reads after readiness');
 }
 console.log(JSON.stringify({title:events.title,errors:events.errors,missing:events.missing,blocked:events.blocked,screenshot:overview?(accessRole==='enduser'?'admin8-enduser-preview.png':'admin8-overview-preview.png'):'admin8-login-preview.png'}));
})().catch(e=>{console.error(e);process.exit(1);});
