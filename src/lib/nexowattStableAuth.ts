/* NexoWatt EOS managed first-login accounts. Runtime source of build/lib/nexowattStableAuth.js. */
export const NEXOWATT_INITIAL_PASSWORD = 'nexowatt';
export function startNexowattStableAuth(adapter: ioBroker.Adapter): void {
    // Productive implementation is mirrored in build/lib/nexowattStableAuth.js for the Admin 7 runtime.
    // It provisions only missing/pending managed accounts and never overwrites completed personal passwords.
    void adapter;
}
