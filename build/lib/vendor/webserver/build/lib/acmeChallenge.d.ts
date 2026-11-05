import type { IncomingMessage, ServerResponse } from 'node:http';
/** Path the CA requests. Reserved for ACME by RFC 8615, so nothing else owns it. */
export declare const ACME_CHALLENGE_PREFIX = "/.well-known/acme-challenge/";
/**
 * Where the acme adapter publishes. The instance number is not fixed and two
 * instances may be ordering at once, so every match is consulted.
 */
export declare const ACME_CHALLENGE_STATE_PATTERN = "acme.*.info.httpChallenges";
/**
 * RFC 8555 tokens are base64url. Anything else is rejected before it can reach
 * a lookup, which keeps this unauthenticated path from turning arbitrary URLs
 * into database reads.
 */
export declare const ACME_TOKEN_REGEX: RegExp;
/** One entry of the published token map, keyed by token. */
export interface PublishedAcmeChallenge {
    /** Served verbatim as the response body: `token.thumbprint` */
    keyAuthorization: string;
    /** ms epoch after which the entry must be treated as gone */
    expires: number;
}
/**
 * Pick the challenge token out of a request URL, if it is one at all.
 *
 * @param url the raw request URL
 * @returns the token, or null when this request is not an ACME challenge
 */
export declare function acmeChallengeToken(url: string | undefined): string | null;
/**
 * Look a token up in what the acme adapter currently publishes.
 *
 * Read on demand rather than kept in a subscription cache: the adapter
 * publishes a token and has the CA validate it immediately afterwards, so a
 * cache would race with the order it is meant to serve. The path is only hit a
 * handful of times per certificate.
 *
 * @param adapter the ioBroker adapter
 * @param token the token from the request URL
 * @returns the key authorization to answer with, or null
 */
export declare function findAcmeChallenge(adapter: ioBroker.Adapter, token: string): Promise<string | null>;
/**
 * Answer an ACME HTTP-01 challenge request.
 *
 * Answers only when the token is actually published. Anything else - a request
 * that is not a challenge, an unknown token, a states DB that cannot be read -
 * is reported as unhandled so the caller passes it on. Nothing an application
 * serves on that path is ever shadowed by this.
 *
 * @param adapter the ioBroker adapter
 * @param req the incoming request
 * @param res the response to write to
 * @returns true when the request was answered here
 */
export declare function serveAcmeChallenge(adapter: ioBroker.Adapter, req: IncomingMessage, res: ServerResponse): Promise<boolean>;
/**
 * The same as express middleware, for an adapter that builds its server itself
 * instead of through `WebServer`.
 *
 * Mount it before any authentication:
 * `app.use(acmeChallengeMiddleware(adapter))`
 *
 * @param adapter the ioBroker adapter
 */
export declare function acmeChallengeMiddleware(adapter: ioBroker.Adapter): (req: IncomingMessage, res: ServerResponse, next: (err?: any) => void) => void;
