'use strict';
// Audit probe only. Real verifier/store and fresh in-memory test key; simulated ioBroker DB.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EosLicenseService } = require('../admin/src/lib/eosLicenseService');
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-quota-audit-'));
  const uuid = '12345678-1234-4234-8234-123456789abc';
  const keys = crypto.generateKeyPairSync('ed25519');
  const now = Date.now();
  const claims = {v:2,kid:'audit_test',licenseId:'audit-only',uuid,edition:'home',issuedAt:now-1000,notBefore:now-1000,expiresAt:now+60000,adapters:['nexowatt-test'],limits:{chargePoints:3,batteries:2}};
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const prefix = `NWL2.${encoded}`;
  const token = prefix+'.'+crypto.sign(null,Buffer.from(prefix),keys.privateKey).toString('base64url');
  const adapter = {getForeignObjectAsync: async id => id==='system.meta.uuid'?{native:{uuid}}:{type:'instance',common:{enabled:true,name:'nexowatt-test'}},log:{info(){},warn(){},error(){}}};
  const service = new EosLicenseService(adapter,{directory,publicKeys:{audit_test:keys.publicKey.export({type:'spki',format:'pem'}).toString()}});
  try {
    await service.start();await service.activate(token);
    const grants=[];
    for(const instance of [0,1]) {
      const grant=await service.check(`system.adapter.nexowatt-test.${instance}`,{v:1,nonce:crypto.randomBytes(16).toString('hex'),adapter:'nexowatt-test',feature:'energy',required:{chargePoints:3,batteries:2}});
      assert.equal(grant.valid,true); grants.push({instance,valid:grant.valid,edition:grant.edition,limits:grant.limits});
    }
    console.log(JSON.stringify({result:'CONFIRMED_DESIGN_GAP',scope:'No aggregate quota reservation across instances',grants,totalRequested:{chargePoints:6,batteries:4},signedSystemLimit:claims.limits,limitation:'Simulated object DB, real cryptography/store; no hardware or ioBroker bus'},null,2));
  } finally {service.stop();await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error.name);process.exitCode=1;});
