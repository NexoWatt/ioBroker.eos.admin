"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuth2ClientStore = exports.ClientRegistrationError = void 0;
const node_crypto_1 = require("node:crypto");
/**
 * Hosts for which a plain `http:` redirect URI is acceptable. Native apps receive their callback on
 * an ephemeral loopback port (RFC 8252 §7.3), so requiring TLS there would be pointless.
 */
const LOOPBACK_HOSTS = ['127.0.0.1', '::1', '[::1]', 'localhost'];
/** URI schemes that must never be accepted as a redirect target — they execute in the browser. */
const FORBIDDEN_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'];
/** How many clients we keep before the oldest dynamically registered ones are pruned. */
const DEFAULT_MAX_CLIENTS = 100;
/** Error carrying an RFC 7591 §3.2.2 error code, so the registration endpoint can report it verbatim. */
class ClientRegistrationError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ClientRegistrationError';
    }
}
exports.ClientRegistrationError = ClientRegistrationError;
/**
 * Validate a single redirect URI.
 *
 * Accepted are `https:` URIs, `http:` URIs pointing at the loopback interface, and private-use
 * schemes such as `myapp://callback` used by native applications. Fragments are forbidden because
 * the authorization response appends its own query parameters.
 *
 * @param uri The redirect URI to check
 * @returns An error description, or `null` when the URI is acceptable
 */
function checkRedirectUri(uri) {
    if (typeof uri !== 'string' || !uri) {
        return 'redirect_uris must contain non-empty strings';
    }
    let parsed;
    try {
        parsed = new URL(uri);
    }
    catch (_a) {
        return `"${uri}" is not an absolute URI`;
    }
    if (parsed.hash) {
        return `"${uri}" must not contain a fragment`;
    }
    const scheme = parsed.protocol.toLowerCase();
    if (FORBIDDEN_SCHEMES.includes(scheme)) {
        return `"${uri}" uses a forbidden scheme`;
    }
    if (scheme === 'http:') {
        // `URL` keeps IPv6 hosts in brackets, so compare against both spellings.
        if (!LOOPBACK_HOSTS.includes(parsed.hostname.toLowerCase())) {
            return `"${uri}" must use https: — plain http: is only allowed for loopback addresses`;
        }
    }
    return null;
}
/**
 * Persistent store for OAuth2 clients.
 *
 * Clients must survive an adapter restart, so they are kept as ioBroker objects under
 * `<adapter.namespace>.oauth.clients.<client_id>` rather than in the (expiring) session storage.
 * Lookups are cached in memory; the cache is only ever filled from the objects database, so a
 * client registered by another instance is still found after a cache miss.
 */
