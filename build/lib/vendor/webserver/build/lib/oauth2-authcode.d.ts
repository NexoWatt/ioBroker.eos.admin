import type { Express, Request, Response } from 'express';
import type { OAuth2Model } from './oauth2-model';
import { type OAuth2ClientStore } from './oauth2-clients';
export interface AuthorizationCodeFlowOptions {
    /** The Express app the endpoints are registered on. */
    app: Express;
    /** The OAuth2 model providing user verification and token issuance. */
    model: OAuth2Model;
    /** Storage for registered clients. */
    clientStore: OAuth2ClientStore;
    /**
     * Externally reachable base URL of this server, without a trailing slash, e.g.
     * `https://iobroker.example.com`. Required behind a reverse proxy: the URLs published in the
     * discovery document must be the ones the client can actually reach. When omitted, the URL is
     * derived from the request, which is only correct for directly exposed servers.
     */
    baseUrl?: string | ((req: Request) => string);
    /** Allow clients to register themselves via RFC 7591. Enabled by default. */
    dynamicClientRegistration?: boolean;
    /** Name shown on the login and consent pages. Defaults to "ioBroker". */
    productName?: string;
}
/**
 * Implements the OAuth2 authorization code flow with PKCE (RFC 7636), dynamic client registration
 * (RFC 7591) and authorization server metadata (RFC 8414) on top of an existing {@link OAuth2Model}.
 *
 * This is deliberately not built on `oauth2-server`: that package (3.x) has no PKCE support, and
 * MCP clients require it. Token issuance still goes through the model, so access and refresh tokens
 * are indistinguishable from those issued by the password grant.
 */
export declare class AuthorizationCodeFlow {
    private readonly adapter;
    private readonly model;
    private readonly clientStore;
    private readonly options;
    private readonly productName;
    /**
     * @param adapter ioBroker adapter used for session storage and logging
     * @param options Flow options
     */
    constructor(adapter: ioBroker.Adapter, options: AuthorizationCodeFlowOptions);
    /**
     * Register the endpoints that must be reachable without authentication: the discovery document
     * and — when enabled — dynamic client registration.
     *
     * Must be called *before* the app-wide `authorize` middleware so these routes stay public.
     */
    registerPublicRoutes(): void;
    /**
     * Handle `POST /oauth/revoke` (RFC 7009), so a client can drop its tokens when the user
     * disconnects it. Per the RFC an unknown token is not an error — the caller's goal is met either
     * way, and reporting it would let anyone probe which tokens exist.
     *
     * @param req The incoming request
     * @param res The response to write to
     */
    private handleRevoke;
    /**
     * Register the endpoints that need to know whether the browser is already logged in.
     *
     * Must be called *after* the app-wide `authorize` middleware, which populates `req.user` from an
     * `access_token` cookie — otherwise an already logged-in user would be asked for the password again.
     */
    registerAuthorizeRoutes(): void;
    /**
     * Determine the externally reachable base URL. Behind a reverse proxy the request-derived value
     * is wrong unless the host app enabled `trust proxy`, which is why {@link AuthorizationCodeFlowOptions.baseUrl}
     * exists.
     *
     * @param req The incoming request
     */
    private getBaseUrl;
    /**
     * Handle `POST /oauth/register`.
     *
     * @param req The incoming request
     * @param res The response to write to
     */
    private handleRegister;
    /**
     * Handle `GET /oauth/authorize`: validate the request, then show either the login form or the
     * consent page.
     *
     * @param req The incoming request
     * @param res The response to write to
     */
    private handleAuthorizeStart;
    /**
     * Handle `POST /oauth/authorize`: the login form submission, the consent decision, or both in
     * sequence.
     *
     * @param req The incoming request
     * @param res The response to write to
     */
    private handleAuthorizeSubmit;
    /**
     * Redeem an authorization code for tokens. Called from the `/oauth/token` route when the request
     * carries `grant_type=authorization_code`.
     *
     * @param req The incoming request
     * @param res The response to write to
     */
    handleTokenRequest(req: Request, res: Response): Promise<void>;
    /**
     * @param id Session key
     * @param ttl Time to live in seconds
     * @param data Payload to store
     */
    private setSession;
    /**
     * @param id Session key
     */
    private getSession;
    /**
     * @param id Session key
     */
    private destroySession;
    /**
     * Redirect back to the client with an OAuth2 error (RFC 6749 §4.1.2.1). Only ever called with a
     * redirect URI that was verified against the client's registration.
     *
     * @param res The response to write to
     * @param redirectUri Verified redirect URI
     * @param error OAuth2 error code
     * @param description Human-readable detail
     * @param state The client's `state` value, echoed back unchanged
     */
    private redirectWithError;
    /**
     * Answer an unexpected rejection from a route handler instead of letting it escape.
     *
     * These handlers are started from synchronous Express callbacks, so a rejection nobody catches
     * is an unhandled rejection — which terminates the host adapter's process on current Node
     * versions, and leaves the request hanging either way.
     *
     * @param res The response to write to
     * @param handler The already started handler
     * @param json Whether this endpoint answers with JSON rather than an HTML page
     */
    private guard;
    /**
     * Render the login form or the consent page, depending on whether the request already knows its user.
     *
     * @param res The response to write to
     * @param requestId Identifier of the pending request; doubles as CSRF token
     * @param pending The pending authorization request
     * @param error Optional error message to show above the form
     */
    private sendAuthorizePage;
    /**
     * Render a terminal error page for problems that must not be reported back to the client
     * application (unknown client, bad redirect URI, expired request).
     *
     * @param res The response to write to
     * @param status HTTP status code
     * @param title Short headline
     * @param message Explanation shown to the user
     */
    private sendErrorPage;
    /**
     * Wrap page content in the shared, dependency-free HTML shell.
     *
     * @param title Document title
     * @param content Already escaped HTML body
     */
    private htmlPage;
}
