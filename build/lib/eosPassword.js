"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEosPasswordTarget = normalizeEosPasswordTarget;
exports.setEosUserPasswordWithVerification = setEosUserPasswordWithVerification;
function normalizeEosPasswordTarget(value) {
    const raw = String(value || '').trim();
    const userId = raw.startsWith('system.user.') ? raw : `system.user.${raw}`;
    const userName = userId.replace(/^system\.user\./, '').trim();
    if (!userName || userName.includes('.') || !/^system\.user\.[^.]+$/.test(userId)) {
        throw new Error('invalidPasswordTarget');
    }
    return { userId, userName };
}
async function callPasswordApi(adapter, userName, password, serviceUser) {
    const options = { user: serviceUser };
    if (typeof adapter.setPasswordAsync === 'function') {
        await adapter.setPasswordAsync(userName, password, options);
        return;
    }
    if (typeof adapter.setPassword === 'function') {
        await new Promise((resolve, reject) => {
            adapter.setPassword?.(userName, password, options, error => (error ? reject(error) : resolve()));
        });
        return;
    }
    throw new Error('passwordApiUnavailable');
}
async function waitForPasswordHash(adapter, userId) {
    for (let attempt = 0; attempt < 6; attempt++) {
        const user = await adapter.getForeignObjectAsync(userId);
        if (typeof user?.common?.password === 'string' && user.common.password.length > 0) {
            return;
        }
        if (attempt < 5) {
            await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1)));
        }
    }
    throw new Error('passwordNotPersisted');
}
async function verifyCredential(adapter, userName, password, serviceUser) {
    if (typeof adapter.checkPasswordAsync !== 'function') {
        return;
    }
    for (let attempt = 0; attempt < 5; attempt++) {
        const result = await adapter.checkPasswordAsync(userName, password, { user: serviceUser });
        const accepted = result === true || (Array.isArray(result) && result[0] === true);
        if (accepted) {
            return;
        }
        if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
    }
    throw new Error('passwordVerificationFailed');
}
async function setEosUserPasswordWithVerification(adapter, target, password, serviceUser = 'system.user.admin') {
    const normalized = normalizeEosPasswordTarget(target);
    await callPasswordApi(adapter, normalized.userName, password, serviceUser);
    await waitForPasswordHash(adapter, normalized.userId);
    await verifyCredential(adapter, normalized.userName, password, serviceUser);
    return normalized;
}
