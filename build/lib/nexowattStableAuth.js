"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNexowattStableAuth = startNexowattStableAuth;
const START_PASSWORD = 'nexowatt';
const MARKER_KEYS = ["eosFirstLoginPending", "eosMustChangePassword", "eosPasswordSetupRequired", "firstLoginRequired", "mustChangePassword", "nexowattFirstLoginPending", "nexowattMustChangePassword", "nexowattPasswordSetupRequired", "passwordChangeRequired"];
const timers = new WeakMap();
function pendingByNative(native) {
    if (!native || typeof native !== 'object') return false;
    return MARKER_KEYS.some(key => native[key] === true || native[key] === 'pending' || native[key] === 'required' || native[key] === 'starter');
}
async function setPassword(adapter, user, password) {
    if (typeof adapter.setPasswordAsync === 'function') return adapter.setPasswordAsync(user, password, { user: 'system.user.admin' });
    return new Promise((resolve, reject) => adapter.setPassword(user, password, { user: 'system.user.admin' }, err => err ? reject(err) : resolve()));
}
async function ensureGroupMembership(adapter, userId, groupId) {
    const group = await adapter.getForeignObjectAsync(groupId);
    if (!group || group.type !== 'group') return;
    group.common = group.common || { name: groupId.split('.').pop(), members: [] };
    group.common.members = Array.isArray(group.common.members) ? group.common.members : [];
    if (!group.common.members.includes(userId)) {
        group.common.members.push(userId);
        await adapter.setForeignObjectAsync(groupId, group, { user: 'system.user.admin' });
    }
}
async function createUser(adapter, name) {
    const id = `system.user.${name}`;
    await adapter.setForeignObjectAsync(id, {
        _id: id, type: 'user',
        common: { name, enabled: true, password: '' },
        native: { nexowattManagedAccount: true, nexowattMustChangePassword: true, nexowattPasswordState: 'starter' }
    }, { user: 'system.user.admin' });
    return adapter.getForeignObjectAsync(id);
}
async function prepareOne(adapter, name, group, createMissing) {
    const id = `system.user.${name}`;
    let obj = await adapter.getForeignObjectAsync(id);
    let created = false;
    if (!obj && createMissing) { obj = await createUser(adapter, name); created = true; }
    if (!obj || obj.type !== 'user') return;
    obj.native = obj.native || {};
    const empty = !obj.common || !obj.common.password;
    const pending = created || empty || pendingByNative(obj.native) || obj.native.nexowattPasswordState === 'starter';
    if (pending) {
        await setPassword(adapter, name, START_PASSWORD);
        obj = await adapter.getForeignObjectAsync(id) || obj;
        obj.native = obj.native || {};
        obj.native.nexowattManagedAccount = true;
        obj.native.nexowattStarterPasswordActive = true;
        obj.native.nexowattMustChangePassword = true;
        obj.native.nexowattPasswordState = 'starter';
        obj.native.nexowattStarterPasswordUpdatedAt = new Date().toISOString();
        for (const key of MARKER_KEYS) {
            if (/required|must|pending|first/i.test(key)) obj.native[key] = true;
        }
        await adapter.setForeignObjectAsync(id, obj, { user: 'system.user.admin' });
    }
    await ensureGroupMembership(adapter, id, group);
}
async function reconcile(adapter) {
    try {
        await prepareOne(adapter, 'installer', 'system.group.installer', true);
        const guest = await adapter.getForeignObjectAsync('system.user.guest');
        const user = await adapter.getForeignObjectAsync('system.user.user');
        if (guest || !user) await prepareOne(adapter, 'guest', 'system.group.endkunden', true);
        if (user) await prepareOne(adapter, 'user', 'system.group.endkunden', false);
    } catch (e) { adapter.log.warn(`[NexoWatt EOS login] Starter-account reconciliation failed: ${e && e.message || e}`); }
}
function startNexowattStableAuth(adapter) {
    if (timers.has(adapter)) return;
    void reconcile(adapter);
    const timer = setInterval(() => void reconcile(adapter), 5000);
    if (timer.unref) timer.unref();
    timers.set(adapter, timer);
}
