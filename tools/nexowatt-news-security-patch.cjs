#!/usr/bin/env node
'use strict';
// Scoped patch of the inherited frontend, not a full frontend build.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { matchesObjectCount } = require('../src/lib/eosNewsSecurity.js');
const root = path.resolve(__dirname, '..');
const oldExpression = 'eval(`${context.noObjects} ${message["number-of-objects"]}`)';
const safeExpression = '(' + matchesObjectCount.toString() + ')(context.noObjects,message["number-of-objects"])';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const files = fs.readdirSync(path.join(root, 'adminWww/assets')).filter(name => /^bootstrap-.*\.js$/.test(name));
const evidence = [];
let safeBundles = 0;
for (const name of files) {
    const relative = 'adminWww/assets/' + name;
    const full = path.join(root, relative);
    const before = fs.readFileSync(full, 'utf8');
    const count = before.split(oldExpression).length - 1;
    if (count > 1) throw new Error('Unexpected repeated legacy expression: ' + relative);
    let after = count ? before.replace(oldExpression, safeExpression) : before;
    if (after.includes(safeExpression)) {
        safeBundles++;
        after = after.replace('showIt&&message["number-of-objects"]&&(showIt=', 'showIt&&message["number-of-objects"]!==undefined&&(showIt=');
    }
    if (/eval\([^\n;]*number-of-objects/.test(after)) throw new Error('Unpatched news evaluator: ' + relative);
    if (after !== before) fs.writeFileSync(full, after);
    evidence.push({ path: relative, beforeSha256: hash(before), afterSha256: hash(after), replacements: count });
}
if (!safeBundles) throw new Error('No reviewed safe news expression found; refusing successful patch status');
console.log(JSON.stringify({ utc: new Date().toISOString(), mode: 'scoped inherited-bundle patch',
    helperSha256: hash(fs.readFileSync(path.join(root, 'src/lib/eosNewsSecurity.js'))), files: evidence }, null, 2));
