import type OAuth2Server from 'oauth2-server';
import type { Request } from 'express';
export interface IobrokerOauthResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in: number;
}
/**
 * Convert oauth2 token to JSON response
 *
 * @param token the created OAuth token
 */
export declare function oauthTokenToResponse(token: OAuth2Server.Token): IobrokerOauthResponse;
/**
 * Determine the externally reachable base URL, without a trailing slash. Behind a reverse proxy the
 * request-derived value is wrong (`http:` instead of `https:`, internal host) unless the host app
 * enabled `trust proxy`, which is why it can be configured.
 *
 * @param req The incoming request
 * @param baseUrl The configured base URL, or a function that derives it from the request
 */
export declare function getBaseUrl(req: Request, baseUrl?: string | ((req: Request) => string)): string;
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
export declare function readRequestBody(req: Request): Promise<Record<string, any>>;
