import { type Client, type Falsey, type RefreshTokenModel, type Token, type PartialToken, type User, type RefreshToken, type Scope } from 'oauth2-server';
import type { NextFunction, Request, Response } from 'express';
/** Extra properties bound to a token beyond the user it belongs to. */
export interface TokenBinding {
    /** ID of the OAuth2 client the token is issued to */
    clientId?: string;
    /** Resource the token is valid for (RFC 8707) */
    aud?: string;
    /** Granted scope */
    scope?: string;
}
export declare class OAuth2Model implements RefreshTokenModel {
    private readonly accessTokenLifetime;
    private readonly refreshTokenLifetime;
    private readonly noBasicAuth;
    private adapter;
    private bruteForce;
    /**
     * Create an OAuth2model
     *
     * @param adapter ioBroker adapter
     * @param options Options
     * @param options.accessLifetime Access token expiration in seconds
     * @param options.refreshLifeTime Refresh token expiration in seconds
     * @param options.noBasicAuth Do not allow basic authentication
     */
    constructor(adapter: ioBroker.Adapter, options?: {
        accessLifetime?: number;
        refreshLifeTime?: number;
        noBasicAuth?: boolean;
    });
    getAccessToken: (bearerToken: string) => Promise<Token | Falsey>;
    /**
     * Read the stored record of an access token, including the client and resource it is bound to.
     * Resource servers use this to verify that a token was actually issued for them.
     *
     * @param bearerToken The access token to look up
     */
    getTokenInfo: (bearerToken: string) => Promise<ioBroker.Session | null>;
    /**
     * Get client.
     */
    getClient: (_clientId: string, _clientSecret: string) => Promise<Client | Falsey>;
    authorize: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Issue a fresh access/refresh token pair for a user.
     *
     * @param userName The ioBroker user name (without the `system.user.` prefix)
     * @param binding Optional client/resource binding for tokens issued through the authorization code grant
     */
    generateTokens: (userName: string, binding?: TokenBinding) => Promise<Token>;
    /**
     * Get refresh token.
     */
    getRefreshToken: (bearerToken: string) => Promise<RefreshToken | Falsey>;
    /**
     * Get user.
     */
    getUser: (username: string, password: string) => Promise<User | Falsey>;
    /**
     * Save token.
     */
    saveToken: (token: PartialToken, client: Client, user: User) => Promise<Token | Falsey>;
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
    revokeTokenPair: (token: string) => Promise<boolean>;
    revokeToken: (token: RefreshToken | Token) => Promise<boolean>;
    verifyScope: (_token: Token, _scope: Scope) => Promise<boolean>;
    /**
     * Issue a new access token for internal usage.
     * E.g., node-red needs to access objects for Select ID dialog
     *
     * @param obj Message object
     */
    processMessage(obj: ioBroker.Message): boolean;
}
