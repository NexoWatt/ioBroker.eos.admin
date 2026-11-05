"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOAuth2Server = createOAuth2Server;
const node_crypto_1 = require("node:crypto");
const oauth2_server_1 = __importStar(require("oauth2-server"));
const jsonwebtoken_1 = require("jsonwebtoken");
const jwks_rsa_1 = require("jwks-rsa");
const oauth2_model_1 = require("./oauth2-model");
const oauth2_authcode_1 = require("./oauth2-authcode");
const oauth2_clients_1 = require("./oauth2-clients");
const utils_1 = require("./utils");
/** A login that is not finished within this time is forgotten */
const PENDING_LOGIN_TTL_MS = 10 * 60 * 1000;
/** The page the browser comes back to has to fetch the result within this time */
const HANDOFF_TTL_MS = 60 * 1000;
/**
 * Encode as base64url, the form the OAuth2 and OIDC specifications ask for
 *
 * @param buffer bytes to encode
 */
function base64url(buffer) {
    return buffer.toString('base64url');
}
/**
 * One configured OpenID Connect identity provider.
 *
 * The endpoints are not written into the code but read from the discovery document of the issuer,
 * so every provider that follows the standard works: Keycloak, Authentik, Auth0, Entra ID, ...
 */
class OidcProvider {
    constructor(adapter, config) {
        /** The discovery document is read once and kept. A failed attempt is not cached. */
        this.discovery = null;
        this.jwks = null;
        /** Logins that were started, by the opaque state that the identity provider gets */
        this.pending = new Map();
        /** Finished logins that wait for the browser to fetch them, by their one-time code */
        this.handoffs = new Map();
        this.adapter = adapter;
        this.config = config;
    }
    /** Scopes that are requested */
    get scope() {
        return this.config.scope || 'openid profile email';
    }
    /** True if the client authenticates with its own secret instead of PKCE */
    get isConfidential() {
        return !!this.config.clientSecret;
    }
    /** Read the discovery document of the issuer */
    async getDiscovery() {
        this.discovery || (this.discovery = (async () => {
            const url = `${this.config.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Cannot read "${url}": ${response.status}`);
            }
            const doc = (await response.json());
            if (!doc.issuer || !doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
                throw new Error(`"${url}" is not a valid OpenID Connect discovery document`);
            }
            this.adapter.log.debug(`SSO: using the identity provider "${doc.issuer}"`);
            return doc;
        })().catch((e) => {
            // The provider may have been down for a moment, so the next login tries again
            this.discovery = null;
            throw e;
        }));
        return this.discovery;
    }
    /** Keys of the issuer, used to check the signature of an ID token */
    async getJwks() {
        const discovery = await this.getDiscovery();
        this.jwks || (this.jwks = new jwks_rsa_1.JwksClient({ jwksUri: discovery.jwks_uri, cache: true, rateLimit: true }));
        return this.jwks;
    }
    /**
     * Remember a started login and give back the opaque `state` for the identity provider.
     * Nothing about the login travels through the browser, so none of it can be tampered with.
     *
     * @param login the login that was just started
     */
    createPending(login) {
        const now = Date.now();
        for (const [key, entry] of this.pending) {
            if (entry.expires <= now) {
                this.pending.delete(key);
            }
        }
        const state = base64url((0, node_crypto_1.randomBytes)(24));
        this.pending.set(state, { ...login, expires: now + PENDING_LOGIN_TTL_MS });
        return state;
    }
    /**
     * Take a started login out of the list. Every state works exactly once.
     *
     * @param state the state that came back from the identity provider
     */
    takePending(state) {
        const entry = this.pending.get(state);
        this.pending.delete(state);
        return entry && entry.expires > Date.now() ? entry : undefined;
    }
    /**
     * Keep the result of a finished login and give back a one-time code for it. Only the code
     * travels in the URL, so the tokens end up neither in the browser history nor in proxy logs.
     *
     * @param result tokens of a login, or the ID token of a connected identity
     */
    createHandoff(result) {
        const now = Date.now();
        for (const [key, entry] of this.handoffs) {
            if (entry.expires <= now) {
                this.handoffs.delete(key);
            }
        }
        const code = base64url((0, node_crypto_1.randomBytes)(24));
        this.handoffs.set(code, { result, expires: now + HANDOFF_TTL_MS });
        return code;
    }
    /**
     * Take the result of a finished login out of the list. Every code works exactly once.
     *
     * @param code the code the browser got with the redirect
     */
    takeHandoff(code) {
        const entry = this.handoffs.get(code);
        this.handoffs.delete(code);
        return entry && entry.expires > Date.now() ? entry.result : undefined;
    }
    /**
     * Build the address the browser is sent to for the login
     *
     * @param login the login that was started
     * @param state the opaque state of that login
     */
    async getAuthorizationUrl(login, state) {
        const discovery = await this.getDiscovery();
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            response_type: 'code',
            scope: this.scope,
            redirect_uri: login.redirectUri,
            state,
            nonce: login.nonce,
        });
        if (login.codeVerifier) {
            params.set('code_challenge', base64url((0, node_crypto_1.createHash)('sha256').update(login.codeVerifier).digest()));
            params.set('code_challenge_method', 'S256');
        }
        return `${discovery.authorization_endpoint}${discovery.authorization_endpoint.includes('?') ? '&' : '?'}${params.toString()}`;
    }
    /**
     * Exchange the code of the callback for the tokens
     *
     * @param code the code the identity provider sent to the callback
     * @param login the login this code belongs to
     */
    async exchangeCode(code, login) {
        const discovery = await this.getDiscovery();
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: login.redirectUri,
            client_id: this.config.clientId,
        });
        if (this.config.clientSecret) {
            body.set('client_secret', this.config.clientSecret);
        }
        else if (login.codeVerifier) {
            body.set('code_verifier', login.codeVerifier);
        }
        const response = await fetch(discovery.token_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        if (!response.ok) {
            throw new Error(`Token request to "${discovery.token_endpoint}" failed with status ${response.status}`);
        }
        return (await response.json());
    }
    /**
     * Check the signature and the content of an ID token and give back its claims
     *
     * @param idToken the ID token out of the token answer
     * @param nonce the value that was sent with the authorization request
     */
    async verifyIdToken(idToken, nonce) {
        const discovery = await this.getDiscovery();
        const jwks = await this.getJwks();
        const getKey = (header, callback) => {
            jwks.getSigningKey(header.kid, (err, key) => {
                if (err) {
                    return callback(err);
                }
                if (!key) {
                    return callback(new Error('Key is undefined'));
                }
                callback(null, key.getPublicKey());
            });
        };
        const payload = await new Promise((resolve, reject) => {
            (0, jsonwebtoken_1.verify)(idToken, getKey, {
                algorithms: ['RS256', 'RS384', 'RS512', 'PS256', 'ES256', 'ES384'],
                issuer: discovery.issuer,
                audience: this.config.clientId,
            }, (err, decoded) => {
                if (err) {
                    return reject(new Error(`Token verification failed: ${err.message}`));
                }
                resolve(decoded);
            });
        });
        if (payload.nonce !== nonce) {
            throw new Error('Token verification failed: the nonce does not belong to this login');
        }
        return payload;
    }
}
/**
 * Check if a user belongs to the administrators
 *
 * @param adapter the adapter instance
 * @param user the ioBroker user name without the `system.user.` prefix
 */
