# NexoWatt EOS manual datapoint write policy

The EOS Admin ObjectBrowser follows `common.write` as the mandatory ioBroker write flag.

- `common.write === false`: always read-only.
- writable button/trigger: writes `true` with `ack: false`.
- writable boolean: toggles the current value with `ack: false`.
- writable number/string/enum/JSON: opens the native value dialog.
- safety-relevant commands: enabled only while expert mode is active.

## Explicit safety override

Device adapters should explicitly mark safety-relevant command states where possible:

```json
{
  "type": "state",
  "common": {
    "type": "number",
    "read": true,
    "write": true,
    "role": "level.power"
  },
  "native": {
    "nexowatt": {
      "manualWriteExpertOnly": true
    }
  }
}
```

To override a conservative heuristic for a known-safe command, set the same flag to `false`.

Supported compatibility locations are:

- `native.nexowatt.manualWriteExpertOnly`
- `native.manualWriteExpertOnly`
- `common.custom.nexowatt.manualWriteExpertOnly`
- `common.custom["nexowatt.eos"].manualWriteExpertOnly`
- `common.custom["eos-admin"].manualWriteExpertOnly`

The ioBroker ACL remains authoritative. The EOS policy never bypasses socket permissions or adapter-side validation.
