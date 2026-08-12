# NexoWatt EOS Admin v7.9.76 – universal manual datapoint writing

This stability release replaces the previous partially type-aware datapoint handling with one deterministic manual-write policy.

## Supported writable states

- boolean states: direct toggle
- button/trigger/action states: direct typed command
- number states: validated native value dialog, comma decimals, min/max checks
- string states: native multiline value dialog
- `common.states`: controlled selector with typed keys
- mixed states: editor selected from current/default value; expert mode can change the editor type
- object/array/json metadata: validated JSON text written as an ioBroker scalar `StateValue`
- write-only states (`common.read=false`): visible write target even without a current state

## Safety

- `common.write=false` is always read-only.
- Reset, contactor, remote transaction, charging/current/power limits and related commands are expert-only unless explicitly marked safe.
- The expert-only policy applies to direct clicks, keyboard actions and the native context menu.
- ioBroker ACL checks are not bypassed.

## Adapter metadata overrides

```json
{
  "native": {
    "nexowatt": {
      "manualWriteExpertOnly": true,
      "manualWriteControl": "dialog",
      "manualTriggerValue": 1,
      "manualTrueValue": "ON",
      "manualFalseValue": "OFF"
    }
  }
}
```

`manualWriteControl` accepts `dialog`, `switch` or `button`. An explicit `manualWriteExpertOnly: false` can mark a proven-safe write state as normally operable.

## Reliability

Repeated writes to the same datapoint are serialized. The second command is queued instead of being silently ignored. Failed writes stay visible and do not close the value dialog.