async function isAdministrator(adapter, user) {
    var _a, _b;
    // js-controller always gives `admin` all rights, whatever the group says
    if (user === 'admin') {
        return true;
    }
    try {
        const group = await adapter.getForeignObjectAsync('system.group.administrator');
        return !!((_b = (_a = group === null || group === void 0 ? void 0 : group.common) === null || _a === void 0 ? void 0 : _a.members) === null || _b === void 0 ? void 0 : _b.includes(`system.user.${user}`));
    }
    catch (_c) {
        return false;
    }
}
/**
 * Create an OAuth2 server on the given Express app.
 *
 * @param adapter The adapter instance
 * @param options Options
 * @param options.app The Express app
 * @param options.secure Whether the connection is secure (default: false)
 * @param options.accessLifetime Access token expiration in seconds (default: 1 hour)
 * @param options.refreshLifetime Refresh token expiration in seconds (default: 30 days)
 * @param options.noBasicAuth Do not allow basic authentication
 * @param options.loginPage The login page URL (default: empty and someone else will handle the login). It could be a function too
 * @param options.authorizationCode Enable the browser-based authorization code flow with PKCE (default: disabled)
 * @param options.baseUrl Externally reachable base URL, required behind a reverse proxy. Used for the authorization code flow and the single sign-on.
 * @param options.dynamicClientRegistration Let clients register themselves via RFC 7591 (default: enabled with the authorization code flow)
 * @param options.maxClients Maximum number of registered clients before the oldest dynamic ones are pruned
 * @param options.productName Name shown on the login and consent pages (default: "ioBroker")
 * @param options.oidc Identity provider for the single sign-on. Without it, `/sso` does not exist.
 * @param options.ssoHandoff How the result of the single sign-on gets to the page: `url` (default) puts the tokens into the URL
 *   (`?ssoLoginResponse=` or `?id_token=`), `code` puts only a one-time `?ssoCode=` there, which the page exchanges via `POST /sso-token`
 */
