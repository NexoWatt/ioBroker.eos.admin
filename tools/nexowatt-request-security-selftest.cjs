#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {isEosSameOriginRequest}=require('../build/lib/eosRequestSecurity.js');
assert.equal(isEosSameOriginRequest({host:'192.168.10.124:8081'}),true);
assert.equal(isEosSameOriginRequest({origin:'http://192.168.10.124:8081',host:'192.168.10.124:8081','sec-fetch-site':'same-origin'}),true);
assert.equal(isEosSameOriginRequest({origin:'https://eos.example.test',host:'proxy:443','x-forwarded-host':'eos.example.test','sec-fetch-site':'same-site'}),true);
assert.equal(isEosSameOriginRequest({origin:'http://192.168.10.125:8081',host:'192.168.10.124:8081','sec-fetch-site':'same-origin'}),false);
assert.equal(isEosSameOriginRequest({origin:'http://192.168.10.124:8081',host:'192.168.10.124:8081','sec-fetch-site':'cross-site'}),false);
assert.equal(isEosSameOriginRequest({origin:'file:///tmp/eos',host:'192.168.10.124:8081'}),false);
console.log('[NexoWatt EOS request security] OK (LAN, proxy and cross-site guard)');
