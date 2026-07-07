# NexoWatt EOS Admin v7.9.53 - Native DP Write Semantics

This patch restores the ioBroker Admin/ObjectBrowser write contract for datapoints.

## Why this patch exists

Earlier v51/v52 hotfixes tried to make datapoint writes reliable by installing an unrestricted EOS click/write fallback. That made all `state` objects look writable and bypassed the native ObjectBrowser path. This was wrong for production because read registers must remain read-only and write registers must be writable through the normal ioBroker semantics.

## Behaviour in v7.9.53

- `common.write === false` is treated as read-only.
- `common.write !== false` is treated as writable.
- The data point value cell uses the native ObjectBrowser edit flow again.
- The value dialog returns `{ val, ack, q, expire }` to ObjectBrowser.
- ObjectBrowser writes with `socket.setState(id, { val, ack, q, expire })`.
- EOS no longer installs a DOM capture write handler on `tab-objects`.
- EOS no longer exposes `window.NEXOWATT_EOS_WRITE_STATE_UNRESTRICTED`.
- The backend bridge now rejects `common.write=false` states instead of ignoring the flag.

## Required EMS/object model

Read registers should be created as:

```json
{
  "type": "state",
  "common": {
    "read": true,
    "write": false
  }
}
```

Write registers / command states should be created as:

```json
{
  "type": "state",
  "common": {
    "read": true,
    "write": true
  }
}
```

If a write register is still not editable after this patch, the object definition or ACL must be inspected first.
