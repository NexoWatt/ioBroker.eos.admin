"use strict";

/**
 * NexoWatt EOS role security boundary.
 *
 * This module intentionally uses only Node.js core APIs so the prebuilt
 * repository can be packed and published without a local node_modules folder.
 */
const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

let adapterRef = null;
let installed = false;
let backupCache = { value: false, expires: 0 };

const ADMIN_NAMES = new Set(["admin", "administrator", "system.user.admin"]);
const INSTALLER_TOKENS = ["installer", "installateur", "inbetriebnahme"];
const CUSTOMER_TOKENS = ["user", "guest", "gast", "endkunde", "customer", "smarthome"];

const ADMIN_ONLY_PATHS = [
  /(?:^|[\\/#?&_.-])app[\\s_.-]*center(?:$|[\\/#?&_.-])/i,
  /(?:^|[\\/#?&_.-])lizenz(?:en)?(?:$|[\\/#?&_.-])/i,
  /(?:^|[\\/#?&_.-])licen[cs]e(?:s)?(?:$|[\\/#?&_.-])/i,
  /(?:^|[\\/#?&_.-])simulation(?:$|[\\/#?&_.-])/i,
  /(?:^|[\\/#?&_.-])simulator(?:$|[\\/#?&_.-])/i,
  /(?:^|[\\/#?&_.-])experten?(?:modus)?(?:$|[\\/#?&_.-])/i,
  /(?:^|[\\/#?&_.-])expert(?:mode)?(?:$|[\\/#?&_.-])/i,
  /(?:^|[\\/#?&_.-])xterm(?:$|[\\/#?&_.-])/i,
];

const RIGHTS_PATHS = [
  /(?:^|[\\/#?&_.-])users?(?:$|[\\/#?&_.-])/i,
  /(?:^|[\\/#?&_.-])groups?(?:$|[\\/#?&_.-])/i,
  /zug[aä]nge/i,
  /rechte/i,
  /permissions?/i,
  /password/i,
  /passwort/i,
];

function normalize(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (typeof value.name === "string") return value.name.trim().toLowerCase();
    if (typeof value.user === "string") return value.user.trim().toLowerCase();
    return "";
  }
  return String(value).trim().toLowerCase();
}

function classifyRole(value) {
  const text = normalize(value);
  if (!text) return "unknown";
  if (ADMIN_NAMES.has(text) || /(?:^|[.:/_-])admin(?:istrator)?(?:$|[.:/_-])/.test(text)) return "admin";
  if (INSTALLER_TOKENS.some(token => text.includes(token))) return "installer";
  if (CUSTOMER_TOKENS.some(token => text === token || text.includes(token))) return "customer";
  return "unknown";
}

function parseBasicUser(header) {
  if (!header || !/^basic\s+/i.test(header)) return "";
  try {
    const decoded = Buffer.from(header.replace(/^basic\s+/i, ""), "base64").toString("utf8");
    return decoded.split(":", 1)[0] || "";
  } catch {
    return "";
  }
}

function parseCookieHeader(header) {
  const out = Object.create(null);
  String(header || "").split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx <= 0) return;
    const key = part.slice(0, idx).trim();
    let value = part.slice(idx + 1).trim();
    try { value = decodeURIComponent(value); } catch { /* ignore */ }
    out[key] = value;
  });
  return out;
}

function extractIdentity(req) {
  const candidates = [];
  if (req) {
    candidates.push(req.user, req.username, req.auth && req.auth.user, req.session && req.session.user,
      req.session && req.session.username, req.session && req.session.passport && req.session.passport.user,
      req.ioBrokerUser, req._user);
    const headers = req.headers || {};
    candidates.push(headers["x-iobroker-user"], headers["x-eos-user"], headers["x-authenticated-user"],
      headers["x-forwarded-user"], parseBasicUser(headers.authorization));
    const cookies = parseCookieHeader(headers.cookie);
    for (const key of ["iobroker.user", "iobroker_user", "eos.user", "eosUser", "user", "username", "authUser"]) {
      candidates.push(cookies[key]);
    }
    try {
      const parsed = new URL(req.url || "/", "http://127.0.0.1");
      candidates.push(parsed.searchParams.get("user"), parsed.searchParams.get("username"));
    } catch { /* ignore */ }
  }
  for (const value of candidates) {
    if (normalize(value)) return normalize(value);
  }
  return "";
}

function roleFromRequest(req) {
  const explicitRole = normalize(req && req.headers && (req.headers["x-eos-role"] || req.headers["x-nexowatt-role"]));
  const role = classifyRole(explicitRole);
  if (role !== "unknown") return role;
  return classifyRole(extractIdentity(req));
}

function isAdminOnlyPath(rawUrl) {
  const value = String(rawUrl || "");
  return ADMIN_ONLY_PATHS.some(pattern => pattern.test(value));
}

function isRightsPath(rawUrl) {
  const value = String(rawUrl || "");
  return RIGHTS_PATHS.some(pattern => pattern.test(value));
}

function isStateWriteRequest(req) {
  const method = String(req && req.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;
  const value = String(req && req.url || "");
  return /(?:setstate|write|objects?\/|states?\/|sendto|command)/i.test(value);
}

function deny(res, message, statusCode = 403) {
  if (!res || res.headersSent || res.writableEnded) return true;
  const accepts = String((res.req && res.req.headers && res.req.headers.accept) || "");
  const json = accepts.includes("application/json") || String(res.req && res.req.url || "").includes("/api/");
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (json) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "forbidden", message }));
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="de"><meta charset="utf-8"><title>Zugriff gesperrt</title><style>body{margin:0;background:#031724;color:#eaf6ff;font:16px Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:620px;padding:32px;border:1px solid #0dbb87;border-radius:18px;background:#071f2f}h1{margin-top:0;color:#24e6ad}</style><div class="box"><h1>Zugriff gesperrt</h1><p>${message}</p></div></html>`);
  }
  return true;
}

async function getBackupActive() {
  const now = Date.now();
  if (backupCache.expires > now) return backupCache.value;
  let active = false;
  const adapter = adapterRef;
  if (adapter) {
    try {
      let rows = [];
      if (typeof adapter.getObjectViewAsync === "function") {
        const result = await adapter.getObjectViewAsync("system", "instance", { startkey: "system.adapter.", endkey: "system.adapter.\u9999" });
        rows = result && Array.isArray(result.rows) ? result.rows : [];
      } else if (typeof adapter.getObjectListAsync === "function") {
        const result = await adapter.getObjectListAsync({ startkey: "system.adapter.", endkey: "system.adapter.\u9999" });
        rows = result && Array.isArray(result.rows) ? result.rows : [];
      }
      active = rows.some(row => {
        const obj = row && (row.value || row.doc);
        const id = normalize(row && row.id || obj && obj._id);
        return /system\.adapter\.(?:backitup|backup|nexowatt-backup|eos-backup)\./.test(id) && Boolean(obj && obj.common && obj.common.enabled);
      });
    } catch (error) {
      if (adapter && adapter.log && typeof adapter.log.debug === "function") {
        adapter.log.debug(`[role-security] Backup status could not be read: ${error && error.message || error}`);
      }
    }
  }
  backupCache = { value: active, expires: now + 5000 };
  return active;
}

function attachAdapter(adapter) {
  adapterRef = adapter || null;
  backupCache.expires = 0;
}

function cloneAclSection(section) {
  return section && typeof section === "object" ? { ...section } : {};
}

async function enforceRoleAcls(adapter = adapterRef) {
  if (!adapter || typeof adapter.getForeignObjectAsync !== "function" || typeof adapter.setForeignObjectAsync !== "function") return;
  const ids = ["system.group.endkunde"];
  for (const id of ids) {
    try {
      const obj = await adapter.getForeignObjectAsync(id);
      if (!obj || !obj.common) continue;
      const acl = obj.common.acl && typeof obj.common.acl === "object" ? { ...obj.common.acl } : {};
      const objectAcl = cloneAclSection(acl.object);
      const stateAcl = cloneAclSection(acl.state);
      const usersAcl = cloneAclSection(acl.users);
      const fileAcl = cloneAclSection(acl.file);
      const otherAcl = cloneAclSection(acl.other);
      const before = JSON.stringify({ objectAcl, stateAcl, usersAcl, fileAcl, otherAcl });
      Object.assign(objectAcl, { list: true, read: true, write: false, delete: false });
      Object.assign(stateAcl, { list: true, read: true, write: false, delete: false, create: false });
      Object.assign(usersAcl, { write: false, delete: false, create: false });
      Object.assign(fileAcl, { list: true, read: true, write: false, delete: false, create: false });
      Object.assign(otherAcl, { execute: false, sendto: false });
      acl.object = objectAcl;
      acl.state = stateAcl;
      acl.users = usersAcl;
      acl.file = fileAcl;
      acl.other = otherAcl;
      const after = JSON.stringify({ objectAcl, stateAcl, usersAcl, fileAcl, otherAcl });
      if (before !== after) {
        obj.common.acl = acl;
        await adapter.setForeignObjectAsync(id, obj);
        if (adapter.log && typeof adapter.log.info === "function") {
          adapter.log.info("[role-security] End customer group enforced as read-only for objects and states");
        }
      }
    } catch (error) {
      if (adapter.log && typeof adapter.log.warn === "function") {
        adapter.log.warn(`[role-security] ACL enforcement failed for ${id}: ${error && error.message || error}`);
      }
    }
  }
}

async function handleStatus(req, res) {
  const role = roleFromRequest(req);
  const backupActive = await getBackupActive();
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify({
    ok: true,
    role,
    user: extractIdentity(req) || null,
    backupActive,
    capabilities: {
      appCenter: role === "admin",
      license: role === "admin",
      simulation: role === "admin",
      expertMode: role === "admin",
      accessRights: role === "admin",
      xterm: role === "admin",
      ioBrokerAdmin: role === "admin",
      writeDatapoints: role === "admin" || role === "installer",
      readDatapoints: true,
    },
  }));
}

function wrapListener(listener) {
  if (typeof listener !== "function") return listener;
  return function guardedListener(req, res) {
    try {
      const url = String(req && req.url || "/");
      if (/^\/api\/nexowatt-eos\/security\/(?:status|me)(?:[/?#]|$)/i.test(url)) {
        void handleStatus(req, res);
        return;
      }
      const role = roleFromRequest(req);
      if (role !== "unknown" && role !== "admin" && (isAdminOnlyPath(url) || isRightsPath(url))) {
        deny(res, "Diese Funktion ist ausschließlich für Administratoren freigegeben.");
        return;
      }
      if (role === "customer" && isStateWriteRequest(req)) {
        deny(res, "Endkunden besitzen für Datenpunkte ausschließlich Leserechte.");
        return;
      }
    } catch {
      // Fail closed only for positively identified restricted users. Other
      // requests continue to the existing server so startup is never blocked.
    }
    return listener.apply(this, arguments);
  };
}

function patchCreateServer(module) {
  const original = module.createServer;
  if (typeof original !== "function" || original.__nexowattRoleSecurity) return;
  function secureCreateServer(...args) {
    if (typeof args[0] === "function") args[0] = wrapListener(args[0]);
    else if (typeof args[1] === "function") args[1] = wrapListener(args[1]);
    return original.apply(this, args);
  }
  Object.defineProperty(secureCreateServer, "__nexowattRoleSecurity", { value: true });
  module.createServer = secureCreateServer;
}

function installHttpGuard() {
  if (installed) return;
  installed = true;
  patchCreateServer(http);
  patchCreateServer(https);
}

module.exports = {
  attachAdapter,
  classifyRole,
  enforceRoleAcls,
  extractIdentity,
  getBackupActive,
  installHttpGuard,
  isAdminOnlyPath,
  isRightsPath,
  roleFromRequest,
  wrapListener,
};
