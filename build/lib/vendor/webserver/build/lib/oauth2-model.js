"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuth2Model = void 0;
const node_crypto_1 = require("node:crypto");
// ----- OAuth2Model Class -----
// This class implements the model methods required by oauth2-server.
class OAuth2Model {
    /**
     * Create an OAuth2model
     *
     * @param adapter ioBroker adapter
     * @param options Options
     * @param options.accessLifetime Access token expiration in seconds
     * @param options.refreshLifeTime Refresh token expiration in seconds
     * @param options.noBasicAuth Do not allow basic authentication
     */
    constructor(adapter, options) {
        // Token lifetimes in seconds
        this.accessTokenLifetime = 60 * 60; // 1 hour
        this.refreshTokenLifetime = 60 * 60 * 24 * 30; // 30 days
        this.bruteForce = {};
        this.getAccessToken = async (bearerToken) => {
            const token = await this.getTokenInfo(bearerToken);
            if (!token) {
                return null;
            }
            return {
                accessToken: token.aToken,
                accessTokenExpiresAt: new Date(token.aExp),
                client: {
                    id: 'ioBroker',
                    grants: ['password', 'refresh_token'],
                    accessTokenLifetime: this.accessTokenLifetime,
                    refreshTokenLifetime: this.refreshTokenLifetime,
                },
                user: {
                    id: token.user,
                    // Carried along so a refresh keeps the binding, and so resource servers can read it.
                    clientId: token.clientId,
                    aud: token.aud,
                    scope: token.scope,
                },
            };
        };
        /**
         * Read the stored record of an access token, including the client and resource it is bound to.
         * Resource servers use this to verify that a token was actually issued for them.
         *
         * @param bearerToken The access token to look up
         */
        this.getTokenInfo = async (bearerToken) => {
            return new Promise(resolve => this.adapter.getSession(`a:${bearerToken}`, resolve));
        };
        /**
         * Get client.
         */
        this.getClient = (_clientId, _clientSecret) => {
            // Just now we do not check the client secret as only one client is allowed
            return Promise.resolve({
                id: 'ioBroker',
                grants: ['password', 'refresh_token'],
                accessTokenLifetime: this.accessTokenLifetime,
                refreshTokenLifetime: this.refreshTokenLifetime,
            });
        };
        this.authorize = async (req, res, next) => {
            var _a, _b, _c, _d, _e;
            const _req = req;
            // Check if the user is logged in
            if (!_req.user) {
                // If authenticated by token in a query like /blabla?token=ACCESS_TOKEN
                if (_req.query.token) {
                    const token = await this.getAccessToken(_req.query.token);
                    if (token) {
                        _req.user = token.user.id;
                    }
                }
                // If authenticated by Authorization header {headers: authorization: "Bearer ACCESS_TOKEN"}
                if (!_req.user && ((_b = (_a = _req.headers) === null || _a === void 0 ? void 0 : _a.authorization) === null || _b === void 0 ? void 0 : _b.startsWith('Bearer '))) {
                    const token = await this.getAccessToken(_req.headers.authorization.substring(7));
                    if (token) {
                        _req.user = token.user.id;
                    }
                    else {
                        res.status(401).send('Unauthorized');
                        return;
                    }
                }
                // If authentication by access token in a cookie
                if (!_req.user && ((_c = _req.headers) === null || _c === void 0 ? void 0 : _c.cookie)) {
                    // If authenticated by cookie, like {headers: {cookie: "access_token=ACCESS_TOKEN"}}
                    const cookies = _req.headers.cookie.split(';').map(c => c.trim().split('='));
                    const tokenCookie = cookies.find(c => c[0] === 'access_token');
                    if (tokenCookie) {
                        const token = await this.getAccessToken(tokenCookie[1]);
                        if (token) {
                            _req.user = token.user.id;
                        }
                    }
                }
                if (!_req.user && _req.query.user && _req.query.pass) {
                    // If authenticated by a query like /blabla?user=USER&pass=PASS
                    const user = await this.getUser(_req.query.user, _req.query.pass);
                    if (user) {
                        _req.user = user.id;
                    }
                    else {
                        res.status(401).send('Unauthorized');
                        return;
                    }
                }
                if (!_req.user && !this.noBasicAuth && ((_e = (_d = _req.headers) === null || _d === void 0 ? void 0 : _d.authorization) === null || _e === void 0 ? void 0 : _e.startsWith('Basic '))) {
                    // If authenticated by Basic Auth
                    const base64 = _req.headers.authorization.substring(6);
                    const data = Buffer.from(base64, 'base64').toString('utf8');
                    const parts = data.split(':');
                    const username = parts.shift() || '';
                    const pass = parts.join(':');
                    const user = await this.getUser(username, pass);
                    if (user) {
                        _req.user = user.id;
                    }
                    else {
                        res.status(401).send('Unauthorized');
                        return;
                    }
                }
            }
            next();
        };
        /**
         * Issue a fresh access/refresh token pair for a user.
         *
         * @param userName The ioBroker user name (without the `system.user.` prefix)
         * @param binding Optional client/resource binding for tokens issued through the authorization code grant
         */
        this.generateTokens = async (userName, binding) => {
            const accessToken = (0, node_crypto_1.createHash)('sha1').update((0, node_crypto_1.randomBytes)(256)).digest('hex');
            const refreshToken = (0, node_crypto_1.createHash)('sha1').update((0, node_crypto_1.randomBytes)(256)).digest('hex');
            const accessTokenExpiresAt = new Date(Date.now() + this.accessTokenLifetime * 1000);
            const refreshTokenExpiresAt = new Date(Date.now() + this.refreshTokenLifetime * 1000);
            // userName is short and already checked
            const result = {
                accessToken: accessToken,
                accessTokenExpiresAt: accessTokenExpiresAt,
                refreshToken: refreshToken,
                refreshTokenExpiresAt: refreshTokenExpiresAt,
            };
            const user = {
                id: userName,
                clientId: binding === null || binding === void 0 ? void 0 : binding.clientId,
                aud: binding === null || binding === void 0 ? void 0 : binding.aud,
                scope: binding === null || binding === void 0 ? void 0 : binding.scope,
            };
            await this.saveToken(result, {
                id: 'ioBroker',
                grants: ['password', 'refresh_token'],
                accessTokenLifetime: this.accessTokenLifetime,
                refreshTokenLifetime: this.refreshTokenLifetime,
            }, user);
            return {
                accessToken: result.accessToken,
                accessTokenExpiresAt: result.accessTokenExpiresAt,
                refreshToken: result.refreshToken,
                refreshTokenExpiresAt: result.refreshTokenExpiresAt,
                user,
                client: {
                    id: 'ioBroker',
                    grants: ['password', 'refresh_token'],
                    accessTokenLifetime: this.accessTokenLifetime,
                    refreshTokenLifetime: this.refreshTokenLifetime,
                },
            };
        };
        /**
         * Get refresh token.
         */
        this.getRefreshToken = async (bearerToken) => {
            const token = await new Promise(resolve => this.adapter.getSession(`r:${bearerToken}`, resolve));
            if (!token) {
                return null;
            }
            return {
                refreshToken: token.rToken,
                refreshTokenExpiresAt: new Date(token.rExp),
                client: {
                    id: 'ioBroker',
                    grants: ['password', 'refresh_token'],
                    accessTokenLifetime: this.accessTokenLifetime,
                    refreshTokenLifetime: this.refreshTokenLifetime,
                },
                user: {
                    id: token.user,
                    // oauth2-server hands this same object to `saveToken`, which is how a refreshed
                    // token inherits the client and resource binding of the token it replaces.
                    clientId: token.clientId,
                    aud: token.aud,
                    scope: token.scope,
                },
            };
        };
        /**
         * Get user.
         */
        this.getUser = async (username, password) => {
            var _a;
            const now = Date.now();
            if (((_a = this.bruteForce[username]) === null || _a === void 0 ? void 0 : _a.errors) > 4) {
                let minutes = now - this.bruteForce[username].time;
                if (this.bruteForce[username].errors < 7) {
                    if (now - this.bruteForce[username].time < 60000) {
                        minutes = 1;
                    }
                    else {
                        minutes = 0;
                    }
                }
                else if (this.bruteForce[username].errors < 10) {
                    if (now - this.bruteForce[username].time < 180000) {
                        minutes = Math.ceil((180000 - minutes) / 60000);
                    }
                    else {
                        minutes = 0;
                    }
                }
                else if (this.bruteForce[username].errors < 15) {
                    if (now - this.bruteForce[username].time < 600000) {
                        minutes = Math.ceil((600000 - minutes) / 60000);
                    }
                    else {
                        minutes = 0;
                    }
                }
                else if (now - this.bruteForce[username].time < 3600000) {
                    minutes = Math.ceil((3600000 - minutes) / 60000);
                }
                else {
                    minutes = 0;
                }
                if (minutes) {
                    this.adapter.log.warn(`Too many errors for "${username}". Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`);
                    return null;
                }
            }
            const result = await new Promise(resolve => this.adapter.checkPassword(username, password, (success, user) => resolve({ success, user })));
            if (!result.success) {
                this.bruteForce[username] = this.bruteForce[username] || { errors: 0 };
                this.bruteForce[username].time = new Date().getTime();
                this.bruteForce[username].errors++;
                this.adapter.log.warn(`Invalid password for ${username}. Wrong attempts: ${this.bruteForce[username].errors}`);
                return null;
            }
            if (this.bruteForce[username]) {
                delete this.bruteForce[username];
            }
            return {
                id: result.user.replace(/^system\.user\./, ''),
            };
        };
        /**
         * Save token.
         */
        this.saveToken = async (token, client, user) => {
            const data = {
                accessToken: token.accessToken,
                accessTokenExpiresAt: token.accessTokenExpiresAt,
                refreshToken: token.refreshToken,
                refreshTokenExpiresAt: token.refreshTokenExpiresAt,
                user,
                client,
            };
            const accessTokenTtl = token.accessTokenExpiresAt
                ? Math.floor((token.accessTokenExpiresAt.getTime() - Date.now()) / 1000)
                : this.accessTokenLifetime;
            const refreshTokenTtl = token.refreshTokenExpiresAt
                ? Math.floor((token.refreshTokenExpiresAt.getTime() - Date.now()) / 1000)
                : this.refreshTokenLifetime;
            const internalToken = {
                aToken: token.accessToken,
                aExp: token.accessTokenExpiresAt
                    ? token.accessTokenExpiresAt.getTime()
                    : Date.now() + this.accessTokenLifetime * 1000,
                rToken: token.refreshToken || '',
                rExp: token.refreshTokenExpiresAt
                    ? token.refreshTokenExpiresAt.getTime()
                    : Date.now() + this.refreshTokenLifetime * 1000,
                user: user.id,
                // Present when the token comes from the authorization code grant, either directly or
                // through a refresh — `getRefreshToken` passes the binding along on the user object.
                clientId: user.clientId,
                aud: user.aud,
                scope: user.scope,
            };
            await Promise.all([
                new Promise((resolve, reject) => this.adapter.setSession(`a:${data.accessToken}`, accessTokenTtl, internalToken, err => err ? reject(err) : resolve())),
                new Promise((resolve, reject) => this.adapter.setSession(`r:${data.refreshToken}`, refreshTokenTtl, internalToken, err => err ? reject(err) : resolve())),
            ]);
            return data;
        };
        /**
         * Revoke an access or refresh token together with its counterpart.
         *
         * {@link revokeToken} can only drop the side it was handed, but both sessions store the full pair,
         * so a single token value is enough to invalidate the whole grant — which is what RFC 7009
         * revocation and "disconnect this app" need.
         *
         * @param token Either the access or the refresh token
         * @returns Whether a matching token was found
         */
        this.revokeTokenPair = async (token) => {
            const stored = (await new Promise(resolve => this.adapter.getSession(`a:${token}`, resolve))) ||
                (await new Promise(resolve => this.adapter.getSession(`r:${token}`, resolve)));
            if (!stored) {
                return false;
            }
            if (stored.aToken) {
                await this.adapter.destroySession(`a:${stored.aToken}`);
            }
            if (stored.rToken) {
                await this.adapter.destroySession(`r:${stored.rToken}`);
            }
            return true;
        };
        this.revokeToken = async (token) => {
            if (token.refreshToken) {
                await this.adapter.destroySession(`r:${token.refreshToken}`);
            }
            if (token.accessToken) {
                await this.adapter.destroySession(`a:${token.accessToken}`);
            }
            return true;
        };
        this.verifyScope = (_token, _scope) => {
            return Promise.resolve(true);
        };
        this.adapter = adapter;
        this.accessTokenLifetime = (options === null || options === void 0 ? void 0 : options.accessLifetime) || this.accessTokenLifetime;
        this.refreshTokenLifetime = (options === null || options === void 0 ? void 0 : options.refreshLifeTime) || this.refreshTokenLifetime;
        this.noBasicAuth = (options === null || options === void 0 ? void 0 : options.noBasicAuth) || false;
    }
    /**
     * Issue a new access token for internal usage.
     * E.g., node-red needs to access objects for Select ID dialog
     *
     * @param obj Message object
     */
    processMessage(obj) {
        var _a, _b;
        if (obj.command === 'internalToken') {
            // Make this option adjustable
            const adapter = obj.from.replace('system.adapter.', '').replace(/\.\d+$/, '');
            if (((_a = this.adapter.config.allowInternalAccess) === null || _a === void 0 ? void 0 : _a[adapter]) ||
                !this.adapter.config.allowInternalAccess) {
                const accessTokenTtl = Date.now() + 3600000;
                const internalToken = {
                    aToken: Buffer.from((0, node_crypto_1.randomBytes)(32)).toString('base64'),
                    aExp: accessTokenTtl,
                    rToken: '',
                    rExp: 0,
                    user: ((_b = this.adapter.config.allowInternalAccess) === null || _b === void 0 ? void 0 : _b[adapter]) || 'admin',
                };
                void this.adapter.setSession(`a:${internalToken.aToken}`, 3600, internalToken, err => {
                    if (obj.callback) {
                        this.adapter.sendTo(obj.from, obj.command, err
                            ? { error: err }
                            : {
                                access_token: internalToken.aToken,
                                token_type: 'Bearer',
                                expires_in: 3600,
                                refresh_token: '',
                                refresh_token_expires_in: 0,
                            }, obj.callback);
                    }
                });
            }
            else {
                this.adapter.log.warn(`Unknown message ${JSON.stringify(obj)}`);
                if (obj.callback) {
                    this.adapter.sendTo(obj.from, obj.command, { error: 'not allowed' }, obj.callback);
                }
            }
            return true;
        }
        return false;
    }
}
exports.OAuth2Model = OAuth2Model;
//# sourceMappingURL=oauth2-model.js.map