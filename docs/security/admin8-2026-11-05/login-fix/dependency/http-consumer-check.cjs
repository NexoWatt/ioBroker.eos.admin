"use strict";
// Offline HTTP integration probe after the separately documented npm consumer installation.
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
// Accept a consumer path, or retain the historical two-path CLI form.
const consumer = path.resolve(process.argv[3] || process.argv[2]);
const consumerRequire = createRequire(path.join(consumer, 'package.json'));
const eosManifestPath = consumerRequire.resolve('iobroker.eos-admin/package.json');
const eosRequire = createRequire(eosManifestPath);
const eosIdentity = eosRequire('./package.json');
const express = eosRequire('express');
const { EosSessionSecurity } = eosRequire('./build/lib/eosSessionSecurity');
const { createOAuth2Server } = eosRequire('./build/lib/vendor/webserver');
const webRequire = createRequire(eosRequire.resolve('./build/lib/vendor/webserver/package.json'));
const identity = webRequire('oauth2-server/package.json');
assert.equal(identity.name, '@node-oauth/oauth2-server');
assert.equal(identity.version, '5.3.1');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const sessions = new Map();
let passwordHash = 'fixture-hash';
const adapter = {
 config: {}, log: { warn() {} },
 getSession: (id, cb) => cb(clone(sessions.get(id))),
 setSession: (id, ttl, value, cb) => { sessions.set(id, clone(value)); cb(); },
 destroySession: async id => sessions.delete(id),
 getForeignObjectAsync: async () => ({ type: 'user', common: { password: passwordHash, enabled: true }, native: {} }),
 getObjectViewAsync: async () => ({ rows: [{ id: 'administrator', value: { _id: 'system.group.administrator', type: 'group', common: { members: ['system.user.admin'], acl: {} } } }] }),
 checkPassword: (name, password, cb) => cb(name === 'admin' && password === 'fixture-pass', `system.user.${name}`),
};
const security = new EosSessionSecurity(adapter);
const app = express();
app.use(express.urlencoded({ extended: false }));
const model = createOAuth2Server(adapter, { app, secure: true, authorizationCode: false, dynamicClientRegistration: false });
security.bindOAuthModel(model);
app.get('/identity', (req, res) => req.user ? res.json({ user: req.user }) : res.sendStatus(401));
const server = http.createServer(app);
(async () => {
 server.listen(0, '127.0.0.1'); await once(server, 'listening');
 const base = `http://127.0.0.1:${server.address().port}`;
 const post = async body => { const response = await fetch(`${base}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'ioBroker', ...body }), signal: AbortSignal.timeout(5000) }); return { status: response.status, body: await response.json() }; };
 try {
  const bad = await post({ grant_type: 'password', username: 'admin', password: 'invalid' });
  const login = await post({ grant_type: 'password', username: 'admin', password: 'fixture-pass' });
  assert.ok(bad.status >= 400 && bad.status < 500); assert.equal(login.status, 200);
  const access = await fetch(`${base}/identity`, { headers: { authorization: `Bearer ${login.body.access_token}` }, signal: AbortSignal.timeout(5000) });
  const refresh = await post({ grant_type: 'refresh_token', refresh_token: login.body.refresh_token });
  assert.equal(access.status, 200); assert.equal(refresh.status, 200);
  assert.ok([...sessions.values()].every(value => value.nexowattEosSessionV1));
  passwordHash = 'changed-fixture-hash';
  const revokedAccess = await fetch(`${base}/identity`, { headers: { authorization: `Bearer ${refresh.body.access_token}` }, signal: AbortSignal.timeout(5000) });
  const revokedRefresh = await post({ grant_type: 'refresh_token', refresh_token: refresh.body.refresh_token });
  assert.equal(revokedAccess.status, 401); assert.ok(revokedRefresh.status >= 400 && revokedRefresh.status < 500);
  console.log(JSON.stringify({ node: process.version, eosName: eosIdentity.name, eosVersion: eosIdentity.version, oauthName: identity.name, oauthVersion: identity.version, badCredentialStatus: bad.status, loginStatus: login.status, identityStatus: access.status, refreshStatus: refresh.status, allSessionsStamped: true, passwordRevokedAccessStatus: revokedAccess.status, passwordRevokedRefreshStatus: revokedRefresh.status, limitations: 'Actual packaged dependencies and HTTP; controller persistence is simulated.' }, null, 2));
 } finally { security.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
