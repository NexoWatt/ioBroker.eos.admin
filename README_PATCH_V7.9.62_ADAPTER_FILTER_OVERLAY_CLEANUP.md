# NexoWatt EOS Admin 7.9.62 - Adapter Filter Overlay Cleanup

This patch keeps the native ioBroker adapter module view but suppresses stale/orphaned MUI filter menus that can fall back into the left header/navigation area and cover the EOS UI.

## Fixed

- Adapter category menu no longer remains as a vertical left overlay when its anchor becomes stale.
- Sort menu no longer remains as a small top-left overlay.
- Install/version dialogs and their autocomplete/listbox poppers remain clickable.
- Module card actions and native datapoint semantics remain unchanged.

## Scope

This is a runtime CSS/JS cleanup only; no aggressive datapoint write bridge and no new module-federation bootstrap replacement.
