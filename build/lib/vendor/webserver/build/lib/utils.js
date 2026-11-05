"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthTokenToResponse = oauthTokenToResponse;
exports.getBaseUrl = getBaseUrl;
exports.readRequestBody = readRequestBody;
/** Upper bound for a request body we parse ourselves. */
const MAX_BODY_SIZE = 64 * 1024;
/**
 * Convert oauth2 token to JSON response
 *
 * @param token the created OAuth token
 */
function oauthTokenToResponse(token) {
    return {
        access_token: token.accessToken,
        token_type: 'Bearer',
        expires_in: token.accessTokenExpiresAt
            ? Math.floor((token.accessTokenExpiresAt.getTime() - Date.now()) / 1000)
            : 0,
        refresh_token: token.refreshToken,
        refresh_token_expires_in: token.refreshTokenExpiresAt
            ? Math.floor((token.refreshTokenExpiresAt.getTime() - Date.now()) / 1000)
            : 0,
    };
}
/**
 * Determine the externally reachable base URL, without a trailing slash. Behind a reverse proxy the
 * request-derived value is wrong (`http:` instead of `https:`, internal host) unless the host app
 * enabled `trust proxy`, which is why it can be configured.
 *
 * @param req The incoming request
 * @param baseUrl The configured base URL, or a function that derives it from the request
 */
function getBaseUrl(req, baseUrl) {
    const configured = typeof baseUrl === 'function' ? baseUrl(req) : baseUrl;
    if (configured) {
        return configured.replace(/\/+$/, '');
    }
    return `${req.protocol}://${req.get('host') || 'localhost'}`;
}
/**
 * Read and parse a request body without depending on a body parser being installed.
 *
 * Adapters differ in whether they install `body-parser` globally, so an already parsed body is used
 * when there is one, and the stream is read directly otherwise. Supports `application/json` and
 * `application/x-www-form-urlencoded`.
 *
 * @param req The incoming request
 * @returns The parsed body; an empty object when there is none
 */
async function readRequestBody(req) {
    const existing = req.body;
    if (Buffer.isBuffer(existing)) {
        return parseBody(existing.toString('utf8'), req.headers['content-type']);
    }
    if (typeof existing === 'string') {
        return parseBody(existing, req.headers['content-type']);
    }
    if (existing && typeof existing === 'object' && Object.keys(existing).length) {
        return existing;
    }
    if (req.readableEnded) {
        // A body parser already consumed the stream — an empty result is the real result.
        return existing || {};
    }
    const raw = await new Promise((resolve, reject) => {
        let data = '';
        let size = 0;
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            size += Buffer.byteLength(chunk, 'utf8');
            if (size > MAX_BODY_SIZE) {
                reject(new Error('Request body too large'));
                req.destroy();
                return;
            }
            data += chunk;
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
    return parseBody(raw, req.headers['content-type']);
}
/**
 * Parse a raw request body according to its content type.
 *
 * @param raw The raw body text
 * @param contentType The `Content-Type` header value
 */
function parseBody(raw, contentType) {
    if (!raw) {
        return {};
    }
    const type = (contentType || '').split(';')[0].trim().toLowerCase();
    if (type === 'application/json') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        }
        catch (_a) {
            return {};
        }
    }
    const result = {};
    for (const [key, value] of new URLSearchParams(raw).entries()) {
        result[key] = value;
    }
    return result;
}
//# sourceMappingURL=utils.js.map