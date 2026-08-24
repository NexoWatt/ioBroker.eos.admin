"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEosSameOriginRequest = isEosSameOriginRequest;
/** Testable same-origin guard for EOS JSON write routes. */
function isEosSameOriginRequest(headers) {
    const origin = String(headers.origin || '').trim();
    if (!origin) {
        // Older embedded browsers can omit Origin for same-site POST requests.
        return true;
    }
    try {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }
        const allowedHosts = new Set();
        const addHost = (value) => {
            const host = String(value || '').split(',')[0].trim().toLowerCase();
            if (host)
                allowedHosts.add(host);
        };
        addHost(headers.host);
        addHost(headers['x-forwarded-host']);
        if (!allowedHosts.size || !allowedHosts.has(parsed.host.toLowerCase())) {
            return false;
        }
        const fetchSite = String(headers['sec-fetch-site'] || '').trim().toLowerCase();
        return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none';
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=eosRequestSecurity.js.map