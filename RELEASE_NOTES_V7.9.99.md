# NexoWatt EOS Admin 7.9.99 – Stable Candidate

- Nicht vorhandenen Link „Vollständige EMS-Diagnose öffnen“ entfernt.
- Bearbeitungsstift in den untersten Intro-Kartenbereich verschoben.
- Passwortvergabe nach Erstanmeldung nutzt den kurzen ioBroker-Benutzernamen und prüft das neue Kennwort.
- Passwort-Metadaten werden nur über `native` erweitert; der neue Passwort-Hash wird nicht mit einem alten Benutzerobjekt überschrieben.
- Konto-Reset und sichtbare Kontoliste verwenden dieselbe Rollenfreigabe.
- EOS-Overlays und gepatchte Bundles werden mit `no-store` ausgeliefert.
- Release-Watcher erkennt zukünftige Versionswechsel und lädt die Oberfläche neu.
