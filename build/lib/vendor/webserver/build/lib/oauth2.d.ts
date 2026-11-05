import type { Request, Express } from 'express';
import { OAuth2Model } from './oauth2-model';
export interface CookieOptions {
    /** Convenient option for setting the expiry time relative to the current time in **milliseconds**. */
    maxAge?: number | undefined;
    /** Indicates if the cookie should be signed. */
    signed?: boolean | undefined;
    /** Expiry date of the cookie in GMT. If not specified or set to 0, create a session cookie. */
    expires?: Date | undefined;
    /** Flags the cookie to be accessible only by the web server. */
    httpOnly?: boolean | undefined;
    /** Path for the cookie. Defaults to “/”. */
    path?: string | undefined;
    /** Domain name for the cookie. Defaults to the domain name of the app. */
    domain?: string | undefined;
    /** Marks the cookie to be used with HTTPS only. */
    secure?: boolean | undefined;
    /** A synchronous function used for cookie value encoding. Defaults to encodeURIComponent. */
    encode?: ((val: string) => string) | undefined;
    /** Value of the “SameSite” Set-Cookie attribute. */
    sameSite?: boolean | 'lax' | 'strict' | 'none' | undefined;
    /** Value of the “Priority” Set-Cookie attribute. */
    priority?: 'low' | 'medium' | 'high';
    /** Marks the cookie to use partitioned storage. */
    partitioned?: boolean | undefined;
}
/** Configuration of the OpenID Connect identity provider that is used for the single sign-on */
export interface OidcConfig {
    /**
     * Issuer URL of the identity provider, e.g. `https://keycloak.example.com/realms/iobroker`.
     * The endpoints are read from its discovery document, so no provider-specific paths are needed.
     */
    issuer: string;
    /** Client ID that is registered at the identity provider for this installation */
    clientId: string;
    /** Secret of a confidential client. Empty for a public client, which authenticates with PKCE instead. */
    clientSecret?: string;
    /** Scopes to ask for, default `openid profile email` */
    scope?: string;
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
export declare function createOAuth2Server(adapter: ioBroker.Adapter, options: {
    app: Express;
    secure?: boolean;
    accessLifetime?: number;
    refreshLifetime?: number;
    noBasicAuth?: boolean;
    loginPage?: string | ((req: Request) => string);
    authorizationCode?: boolean;
    baseUrl?: string | ((req: Request) => string);
    dynamicClientRegistration?: boolean;
    maxClients?: number;
    productName?: string;
    oidc?: OidcConfig;
    ssoHandoff?: 'url' | 'code';
}): OAuth2Model;
