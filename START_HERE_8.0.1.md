# NexoWatt EOS Admin 8.0.1 – Anmeldung korrigiert

Dieser Stand korrigiert einen bestätigten Fehler der EOS-Sitzungsprüfung in 8.0.0. Die ioBroker-Gruppenansicht liefert in `row.id` einen Anzeigenamen; die technische Gruppen-ID steht im vollständigen Objekt unter `row.value._id`. EOS 8.0.0 verlangte irrtümlich die technische ID im Anzeigenamen und wies deshalb auch gültige Zugangsdaten zurück.

Die npm-Auslieferung bindet außerdem die geprüfte OAuth-Anmeldebibliothek ausdrücklich ein und enthält den dokumentierten, hashgeprüften WebServer-Code.

Bestehende Benutzer, individuelle Passwörter, Gruppenrechte sowie Home-/Pro-Lizenzen werden nicht zurückgesetzt. Die Prüfung verwendet weiterhin die ioBroker-Passwortkontrolle und den Sitzungswiderruf bei Passwort-, Benutzer- und Rechteänderungen.

## ZIP übernehmen und aus VS Code veröffentlichen

1. Eigene Änderungen sichern/committen. ZIP in einen kurzen Ordner wie `C:\nw` entpacken.
2. Den gesamten Inhalt des Projektordners in den bisherigen Git-Ordner übernehmen und Release-Dateien ersetzen. `.git` nicht löschen. Keine zusätzliche Ordnerebene einfügen.
3. Node 22 ab 22.23.4 oder Node 24 ab 24.22.1 nutzen. Im VS-Code-Terminal `npm.cmd publish --dry-run` und anschließend `npm.cmd publish` ausführen. Der Stand ist 8.0.1, weil 8.0.0 bereits veröffentlicht wurde.

Die automatische Kopierübernahme sichert nur bekannte entfallene Originaldateien mit exakt passendem Hash. Unbekannte oder lokal geänderte Zusatzdateien bleiben unangetastet und werden gemeldet. Kein neuer lokaler Build ist vor dem Upload nötig. Prüfungen nicht mit `--ignore-scripts` umgehen.

## Anlage über PuTTY aktualisieren

Voraussetzung: 8.0.1 wurde erfolgreich auf npm veröffentlicht. Vorher ein aktuelles Backup erstellen. Für das Adapterupdate ist keine erneute Passwortänderung und keine Änderung der Node-Hauptversion erforderlich.

```bash
iobroker backup
iobroker upgrade eos-admin@8.0.1 --debug
```

Nur bei erfolgreichem Backup mit dem Upgrade fortfahren. Anschließend den EOS Admin in einem privaten Browserfenster öffnen und mit dem bestehenden Benutzer sowie dem gültigen Passwort anmelden. Normales Admin-Fenster während dieser Prüfung schließen; gleichnamige Sitzungscookies können sich bei gleicher IP auf unterschiedlichen Ports beeinflussen.

## Prüfung auf der Anlage

- Anmeldung mit bestehendem `admin` und gültigem Kennwort funktioniert; ein falsches Kennwort bleibt abgewiesen.
- Bestehender weiterer Benutzer kann sich entsprechend seinen Gruppenrechten anmelden. Benutzername `admin` ist keine Voraussetzung für individuelle Konten.
- Gruppen mit deutschen/englischen oder übersetzten Anzeigenamen funktionieren ohne Umbenennung.
- Nach Passwortänderung sind alte Sitzungen ungültig; eine neue Anmeldung mit dem neuen Kennwort funktioniert.
- Home-/Pro-Status und Geräte-/EMS-Konfiguration bleiben erhalten.

Diese Anlagenprüfungen müssen auf Dominiques Anlage noch ausgeführt werden. Die lokal tatsächlich durchgeführten Tests, Quellbelege und Grenzen stehen unter `docs/security/admin8-2026-11-05/login-fix/`. Keine Aussage einer vollständigen IEC-/CRA-Konformität oder allgemeinen Fehlerfreiheit.