function createOAuth2Server(adapter, options) {
    var _a;
    const model = new oauth2_model_1.OAuth2Model(adapter, {
        accessLifetime: options.accessLifetime,
        refreshLifeTime: options.refreshLifetime,
        noBasicAuth: options.noBasicAuth,
    });
    const oauth = new oauth2_server_1.default({
        model,
        requireClientAuthentication: { password: false, refresh_token: false },
    });
    // The authorization code flow is opt-in: it opens a browser-facing login and, unless disabled,
    // an open registration endpoint, so no existing installation should get it by surprise.
    const authCodeFlow = options.authorizationCode
        ? new oauth2_authcode_1.AuthorizationCodeFlow(adapter, {
            app: options.app,
            model,
            clientStore: new oauth2_clients_1.OAuth2ClientStore(adapter, { maxClients: options.maxClients }),
            baseUrl: options.baseUrl,
            dynamicClientRegistration: options.dynamicClientRegistration,
            productName: options.productName,
        })
        : null;
    // Discovery, registration and revocation must stay reachable without credentials, so they are
    // registered before the app-wide `authorize` middleware below.
    authCodeFlow === null || authCodeFlow === void 0 ? void 0 : authCodeFlow.registerPublicRoutes();
    // The single sign-on only exists when an identity provider is configured. Without it, the two
    // routes are not registered at all instead of answering with a half-working login.
    const oidc = ((_a = options.oidc) === null || _a === void 0 ? void 0 : _a.issuer) && options.oidc.clientId ? new OidcProvider(adapter, options.oidc) : null;
    if (oidc) {
        /**
         * Start a login at the identity provider.
         *
         * @param req request with `redirectUrl`, `method` and, for `register`, the ioBroker `user`
         * @param res response that sends the browser to the identity provider
         */
        const handleSsoStart = async (req, res) => {
            var _a, _b;
            const query = req.query;
            // Behind a TLS-terminating proxy `req.protocol` is `http`, which matches neither the
            // redirect URI registered at the identity provider nor the `redirectUrl` of the page
            const baseUrl = (0, utils_1.getBaseUrl)(req, options.baseUrl);
            // The browser is sent to this address after the login, so it has to stay on this server.
            // Without the check, the route would be an open redirect for anybody who can call it.
            let redirectUrl;
            try {
                const target = new URL(query.redirectUrl || `${baseUrl}/`, `${baseUrl}/`);
                if (target.origin !== new URL(baseUrl).origin) {
                    throw new Error('foreign origin');
                }
                redirectUrl = target.href;
            }
            catch (_c) {
                adapter.log.error(`SSO: refused to redirect to "${query.redirectUrl}"`);
                res.status(400).send('Invalid redirectUrl');
                return;
            }
            const method = query.method === 'register' ? 'register' : 'login';
            const user = (_a = query.user) === null || _a === void 0 ? void 0 : _a.replace(/^system\.user\./, '');
            if (method === 'register') {
                if (!user) {
                    adapter.log.error('SSO: a register request without a user');
                    res.status(400).send('Missing user');
                    return;
                }
                // Whoever connects an identity can sign in as this user afterwards, so only the user
                // themselves or an administrator may do it. `req.user` is filled by `model.authorize`.
                const caller = (_b = req.user) === null || _b === void 0 ? void 0 : _b.replace(/^system\.user\./, '');
                if (!caller) {
                    adapter.log.warn(`SSO: refused to connect the user "${user}" without a login`);
                    res.status(401).send('Unauthorized');
                    return;
                }
                if (caller !== user && !(await isAdministrator(adapter, caller))) {
                    adapter.log.warn(`SSO: the user "${caller}" may not connect the user "${user}"`);
                    res.status(403).send('Forbidden');
                    return;
                }
            }
            const login = {
                redirectUrl,
                method,
                user,
                nonce: base64url((0, node_crypto_1.randomBytes)(16)),
                // A public client has no secret, it proves with PKCE that the code belongs to it
                codeVerifier: oidc.isConfidential ? undefined : base64url((0, node_crypto_1.randomBytes)(32)),
                redirectUri: `${baseUrl}/sso-callback`,
                expires: 0,
            };
            const state = oidc.createPending(login);
            try {
                res.redirect(await oidc.getAuthorizationUrl(login, state));
            }
            catch (e) {
                adapter.log.error(`SSO: cannot reach the identity provider: ${e.message}`);
                res.status(502).send('Cannot reach the identity provider');
            }
        };
        /**
         * Take the answer of the identity provider and either sign the user in or connect the
         * identity with an existing ioBroker user.
         *
         * @param req request with the `code` and the `state` of the started login
         * @param res response that sends the browser back where it came from
         */
        const handleSsoCallback = async (req, res) => {
            var _a;
            var _b;
            const query = req.query;
            const login = query.state ? oidc.takePending(query.state) : undefined;
            if (!login) {
                // Either somebody called the route directly, or the login took too long
                adapter.log.error('SSO: unknown or expired state');
                res.status(400).send('Invalid state parameter');
                return;
            }
            if (!query.code) {
                adapter.log.error(`SSO: the identity provider sent no code: ${query.error || 'unknown reason'}`);
                res.redirect(login.redirectUrl);
                return;
            }
            let tokenData;
            let jwtVerifiedPayload;
            try {
                tokenData = await oidc.exchangeCode(query.code, login);
                jwtVerifiedPayload = await oidc.verifyIdToken(tokenData.id_token, login.nonce);
            }
            catch (e) {
                adapter.log.error(`SSO: ${e.message}`);
                res.redirect(login.redirectUrl);
                return;
            }
            if (login.method === 'login') {
                const objView = await adapter.getObjectViewAsync('system', 'user', {
                    startkey: 'system.user.',
                    endkey: 'system.user.\u9999',
                });
                const item = objView.rows.find(
                // @ts-expect-error needs to be allowed explicitly
                item => { var _a, _b, _c; return ((_c = (_b = (_a = item.value.common) === null || _a === void 0 ? void 0 : _a.externalAuthentication) === null || _b === void 0 ? void 0 : _b.oidc) === null || _c === void 0 ? void 0 : _c.sub) === jwtVerifiedPayload.sub; });
                if (!item) {
                    // The identity is not connected with any ioBroker user. Users are never created
                    // here, an administrator has to connect them first.
                    adapter.log.warn(`SSO: no ioBroker user is connected with the identity "${jwtVerifiedPayload.sub}"`);
                    res.redirect(login.redirectUrl);
                    return;
                }
                try {
                    const oauthToken = await model.generateTokens(item.id);
                    const responseToken = (0, utils_1.oauthTokenToResponse)(oauthToken);
                    const redirectUrl = new URL(login.redirectUrl);
                    redirectUrl.search = new URLSearchParams(options.ssoHandoff === 'code'
                        ? { ssoCode: oidc.createHandoff(responseToken) }
                        : { ssoLoginResponse: JSON.stringify(responseToken) }).toString();
                    // The same flags as for a password login, apart from `sameSite`: the browser comes
                    // back from the identity provider, and a `strict` cookie would not be sent along
                    // this redirect chain, so the page would load as if nobody had signed in
                    res.cookie('access_token', responseToken.access_token, {
                        httpOnly: true,
                        secure: options.secure || login.redirectUri.startsWith('https:'),
                        sameSite: 'lax',
                    }).redirect(redirectUrl.toString());
                    return;
                }
                catch (e) {
                    adapter.log.error(`Could not get oauth token: ${e.message}`);
                }
                res.redirect(login.redirectUrl);
                return;
            }
            // Connect the identity with an existing ioBroker user
            if (!login.user) {
                adapter.log.error('SSO: Invalid state - expected register method with user');
                res.redirect(login.redirectUrl);
                return;
            }
            const userObj = await adapter.getForeignObjectAsync(`system.user.${login.user}`);
            if (!userObj) {
                adapter.log.error(`SSO: No existing user object for user "${login.user}"`);
                res.redirect(login.redirectUrl);
                return;
            }
            (_a = (_b = userObj.common).externalAuthentication) !== null && _a !== void 0 ? _a : (_b.externalAuthentication = {});
            userObj.common.externalAuthentication.oidc = { sub: jwtVerifiedPayload.sub };
            await adapter.extendForeignObjectAsync(`system.user.${login.user}`, userObj);
            const redirectUrl = new URL(login.redirectUrl);
            redirectUrl.search = new URLSearchParams(options.ssoHandoff === 'code'
                ? { ssoCode: oidc.createHandoff({ id_token: tokenData.id_token }) }
                : { id_token: tokenData.id_token }).toString();
            res.redirect(redirectUrl.toString());
        };
        /**
         * Hand the result of a finished login to the page, in exchange for the one-time code it got
         * with the redirect. Needs no login: the code itself is the proof.
         *
         * @param req request with the `code` in the body
         * @param res response with the tokens, or the ID token of a connected identity
         */
        const handleSsoToken = async (req, res) => {
            let code;
            try {
                code = (await (0, utils_1.readRequestBody)(req)).code;
            }
            catch (e) {
                res.status(400).json({ error: 'invalid_request', error_description: e.message });
                return;
            }
            const result = typeof code === 'string' && code ? oidc.takeHandoff(code) : undefined;
            if (!result) {
                res.status(400).json({ error: 'invalid_grant', error_description: 'Unknown or expired code' });
                return;
            }
            res.set('Cache-Control', 'no-store').json(result);
        };
        // `/sso` stays reachable without a login for `method=login`, but `register` needs to know the
        // caller, so the credentials are resolved for this route although it is in front of `authorize`
        options.app.get('/sso', model.authorize, (req, res) => void handleSsoStart(req, res));
        options.app.get('/sso-callback', (req, res) => void handleSsoCallback(req, res));
        if (options.ssoHandoff === 'code') {
            options.app.post('/sso-token', (req, res) => void handleSsoToken(req, res));
        }
    }
    // Post token.
    options.app.post('/oauth/token', (req, res) => {
        void handleTokenRequest(req, res);
    });
    /**
     * Dispatch a token request to the matching grant. The body is read up front because the grant
     * type decides where the request goes, and not every host adapter installs a body parser.
     *
     * @param req The incoming request
     * @param res The response to write to
     */
    async function handleTokenRequest(req, res) {
        var _a;
        if (authCodeFlow) {
            try {
                // Hand the parsed body back to Express so `oauth2-server` finds it below.
                req.body = await (0, utils_1.readRequestBody)(req);
            }
            catch (e) {
                res.status(400).json({ error: 'invalid_request', error_description: e.message });
                return;
            }
            if (((_a = req.body) === null || _a === void 0 ? void 0 : _a.grant_type) === 'authorization_code') {
                await authCodeFlow.handleTokenRequest(req, res);
                return;
            }
        }
        const request = new oauth2_server_1.Request(req);
        const response = new oauth2_server_1.Response(res);
        await oauth
            .token(request, response)
            .then((token) => {
            // save access token and refresh token in cookies with expiration time and flags HTTPOnly, Secure.
            const cookieOptions = {
                httpOnly: true, // Makes the cookie inaccessible to client-side JavaScript
                secure: options.secure, // Only send cookie over HTTPS in production
                // expires: token.accessTokenExpiresAt, // Cookie will expire in X hour
                sameSite: 'strict', // Prevents the browser from sending this cookie along with cross-site requests (optional)
            };
            // Without a lifetime the cookie ends with the browser session. With "stay logged in" it lives as
            // long as the access token. `maxAge` is relative to the clock of the browser; `expires` would be
            // an absolute date from the server clock, and a server with a wrong time (a board without a
            // real-time clock before NTP kicks in) would hand out cookies the browser drops at once.
            if (req.body.stayloggedin === 'true' && token.accessTokenExpiresAt) {
                cookieOptions.maxAge = Math.max(0, token.accessTokenExpiresAt.getTime() - Date.now());
            }
            // Store the access token in a cookie named "access_token"
            res.cookie('access_token', token.accessToken, cookieOptions);
            res.json((0, utils_1.oauthTokenToResponse)(token));
        })
            .catch((err) => {
            res.status(err.code || 500).json(err);
        });
    }
    options.app.get('/logout', (req, res, next) => {
        var _a, _b;
        let accessToken = (_a = req.headers.cookie) === null || _a === void 0 ? void 0 : _a.split(';').find(c => c.trim().startsWith('access_token='));
        if (accessToken) {
            accessToken = accessToken.split('=')[1];
        }
        else if (req.query.token) {
            accessToken = req.query.token;
        }
        else if ((_b = req.headers.authorization) === null || _b === void 0 ? void 0 : _b.startsWith('Bearer ')) {
            accessToken = req.headers.authorization.substring(7);
        }
        if (accessToken) {
            void adapter.getSession(`a:${accessToken}`, (obj) => {
                res.clearCookie('access_token');
                if (obj) {
                    void adapter.destroySession(`a:${obj.aToken}`);
                    void adapter.destroySession(`r:${obj.rToken}`);
                }
                // the answer will be sent in other middleware
                if (options.loginPage) {
                    if (typeof options.loginPage === 'function') {
                        res.redirect(options.loginPage(req));
                    }
                    else {
                        res.redirect(options.loginPage);
                    }
                }
                else {
                    next();
                }
            });
        }
        else {
            res.clearCookie('access_token');
            // the answer will be sent in other middleware
            if (options.loginPage) {
                if (typeof options.loginPage === 'function') {
                    res.redirect(options.loginPage(req));
                }
                else {
                    res.redirect(options.loginPage);
                }
            }
            else {
                next();
            }
        }
    });
    options.app.use(model.authorize);
    // Registered after `authorize` so `req.user` is already filled from an `access_token` cookie:
    // a user who is signed in to the web UI only has to confirm, not to log in again.
    authCodeFlow === null || authCodeFlow === void 0 ? void 0 : authCodeFlow.registerAuthorizeRoutes();
    return model;
}
//# sourceMappingURL=oauth2.js.map