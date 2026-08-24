"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const securityFile = path.join(root, "build", "lib", "eosRoleSecurity.js");
assert.ok(fs.existsSync(securityFile), "build/lib/eosRoleSecurity.js is missing");
const security = require(securityFile);
assert.equal(security.classifyRole("admin"), "admin");
assert.equal(security.classifyRole("Administrator"), "admin");
assert.equal(security.classifyRole("installer"), "installer");
assert.equal(security.classifyRole("Gast / Endkunde"), "customer");
assert.equal(security.isAdminOnlyPath("/#/app-center"), true);
assert.equal(security.isAdminOnlyPath("/license"), true);
assert.equal(security.isAdminOnlyPath("/simulation"), true);
assert.equal(security.isAdminOnlyPath("/cockpit"), false);
assert.equal(security.isRightsPath("/#/users-and-groups"), true);
assert.equal(security.isRightsPath("/cockpit"), false);
const htmlFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "index.html") htmlFiles.push(full);
  }
})(root);
const runtimeHtml = htmlFiles.filter(file => /<script[^>]+(?:assets\/|src=)/i.test(fs.readFileSync(file, "utf8")));
assert.ok(runtimeHtml.length > 0, "No runtime index.html was found");
for (const file of runtimeHtml) {
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /nexowatt-role-security\.js\?v=7104/, `Role guard missing in ${path.relative(root, file)}`);
  assert.ok(fs.existsSync(path.join(path.dirname(file), "nexowatt-role-security.js")), `Client guard missing next to ${path.relative(root, file)}`);
}
const main = fs.readFileSync(path.join(root, "build", "main.js"), "utf8");
assert.match(main, /eosRoleSecurity/);
assert.match(main, /installHttpGuard/);
assert.match(main, /enforceRoleAcls/);
const client = runtimeHtml.length ? fs.readFileSync(path.join(path.dirname(runtimeHtml[0]), "nexowatt-role-security.js"), "utf8") : "";
for (const token of ["app-center", "lizenz", "simulation", "expertenmodus", "xterm", "Nur-Lesezugriff", "backupActive"]) {
  assert.ok(client.toLowerCase().includes(token.toLowerCase()), `Client guard is missing ${token}`);
}
console.log("[NexoWatt EOS role security] OK");
