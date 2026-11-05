/** Same-origin EOS licensing API. Never persists or returns the activation code. */
export interface EosLicenseStatus {
    valid: boolean;
    code: string;
    uuid: string | null;
    edition: 'home' | 'pro' | null;
    expiresAt: number | null;
    limits: { chargePoints?: number; batteries?: number };
    features: string[];
}

const MAX_RESPONSE_BYTES = 65536;
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function parseLicenseStatus(value: unknown): EosLicenseStatus {
    if (
        !isRecord(value) ||
        value.v !== 1 ||
        typeof value.valid !== 'boolean' ||
        typeof value.code !== 'string' ||
        !/^[A-Z][A-Z0-9_]{0,79}$/.test(value.code) ||
        !(
            value.uuid === null ||
            (typeof value.uuid === 'string' &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.uuid))
        ) ||
        ![null, 'home', 'pro'].includes(value.edition as string | null) ||
        !(
            value.expiresAt === null ||
            (typeof value.expiresAt === 'number' &&
                Number.isSafeInteger(value.expiresAt) &&
                value.expiresAt > 0 &&
                value.expiresAt <= 8640000000000000)
        ) ||
        !isRecord(value.limits) ||
        !Array.isArray(value.features) ||
        value.features.length > 64 ||
        !value.features.every(item => typeof item === 'string' && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(item))
    ) {
        throw new Error('LICENSE_RESPONSE');
    }
    if (
        value.valid &&
        (value.code !== 'LICENSE_VALID' ||
            !value.uuid ||
            !value.edition ||
            !isCount(value.limits.chargePoints) ||
            !isCount(value.limits.batteries))
    ) {
        throw new Error('LICENSE_RESPONSE');
    }
    // Copy only the public fields. Even unexpected response fields never enter UI state.
    return {
        valid: value.valid,
        code: value.code,
        uuid: value.uuid,
        edition: value.edition === 'home' || value.edition === 'pro' ? value.edition : null,
        expiresAt: value.expiresAt,
        limits: value.valid
            ? { chargePoints: value.limits.chargePoints as number, batteries: value.limits.batteries as number }
            : {},
        features: value.valid ? value.features : [],
    };
}

async function readJson(response: Response): Promise<unknown> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('LICENSE_RESPONSE');
    }
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) {
                break;
            }
            length += chunk.value.byteLength;
            if (length > MAX_RESPONSE_BYTES) {
                throw new Error('LICENSE_RESPONSE');
            }
            chunks.push(chunk.value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}

export function licenseEndpoint(action: 'status' | 'activate' | 'remove', pageUrl?: string): string {
    const path = `nexowatt/license/${action}`;
    return pageUrl ? new URL(path, pageUrl).href : path;
}

export async function requestLicense(
    action: 'status' | 'activate' | 'remove',
    signal: AbortSignal,
    token?: string,
): Promise<EosLicenseStatus> {
    if (action !== 'status' && action !== 'activate' && action !== 'remove') {
        throw new Error('LICENSE_REQUEST');
    }
    if (action === 'activate' && (typeof token !== 'string' || !token.trim() || token.length > 16384)) {
        throw new Error('LICENSE_FORMAT');
    }
    if (signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
    }
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
        controller.abort();
    }
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const write = action !== 'status';
        const response = await fetch(licenseEndpoint(action, globalThis.location?.href), {
            method: write ? 'POST' : 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            signal: controller.signal,
            headers: write
                ? { Accept: 'application/json', 'Content-Type': 'application/json', 'X-EOS-License': '1' }
                : { Accept: 'application/json' },
            ...(write ? { body: JSON.stringify(action === 'activate' ? { token: token?.trim() } : {}) } : {}),
        });
        const data = await readJson(response);
        if (!response.ok) {
            const code =
                isRecord(data) && typeof data.error === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(data.error)
                    ? data.error
                    : 'SERVICE_UNAVAILABLE';
            throw new Error(code);
        }
        const status = parseLicenseStatus(data);
        if ((action === 'activate' && !status.valid) || (action === 'remove' && status.valid)) {
            throw new Error('LICENSE_RESPONSE');
        }
        return status;
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', onAbort);
    }
}
