import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
export interface WebServerAccessControl {
    /** Access-Control-Allow-Headers */
    accessControlAllowHeaders?: string;
    /** Access-Control-Allow-Methods */
    accessControlAllowMethods?: string;
    /**
     * Access-Control-Allow-Origin: either a literal value (`*` or one concrete origin) or a
     * function picking one for the origin of the incoming request - `origin => origin` reflects
     * it back, which is what a configuration that allows every origin with credentials needs.
     */
    accessControlAllowOrigin?: string | ((origin: string | undefined) => string | undefined);
    /** Access-Control-Expose-Headers */
    accessControlExposeHeaders?: string;
    /** Access-Control-Max-Age, in seconds: how long a browser may cache the preflight result */
    accessControlMaxAge?: number;
    /**
     * @deprecated `Access-Control-Request-Headers` is what the browser sends in a preflight; as a
     * response header it has no effect. Only used as a fallback for {@link accessControlAllowHeaders}.
     */
    accessControlRequestHeaders?: string;
    /**
     * @deprecated `Access-Control-Request-Method` is what the browser sends in a preflight; as a
     * response header it has no effect. Only used as a fallback for {@link accessControlAllowMethods}.
     */
    accessControlRequestMethod?: string;
    /** Access-Control-Allow-Credentials */
    accessControlAllowCredentials?: boolean;
}
interface WebServerOptions<Http2 extends boolean> {
    /** the ioBroker adapter */
    adapter: ioBroker.Adapter;
    app?: http.RequestListener | null;
    /** if https should be used */
    secure: boolean | undefined;
    /** access control options */
    accessControl?: WebServerAccessControl;
    /**
     * Answer ACME HTTP-01 challenges published by the acme adapter, so it does
     * not have to stop this adapter to get at port 80. Enabled by default; set
     * to false to keep `/.well-known/acme-challenge/` entirely to the app.
     */
    acmeChallenge?: boolean;
    /**
     * Speak HTTP/2 on a secure server, with HTTP/1.1 as fallback for clients that do not offer it.
     * Enabled by default; set to false to stay with HTTP/1.1. Has no effect without `secure`: browsers
     * use HTTP/2 over TLS only. WebSocket upgrades keep working, a browser opens them on a separate
     * HTTP/1.1 connection.
     */
    http2?: Http2;
    /**
     * Report the port the server listens on to the registry of exclusive resources js-controller 8
     * keeps per host, and take the entry back when the server closes. Enabled by default.
     *
     * Requires `"declareUsedResources": true` in the `common` part of the adapter's `io-package.json`
     * - without it js-controller derives the entry from `native.port` and refuses a registration.
     * Does nothing on an older controller.
     */
    usedResources?: boolean;
}
/** The server `init()` resolves to - an HTTP/2 server unless the `http2` option is `false` */
type WebServerInstance<Http2 extends boolean> = Http2 extends false ? http.Server | https.Server : http.Server | https.Server | http2.Http2SecureServer;
interface Certificates {
    /** public certificate */
    key: string;
    /** private certificate */
    cert: string;
    /** chained certificate */
    ca?: string;
}
export declare class WebServer<Http2 extends boolean = true> {
    private server;
    private readonly adapter;
    private readonly secure;
    private app?;
    private originalApp;
    private readonly certManager;
    private readonly accessControl;
    private readonly acmeChallenge;
    private readonly http2;
    private readonly usedResources;
    /** Stops reporting the listening port, set once `init()` created the server */
    private stopTrackingPort;
    constructor(options: WebServerOptions<Http2>);
    /**
     * Wrap the app with everything that has to run in front of it.
     *
     * Called from every branch of init() because each of them creates the
     * server from `this.app` and there is no single point after it.
     */
    private prepareApp;
    /**
     * Put the ACME HTTP-01 challenge lookup in front of the app.
     *
     * In front rather than in a route because the CA is anonymous and the
     * lookup therefore has to happen before any authentication the app
     * installs. Requests that are not a published challenge are handed on
     * untouched, so nothing the app serves is shadowed.
     */
    private initAcmeChallenge;
    /**
     * Put the configured CORS headers in front of the app.
     *
     * Outermost rather than as a route, so every answer carries them - including the ones the app
     * produces before any middleware it registered later would run, such as the OAuth2 token
     * endpoint or a 401 out of the authorization middleware.
     */
    private initAccessControl;
    /**
     * Initialize a new https / http server; according to configuration, it will be present on `this.server`
     */
    init(): Promise<WebServerInstance<Http2>>;
    /**
     * Stop reporting the listening port to js-controller and free an entry that is still registered.
     *
     * Only needed when the server is thrown away without being closed - a `close()` frees the entry
     * by itself, and a stopped instance has its entries released by the host.
     */
    unregisterUsedResources(): void;
    /**
     * Create a secure server: HTTP/2 with HTTP/1.1 fallback if enabled, plain HTTPS otherwise
     *
     * @param options TLS options with the certificates or the SNI callback
     */
    private createSecureServer;
    private createServer;
    /**
     * Assemble the certificate a secure context has to present for a collection.
     *
     * `cert` holds the leaf only - the issuing chain lives in `chain`, and without it every
     * client that does not already know the intermediate rejects the connection. Producers
     * disagree on whether `chain` repeats the leaf, so it is normalized here.
     *
     * @param collection the certificate collection
     */
    private static buildCertificateChain;
    /**
     * Cut a collection field into its individual PEM certificates.
     *
     * The field may be a single certificate, a whole concatenated chain or an array of either,
     * as string or as Buffer - which one it is depends on who wrote the collection.
     *
     * @param source the collection field to read
     */
    private static splitCertificates;
    /**
     * Build secure context from certificate collections
     *
     * @param collections the certificate collections
     */
    private buildSecureContexts;
    /**
     * Get the custom certificates as text
     */
    getCustomCertificates(): Promise<Certificates | null>;
    /**
     * Get the custom certificates context
     */
    getCustomCertificatesContext(): Promise<tls.SecureContext | null>;
}
export {};
