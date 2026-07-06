# NexoWatt EOS Admin v7.9.50 DP Write Hardfix

This patch hardens manual datapoint writes in the Objects/Datapoints view.

## Main fixes

- Patched the shipped `@iobroker/adapter-react-v5` ObjectBrowser bundle, not only the EOS helper script.
- Added cache-busted frontend entry, bootstrap, remote-entry and adapter-react chunks so the patched ObjectBrowser is actually loaded after update.
- Value-cell clicks stop row-selection propagation and no longer require an already initialized local state cache before opening the write path.
- Added a direct EOS fallback write dialog for writable value cells if the native React dialog does not open.
- Boolean, number, JSON/object and common.states values are coerced consistently before writing.
- Writes use `socket.setState(id, { val, ack, q: 0 })`, defaulting to `ack: false`; the dialog closes only after successful write.
- Reduced Objects page observer churn by avoiding value-text and selection-class feedback loops.

## Preserved fixes

- Adapter/service delete protection from previous versions remains unchanged.
- Delete logquiet guard remains unchanged.
- Admin/installateur/enduser role guard remains unchanged.
