"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEosPasswordTarget = normalizeEosPasswordTarget;
exports.setEosUserPasswordWithVerification = setEosUserPasswordWithVerification;
exports.verifyEosUserPasswordCredential = verifyEosUserPasswordCredential;
function normalizeEosPasswordTarget(value) {
    const raw = String(value || '').trim();
    const userId = raw.startsWith('system.user.') ? raw : `system.user.${raw}`;
    const userName = userId.replace(/^system\.user\./, '').trim();
    if (!userName || userName.includes('.') || !/^system\.user\.[^.]+$/.test(userId)) throw new Error('invalidPasswordTarget');
    return { userId, userName };
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const accepted = result => result === true || (Array.isArray(result) && result[0] === true);
async function readPasswordHash(adapter, userId) {
    if (typeof adapter.getForeignObjectAsync !== 'function') return '';
    try {
        const object = await adapter.getForeignObjectAsync(userId);
        return typeof object?.common?.password === 'string' ? object.common.password : '';
    }
    catch { return ''; }
}
async function callPasswordApi(adapter, target, password, serviceUser, withOptions) {
    const options = withOptions ? { user: serviceUser } : null;
    if (typeof adapter.setPasswordAsync === 'function') { await adapter.setPasswordAsync(target, password, options); return; }
    if (typeof adapter.setPassword === 'function') {
        await new Promise((resolve, reject) => adapter.setPassword?.(target, password, options, error => error ? reject(error) : resolve()));
        return;
    }
    throw new Error('passwordApiUnavailable');
}
async function verifyAfterWrite(adapter, normalized, password, serviceUser) {
    const hasCredentialCheck = typeof adapter.checkPasswordAsync === 'function';
    for (let attempt = 0; attempt < 12; attempt++) {
        if (hasCredentialCheck) {
            for (const candidate of [normalized.userId, normalized.userName]) {
                try {
                    if (accepted(await adapter.checkPasswordAsync?.(candidate, password, { user: serviceUser }))) return;
                }
                catch { }
            }
        }
        else if (await readPasswordHash(adapter, normalized.userId)) return;
        if (attempt < 11) await delay(55 + attempt * 35);
    }
    throw new Error(hasCredentialCheck ? 'passwordVerificationFailed' : 'passwordNotPersisted');
}
async function verifyEosUserPasswordCredential(adapter, target, password, serviceUser = 'system.user.admin') {
    const normalized = normalizeEosPasswordTarget(target);
    await verifyAfterWrite(adapter, normalized, password, serviceUser);
    return normalized;
}
async function setEosUserPasswordWithVerification(adapter, target, password, serviceUser = 'system.user.admin') {
    const normalized = normalizeEosPasswordTarget(target);
    const attempts = [
        { apiTarget: normalized.userId, withOptions: true },
        { apiTarget: normalized.userName, withOptions: true },
        { apiTarget: normalized.userId, withOptions: false },
        { apiTarget: normalized.userName, withOptions: false },
    ];
    let lastError = null;
    for (const attempt of attempts) {
        try {
            await callPasswordApi(adapter, attempt.apiTarget, password, serviceUser, attempt.withOptions);
            await verifyAfterWrite(adapter, normalized, password, serviceUser);
            return { ...normalized, apiTarget: attempt.apiTarget };
        }
        catch (error) { lastError = error; }
    }
    if (lastError instanceof Error) throw lastError;
    throw new Error('passwordNotPersisted');
}
