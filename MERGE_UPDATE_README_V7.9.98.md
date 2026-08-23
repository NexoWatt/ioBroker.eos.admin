# NexoWatt EOS Admin 7.9.98 – Merge-Update

Die Datei `NexoWatt_EOS_Admin_7.9.98_STABLE_MERGE_FLAT.zip` ist absichtlich flach aufgebaut. `package.json`, `io-package.json`, `src-admin`, `adminWww`, `build` und alle übrigen Repository-Dateien liegen direkt auf der ersten ZIP-Ebene.

## Anwendung auf einem vorhandenen Windows-Arbeitsordner

1. Den bestehenden Repository-Ordner sichern oder committen.
2. Die flache Merge-ZIP direkt in den vorhandenen Ordner entpacken.
3. Bei der Windows-Abfrage **„Dateien im Ziel ersetzen“** wählen.
4. Anschließend im Repository ausführen:

```powershell
.\MERGE_UPDATE.cmd
```

Alternativ:

```powershell
.\MERGE_UPDATE.ps1
```

Das Merge-Skript:

- synchronisiert alle Release-Versionen auf `7.9.98`;
- entfernt alte Stable-Laufzeitdateien wie v97;
- prüft Paketstruktur, Stabilität, Rollen, Login, Passwortablauf und EMS-Übersicht;
- führt abschließend einen npm-Pack-Dry-Run aus.

Erst nach der grünen Abschlussmeldung veröffentlichen. `.git`, lokale Commit-Historie und `node_modules` werden vom Merge-Skript nicht gelöscht.