class OAuth2ClientStore {
    /**
     * @param adapter ioBroker adapter used for object access and logging
     * @param options Options
     * @param options.maxClients Maximum number of stored clients before the oldest dynamic ones are pruned
     */
    constructor(adapter, options) {
        this.cache = new Map();
        this.adapter = adapter;
        this.maxClients = (options === null || options === void 0 ? void 0 : options.maxClients) || DEFAULT_MAX_CLIENTS;
    }
    /** Object ID prefix under which all clients of this instance live. */
    get folder() {
        return `${this.adapter.namespace}.oauth.clients`;
    }
    /**
     * Look up a client by its ID.
     *
     * @param clientId The `client_id` to resolve
     * @returns The stored client, or `null` when it is unknown
     */
    async get(clientId) {
        var _a;
        if (!clientId || !/^[a-zA-Z0-9_-]+$/.test(clientId)) {
            // Reject anything that could escape the object ID namespace before touching the database.
            return null;
        }
        const cached = this.cache.get(clientId);
        if (cached) {
            return cached;
        }
        const obj = await this.adapter.getForeignObjectAsync(`${this.folder}.${clientId}`);
        const client = (_a = obj === null || obj === void 0 ? void 0 : obj.native) === null || _a === void 0 ? void 0 : _a.client;
        if (!client) {
            return null;
        }
        this.cache.set(clientId, client);
        return client;
    }
    /** List all stored clients, oldest registration first. */
    async list() {
        var _a, _b;
        // Query by ID range instead of by object view: the range query does not depend on a view for
        // the `config` object type existing in the objects database.
        const res = await this.adapter.getObjectListAsync({
            startkey: `${this.folder}.`,
            endkey: `${this.folder}.香`,
        });
        const clients = [];
        for (const row of (res === null || res === void 0 ? void 0 : res.rows) || []) {
            const client = (_b = (_a = row.value) === null || _a === void 0 ? void 0 : _a.native) === null || _b === void 0 ? void 0 : _b.client;
            if (client === null || client === void 0 ? void 0 : client.client_id) {
                clients.push(client);
            }
        }
        return clients.sort((a, b) => a.client_id_issued_at - b.client_id_issued_at);
    }
    /**
     * Register a new client from the metadata a client sent to the registration endpoint.
     *
     * The parameter is deliberately typed as partial: it carries unvalidated data straight off the
     * network, and every field is checked here before anything is stored.
     *
     * @param metadata Client metadata (RFC 7591 §2)
     * @param options Options
     * @param options.dynamic Whether this registration came in via the dynamic registration endpoint
     * @returns The stored client, including the generated `client_id`
     * @throws ClientRegistrationError when the metadata is not acceptable
     */
    async register(metadata, options) {
        var _a, _b;
        const redirectUris = metadata === null || metadata === void 0 ? void 0 : metadata.redirect_uris;
        if (!Array.isArray(redirectUris) || !redirectUris.length) {
            throw new ClientRegistrationError('invalid_redirect_uri', 'redirect_uris must be a non-empty array');
        }
        if (redirectUris.length > 10) {
            throw new ClientRegistrationError('invalid_redirect_uri', 'redirect_uris must not contain more than 10 entries');
        }
        for (const uri of redirectUris) {
            const error = checkRedirectUri(uri);
            if (error) {
                throw new ClientRegistrationError('invalid_redirect_uri', error);
            }
        }
        // We are a public-client-only authorization server: PKCE replaces the client secret, so any
        // other authentication method would be a promise we do not keep.
        const authMethod = metadata.token_endpoint_auth_method || 'none';
        if (authMethod !== 'none') {
            throw new ClientRegistrationError('invalid_client_metadata', `token_endpoint_auth_method "${authMethod}" is not supported, only "none" (public client with PKCE)`);
        }
        const grantTypes = ((_a = metadata.grant_types) === null || _a === void 0 ? void 0 : _a.length)
            ? metadata.grant_types
            : ['authorization_code', 'refresh_token'];
        const unsupported = grantTypes.filter(g => g !== 'authorization_code' && g !== 'refresh_token');
        if (unsupported.length) {
            throw new ClientRegistrationError('invalid_client_metadata', `unsupported grant_types: ${unsupported.join(', ')}`);
        }
        const responseTypes = ((_b = metadata.response_types) === null || _b === void 0 ? void 0 : _b.length) ? metadata.response_types : ['code'];
        if (responseTypes.some(t => t !== 'code')) {
            throw new ClientRegistrationError('invalid_client_metadata', 'only the "code" response type is supported');
        }
        const client = {
            client_id: (0, node_crypto_1.randomBytes)(16).toString('hex'),
            client_id_issued_at: Math.floor(Date.now() / 1000),
            client_name: typeof metadata.client_name === 'string' ? metadata.client_name.slice(0, 200) : undefined,
            redirect_uris: redirectUris,
            grant_types: grantTypes,
            response_types: responseTypes,
            token_endpoint_auth_method: 'none',
            scope: typeof metadata.scope === 'string' ? metadata.scope.slice(0, 500) : undefined,
            client_uri: typeof metadata.client_uri === 'string' ? metadata.client_uri : undefined,
            logo_uri: typeof metadata.logo_uri === 'string' ? metadata.logo_uri : undefined,
            software_id: typeof metadata.software_id === 'string' ? metadata.software_id : undefined,
            software_version: typeof metadata.software_version === 'string' ? metadata.software_version : undefined,
            dynamic: (options === null || options === void 0 ? void 0 : options.dynamic) !== false,
        };
        await this.adapter.setForeignObjectAsync(`${this.folder}.${client.client_id}`, {
            type: 'config',
            common: {
                name: client.client_name || client.client_id,
            },
            native: { client },
        });
        this.cache.set(client.client_id, client);
        await this.prune();
        return client;
    }
    /**
     * Remove a client. Already issued access tokens stay valid until they expire.
     *
     * @param clientId The `client_id` to remove
     */
    async delete(clientId) {
        if (!clientId || !/^[a-zA-Z0-9_-]+$/.test(clientId)) {
            return;
        }
        this.cache.delete(clientId);
        try {
            await this.adapter.delForeignObjectAsync(`${this.folder}.${clientId}`);
        }
        catch (e) {
            this.adapter.log.warn(`Cannot delete OAuth2 client "${clientId}": ${e.message}`);
        }
    }
    /**
     * Drop the oldest dynamically registered clients once the store grew past its limit. Without this
     * every re-added connector would leave a record behind forever. Clients registered by hand are
     * never pruned.
     */
    async prune() {
        const clients = await this.list();
        if (clients.length <= this.maxClients) {
            return;
        }
        const removable = clients.filter(c => c.dynamic);
        const excess = clients.length - this.maxClients;
        for (const client of removable.slice(0, excess)) {
            this.adapter.log.warn(`Removing oldest dynamically registered OAuth2 client "${client.client_name || client.client_id}" — the limit of ${this.maxClients} clients was reached`);
            await this.delete(client.client_id);
        }
    }
}
exports.OAuth2ClientStore = OAuth2ClientStore;
//# sourceMappingURL=oauth2-clients.js.map