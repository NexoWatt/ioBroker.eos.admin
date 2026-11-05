'use strict';
// Development-only transport for this restricted build environment. The product
// continues to use its fixed native HTTPS transport. Never copies npm credentials.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const root = path.resolve(__dirname, '../admin');
const { repair, validateMetadata } = require(path.join(root, 'tools/nexowatt-repair-lock-metadata.cjs'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const npmCli = path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
const receipts = [];
const fetchNpm = require('./npm-public-metadata.cjs');
const metadataDir = path.join(__dirname, 'public-metadata');
fs.mkdirSync(metadataDir, { recursive: true });
async function fetchMetadata(expected) {
    const key = hash(`${expected.name}@${expected.version}`);
    const file = path.join(metadataDir, `${key}.json`);
    if (fs.existsSync(file)) {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        validateMetadata(saved.data, expected);
        if (hash(saved.raw) !== saved.receipt.responseSha256) throw new Error('Public metadata receipt mismatch');
        receipts.push({ ...saved.receipt, reusedValidatedReceipt: true });
        return saved.data;
    }
    const started = new Date().toISOString();
    const { data, raw } = await fetchNpm(`${expected.name}@${expected.version}`);
    validateMetadata(data, expected);
    const receipt = { name: expected.name, version: expected.version, requestedAt: started,
        responseSha256: hash(raw), receivedAt: new Date().toISOString(), reusedValidatedReceipt: false };
    fs.writeFileSync(file, JSON.stringify({ data, raw, receipt }, null, 2) + '\n', { flag: 'wx' });
    receipts.push(receipt);
    return data;
}

(async () => {
    const result = await repair({ root, write: true, fetchMetadata,
        progress: (done, total) => console.log(`Validated metadata: ${done}/${total}`) });
    const receipt = {
        status: result.status, utc: new Date().toISOString(), reportPath: result.reportPath,
        environment: { node: process.version, platform: process.platform },
        actualTransport: 'npm CLI 11.9.0 view with official registry, prefer-online, 5-second per-request timeout, retries=0, 4 worker maximum; 9-second process bound including npm startup/configuration; complete valid JSON stdout is consumed then CLI process terminated to avoid environment keep-alive hang; validated public receipts may be reused explicitly',
        productTransportUsed: false, developmentTransportSha256: hash(fs.readFileSync(__filename)), npmStdoutHelperSha256: hash(fs.readFileSync(require.resolve('./npm-public-metadata.cjs'))),
        npmCliSha256: hash(fs.readFileSync(npmCli)),
        scope: 'Exact-version public registry metadata, validated by unchanged product repair. Package byte validation is separately recorded.',
        versionChanges: result.versionChanges, locks: result.locks, requests: receipts,
    };
    fs.writeFileSync(path.join(__dirname, 'registry-repair-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify({ status: result.status, versionChanges: result.versionChanges, requests: receipts.length, locks: result.locks }));
})().catch(error => {
    fs.writeFileSync(path.join(__dirname, 'registry-repair-failure.json'), JSON.stringify({ code: error.code || 'LOCAL_FAILURE', completedRequests: receipts.length, utc: new Date().toISOString() }, null, 2) + '\n');
    console.error(error.code || 'LOCAL_FAILURE'); process.exitCode = 1;
});
