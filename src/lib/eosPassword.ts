/**
 * Controller-owned EOS user password update.
 *
 * The native ioBroker user editor addresses accounts with the canonical
 * `system.user.*` id. EOS writes that id first and retries with the short
 * account name for older controller wrappers. A write is accepted only after
 * the controller validates the new credential, or (on older controllers
 * without checkPasswordAsync) after the password hash is visible.
 */
export interface EosPasswordAdapter {
    setPasswordAsync?: (
        user: string,
        password: string,
        options?: { user?: ioBroker.ObjectIDs.User } | null,
    ) => Promise<void>;
    setPassword?: (
        user: string,
        password: string,
        options: { user?: ioBroker.ObjectIDs.User } | null,
        callback: (error?: Error | null) => void,
    ) => void;
    checkPasswordAsync?: (
        user: string,
        password: string,
        options?: { user?: ioBroker.ObjectIDs.User } | null,
    ) => Promise<boolean | [boolean, string]>;
    getForeignObjectAsync?: (id: string) => Promise<ioBroker.Object | null | undefined>;
}

export interface EosPasswordTarget {
    userId: `system.user.${string}`;
    userName: string;
    apiTarget: string;
}

export function normalizeEosPasswordTarget(value: string): Omit<EosPasswordTarget, 'apiTarget'> {
    const raw = String(value || '').trim();
    const userId = (raw.startsWith('system.user.') ? raw : `system.user.${raw}`) as `system.user.${string}`;
    const userName = userId.replace(/^system\.user\./, '').trim();
    if (!userName || userName.includes('.') || !/^system\.user\.[^.]+$/.test(userId)) {
        throw new Error('invalidPasswordTarget');
    }
    return { userId, userName };
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const accepted = (result: unknown): boolean => result === true || (Array.isArray(result) && result[0] === true);

async function readPasswordHash(adapter: EosPasswordAdapter, userId: string): Promise<string> {
    if (typeof adapter.getForeignObjectAsync !== 'function') return '';
    try {
        const object = (await adapter.getForeignObjectAsync(userId)) as ioBroker.UserObject | null | undefined;
        return typeof object?.common?.password === 'string' ? object.common.password : '';
    } catch {
        return '';
    }
}

async function callPasswordApi(
    adapter: EosPasswordAdapter,
    target: string,
    password: string,
    serviceUser: ioBroker.ObjectIDs.User,
    withOptions: boolean,
): Promise<void> {
    const options = withOptions ? { user: serviceUser } : null;
    if (typeof adapter.setPasswordAsync === 'function') {
        await adapter.setPasswordAsync(target, password, options);
        return;
    }
    if (typeof adapter.setPassword === 'function') {
        await new Promise<void>((resolve, reject) => {
            adapter.setPassword?.(target, password, options, error => (error ? reject(error) : resolve()));
        });
        return;
    }
    throw new Error('passwordApiUnavailable');
}

async function verifyAfterWrite(
    adapter: EosPasswordAdapter,
    normalized: Omit<EosPasswordTarget, 'apiTarget'>,
    password: string,
    serviceUser: ioBroker.ObjectIDs.User,
): Promise<void> {
    const hasCredentialCheck = typeof adapter.checkPasswordAsync === 'function';
    for (let attempt = 0; attempt < 12; attempt++) {
        if (hasCredentialCheck) {
            for (const candidate of [normalized.userId, normalized.userName]) {
                try {
                    if (accepted(await adapter.checkPasswordAsync?.(candidate, password, { user: serviceUser }))) {
                        return;
                    }
                } catch {
                    // Try the alternative target and allow the controller cache to settle.
                }
            }
        } else if (await readPasswordHash(adapter, normalized.userId)) {
            return;
        }
        if (attempt < 11) await delay(55 + attempt * 35);
    }
    throw new Error(hasCredentialCheck ? 'passwordVerificationFailed' : 'passwordNotPersisted');
}

export async function verifyEosUserPasswordCredential(
    adapter: EosPasswordAdapter,
    target: string,
    password: string,
    serviceUser: ioBroker.ObjectIDs.User = 'system.user.admin',
): Promise<Omit<EosPasswordTarget, 'apiTarget'>> {
    const normalized = normalizeEosPasswordTarget(target);
    await verifyAfterWrite(adapter, normalized, password, serviceUser);
    return normalized;
}

export async function setEosUserPasswordWithVerification(
    adapter: EosPasswordAdapter,
    target: string,
    password: string,
    serviceUser: ioBroker.ObjectIDs.User = 'system.user.admin',
): Promise<EosPasswordTarget> {
    const normalized = normalizeEosPasswordTarget(target);
    const attempts = [
        { apiTarget: normalized.userId, withOptions: true },
        { apiTarget: normalized.userName, withOptions: true },
        { apiTarget: normalized.userId, withOptions: false },
        { apiTarget: normalized.userName, withOptions: false },
    ];
    let lastError: unknown = null;
    for (const attempt of attempts) {
        try {
            await callPasswordApi(adapter, attempt.apiTarget, password, serviceUser, attempt.withOptions);
            await verifyAfterWrite(adapter, normalized, password, serviceUser);
            return { ...normalized, apiTarget: attempt.apiTarget };
        } catch (error) {
            lastError = error;
        }
    }
    if (lastError instanceof Error) throw lastError;
    throw new Error('passwordNotPersisted');
}
