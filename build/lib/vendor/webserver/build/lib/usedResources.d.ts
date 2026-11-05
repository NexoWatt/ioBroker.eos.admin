import type net from 'node:net';
/**
 * Payload of the `tcpPort` resource type - `ioBroker.TcpPortResourceData` of js-controller 8.
 *
 * Declared here rather than taken from `@iobroker/types` because an adapter using this library may
 * well be built against the types of js-controller 7, which do not know the registry at all.
 */
export interface UsedTcpPort {
    /** TCP port number */
    port: number;
    /** Address the socket is bound to, `0.0.0.0` or `::` for every interface */
    bind?: string;
    /** Address family, only reported for a concrete bind address */
    family?: 4 | 6;
}
/**
 * Whether the registry of used resources can be spoken to at all.
 *
 * Both halves have to be asked, because they are two independent versions: the methods exist in the
 * `@iobroker/adapter-core` the adapter was built with, the registry behind them exists in the
 * js-controller that is running. A call to a host that knows no `registerUsedResource` is not
 * refused, it is simply never answered - and every single one of them would sit out the five second
 * timeout of the adapter API before rejecting.
 *
 * @param adapter the ioBroker adapter
 * @returns whether resources may be registered and freed
 */
export declare function supportsUsedResources(adapter: ioBroker.Adapter): boolean;
/**
 * Report a TCP port as occupied by this instance.
 *
 * Registering is additive, one call per port, so an adapter serving several of them reports each.
 *
 * @param adapter the ioBroker adapter
 * @param data the port, and the address it is bound to if it is not every interface
 * @returns whether the host accepted the registration
 */
export declare function registerUsedPort(adapter: ioBroker.Adapter, data: UsedTcpPort): Promise<boolean>;
/**
 * Take a previously reported TCP port back.
 *
 * `data` is a filter and not the exact payload: every field it names has to match, fields it leaves
 * out are ignored - so omitting it frees every TCP port of this instance. Freeing on shutdown is not
 * needed, the host marks the entries of a stopped instance as no longer held by itself.
 *
 * @param adapter the ioBroker adapter
 * @param data the fields identifying the ports to free; every TCP port of this instance without it
 * @returns whether the host accepted the request
 */
export declare function freeUsedPort(adapter: ioBroker.Adapter, data?: Partial<UsedTcpPort>): Promise<boolean>;
/**
 * Report the port a server listens on for as long as it listens.
 *
 * The port is registered when the server starts listening - only then is it known, and a port taken
 * from the configuration may not be the one that was really bound - and freed when it closes again.
 * A server that is already listening is reported right away.
 *
 * @param adapter the ioBroker adapter
 * @param server the server whose port is reported
 * @returns a function that stops reporting and frees a port still registered
 */
export declare function trackUsedPort(adapter: ioBroker.Adapter, server: net.Server): () => void;
