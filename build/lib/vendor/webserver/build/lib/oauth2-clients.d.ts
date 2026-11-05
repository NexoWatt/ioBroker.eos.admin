/** Client metadata as sent by a client to the registration endpoint (RFC 7591 §2). */
export interface OAuth2ClientMetadata {
    /** Human-readable name, shown to the user on the consent page. */
    client_name?: string;
    /** Allowed callback URIs. Compared byte-for-byte at the authorization endpoint. */
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
    scope?: string;
    client_uri?: string;
    logo_uri?: string;
    software_id?: string;
    software_version?: string;
}
/** A registered OAuth2 client as stored by {@link OAuth2ClientStore}. */
export interface OAuth2Client extends OAuth2ClientMetadata {
    client_id: string;
    /** Issue time in **seconds** since the epoch (RFC 7591 uses seconds, not milliseconds). */
    client_id_issued_at: number;
    grant_types: string[];
    response_types: string[];
    /** We only support public clients with PKCE; there are no client secrets to protect. */
    token_endpoint_auth_method: 'none';
    /** True when the client registered itself dynamically instead of being configured by hand. */
    dynamic: boolean;
}
/** Error carrying an RFC 7591 §3.2.2 error code, so the registration endpoint can report it verbatim. */
export declare class ClientRegistrationError extends Error {
    /** RFC 7591 error code, e.g. `invalid_redirect_uri` or `invalid_client_metadata`. */
    readonly code: 'invalid_redirect_uri' | 'invalid_client_metadata';
    constructor(code: 'invalid_redirect_uri' | 'invalid_client_metadata', message: string);
}
/**
 * Persistent store for OAuth2 clients.
 *
 * Clients must survive an adapter restart, so they are kept as ioBroker objects under
 * `<adapter.namespace>.oauth.clients.<client_id>` rather than in the (expiring) session storage.
 * Lookups are cached in memory; the cache is only ever filled from the objects database, so a
 * client registered by another instance is still found after a cache miss.
 */
export declare class OAuth2ClientStore {
    private readonly adapter;
    private readonly maxClients;
    private readonly cache;
    /**
     * @param adapter ioBroker adapter used for object access and logging
     * @param options Options
     * @param options.maxClients Maximum number of stored clients before the oldest dynamic ones are pruned
     */
    constructor(adapter: ioBroker.Adapter, options?: {
        maxClients?: number;
    });
    /** Object ID prefix under which all clients of this instance live. */
    private get folder();
    /**
     * Look up a client by its ID.
     *
     * @param clientId The `client_id` to resolve
     * @returns The stored client, or `null` when it is unknown
     */
    get(clientId: string): Promise<OAuth2Client | null>;
    /** List all stored clients, oldest registration first. */
    list(): Promise<OAuth2Client[]>;
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
    register(metadata: Partial<OAuth2ClientMetadata>, options?: {
        dynamic?: boolean;
    }): Promise<OAuth2Client>;
    /**
     * Remove a client. Already issued access tokens stay valid until they expire.
     *
     * @param clientId The `client_id` to remove
     */
    delete(clientId: string): Promise<void>;
    /**
     * Drop the oldest dynamically registered clients once the store grew past its limit. Without this
     * every re-added connector would leave a record behind forever. Clients registered by hand are
     * never pruned.
     */
    private prune;
}
