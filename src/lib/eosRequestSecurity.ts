/** Origin check for EOS writes. Proxy deployments must preserve Host and TLS scheme. */
export function hasEosUrlCredentials(query: Record<string, unknown> | undefined): boolean {
    if (!query || typeof query !== 'object') return false;
    // Block these before upstream OAuth can turn URL parameters into an identity.
    // User names alone remain usable as non-secret account selectors.
    return Object.keys(query).some(key => /^(?:token|access_token|refresh_token|pass|password|ssoLoginResponse)$/i.test(key));
}

export function safeEosLoginPrefix(requestUrl: string): string | null {
    try {
        // URLSearchParams decodes once. Never interpret another layer of escaping.
        const origin = new URL(requestUrl, 'http://127.0.0.1').searchParams.get('origin') || '';
        if (!/^\/[A-Za-z0-9_./-]*$/.test(origin) || origin.startsWith('//')
            || origin.split('/').some(part => part === '.' || part === '..')
            || /(?:login|logout|404)/i.test(origin)) return null;
        const prefix = origin.slice(0, origin.lastIndexOf('/'));
        return prefix && prefix !== '/' ? prefix.replace(/\/+$/, '') : null;
    } catch { return null; }
}

export function isEosSameOriginRequest(headers: Record<string, unknown>, protocol?: string): boolean {
    const origin = typeof headers.origin === 'string' ? headers.origin.trim() : '';
    if (!origin) {
        // Explicit bearer clients have no ambient cookie authority. Browsers must send Origin.
        return !headers.cookie && typeof headers.authorization === 'string'
            && /^Bearer [^\s]+$/.test(headers.authorization);
    }
    try {
        const parsed = new URL(origin);
        const host = typeof headers.host === 'string' ? headers.host.trim().toLowerCase() : '';
        if (!host || parsed.origin !== origin || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
            || (protocol && parsed.protocol !== protocol) || parsed.host.toLowerCase() !== host) return false;
        // X-Forwarded-Host is deliberately not trusted from arbitrary clients.
        const fetchSite = String(headers['sec-fetch-site'] || '').trim().toLowerCase();
        return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
    } catch {
        return false;
    }
}
