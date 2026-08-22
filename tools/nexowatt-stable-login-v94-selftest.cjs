const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const io = require(path.join(root, 'io-package.json'));
function fail(m) { console.error('[NexoWatt EOS stable login] ' + m); process.exit(1); }
if (pkg.version !== '7.9.94' || io.common.version !== '7.9.94') fail('version mismatch');
if (io.native.port !== 8081) fail('EOS default port must be 8081');
if (io.native.disableMcp !== true || io.native.eosAssistEnabled !== false) fail('EOS Assist must be disabled in stable');
for (const k of ['eosAllowPasswordlessFirstLogin','eosAllowFirstLoginWithoutPassword']) if (io.native[k] === true) fail(k + ' must be false');
const backend = fs.readFileSync(path.join(root,'build/lib/nexowattStableAuth.js'),'utf8');
if (!backend.includes("START_PASSWORD = 'nexowatt'")) fail('starter password missing');
const htmls = [];
for (const rel of ['adminWww/index.html','src-admin/index.html','src-admin/public/index.html']) { const f=path.join(root,rel); if(fs.existsSync(f)) htmls.push(fs.readFileSync(f,'utf8')); }
if (!htmls.some(s=>s.includes('NEXOWATT_STABLE_LOGIN_V94'))) fail('login layout guard missing');
if (!htmls.some(s=>s.includes('min-height: 545px'))) fail('larger login card missing');
if (!htmls.some(s=>s.includes('EOS Assist') && s.includes('display'))) fail('assist UI guard missing');
console.log('[NexoWatt EOS stable login] OK');
