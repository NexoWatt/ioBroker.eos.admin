/**
 * Checks the public IP address of the server and tries to connect to it.
 * Throws error if a connection is possible.
 */
declare function checkPublicIP(port: number | string, pattern?: string, customPath?: string): Promise<void>;
export { checkPublicIP };
