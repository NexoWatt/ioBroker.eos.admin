'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const file = process.env.EOS_AUDIT_BASELINE_MAIN || path.join(__dirname, 'admin/build/main.js');
const source = fs.readFileSync(file, 'utf8');
const start = source.indexOf('  async registerNewsNotifications(messages, lastMessageId) {');
const end = source.indexOf('\n  /**', start);
assert.ok(start > 0 && end > start);
const sandbox = { _nodeOs: { platform: () => 'linux' }, process: { version: 'v24.22.1' } };
const method = vm.runInNewContext('({' + source.slice(start, end) + '}).registerNewsNotifications', sandbox);
const adapter = {
  getObjectViewAsync: async () => ({ rows: [] }),
  getForeignObjectAsync: async () => null,
  getObjectListAsync: async () => ({ rows: [{}, {}] }),
  getNpmVersion: async () => '11.9.0', log: { info() {} },
  registerNotification: async () => {},
};
(async () => {
  await method.call(adapter, [{ id: 'audit-only', class: 'info', title: { en: 'test' }, content: { en: 'test' },
    'number-of-objects': '; globalThis.eosAuditMarker = "executed"; true' }]);
  assert.equal(sandbox.eosAuditMarker, 'executed');
  console.log(JSON.stringify({ utc: new Date().toISOString(), node: process.version,
    sha256: crypto.createHash('sha256').update(source).digest('hex'),
    result: 'CONFIRMED: actual shipped method executes harmless feed marker',
    limits: 'Isolated original method; DB mocked; no live server, filesystem payload or external request' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
