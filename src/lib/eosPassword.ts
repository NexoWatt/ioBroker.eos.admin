/**
 * Controller-owned EOS user password update.
 *
 * The ioBroker adapter API documents `user` as the user name text. EOS policy
 * code uses canonical object IDs (`system.user.*`), so this helper deliberately
 * separates the two forms: the short name is passed to the password API, while
 * the canonical ID is used to verify the persisted user object.
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
    getForeignObjectAsync: (id: string) => Promise<ioBroker.Object | null | undefined>;
}

export interface EosPasswordTarget {
    userId: `system.user.${string}`;
    userName: string;
}

export function normalizeEosPasswordTarget(value: string): EosPasswordTarget {
    const raw = String(value || '').trim();
    const userId = (raw.startsWith('system.user.') ? raw : `system.user.${raw}`) as `system.user.${string}`;
    const userName = userId.replace(/^system\.user\./, '').trim();
    if (!userName || userName.includes('.') || !/^system\.user\.[^.]+$/.test(userId)) {
        throw new Error('invalidPasswordTarget');
    }
    return { userId, userName };
}

async function callPasswordApi(
    adapter: EosPasswordAdapter,
    userName: string,
    password: string,
    serviceUser: ioBroker.ObjectIDs.User,
): Promise<void> {
    const options = { user: serviceUser };
    if (typeof adapter.setPasswordAsync === 'function') {
        await adapter.setPasswordAsync(userName, password, options);
        return;
    }
    if (typeof adapter.setPassword === 'function') {
        await new Promise<void>((resolve, reject) => {
            adapter.setPassword?.(userName, password, options, error => (error ? reject(error) : resolve()));
        });
        return;
    }
    throw new Error('passwordApiUnavailable');
}

async function waitForPasswordHash(
    adapter: EosPasswordAdapter,
    userId: `system.user.${string}`,
): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt++) {
        const user = (await adapter.getForeignObjectAsync(userId)) as ioBroker.UserObject | null | undefined;
        if (typeof user?.common?.password === 'string' && user.common.password.length > 0) {
            return;
        }
        if (attempt < 5) {
            await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1)));
        }
    }
    throw new Error('passwordNotPersisted');
}

async function verifyCredential(
    adapter: EosPasswordAdapter,
    userName: string,
    password: string,
    serviceUser: ioBroker.ObjectIDs.User,
): Promise<void> {
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

export async function setEosUserPasswordWithVerification(
    adapter: EosPasswordAdapter,
    target: string,
    password: string,
    serviceUser: ioBroker.ObjectIDs.User = 'system.user.admin',
): Promise<EosPasswordTarget> {
    const normalized = normalizeEosPasswordTarget(target);
    await callPasswordApi(adapter, normalized.userName, password, serviceUser);
    await waitForPasswordHash(adapter, normalized.userId);
    await verifyCredential(adapter, normalized.userName, password, serviceUser);
    return normalized;
}
