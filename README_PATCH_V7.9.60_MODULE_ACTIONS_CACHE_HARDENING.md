# NexoWatt EOS Admin v7.9.61

Fixes module-card action clicks, specific-version installation for installed adapters such as nexowatt-ui, and hardens cache/legacy bootstrap shims to avoid duplicate HTML5 backend crashes after updates.

- Adapter module action footer stays clickable when the info/description card is open.
- Specific version install no longer depends on repository allowAdapterUpdate for already installed adapters in expert mode.
- v54-v59 bootstrap entry points are singleton shims to the v60 bootstrap.
- v60 cache busters added to index, hostInit, remoteEntry and key route chunks.
