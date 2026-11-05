# NexoWatt EOS Admin 8.0.2 – Systembereich und Expertenmodus

Dieser Stand stellt die sichtbaren Bedienelemente für Systemeinstellungen und Expertenmodus nach der Admin-8-Umstellung wieder her. Die vollständigen Basiseinstellungen bleiben auf der vorhandenen Admin-8-Oberfläche erhalten. Der Kunden-/Anlagenname verwendet weiterhin das bestehende Feld `system.config.common.siteName`; Standort, Sprache und weitere Einstellungen werden nicht zurückgesetzt. Die EOS-Home-/Pro-Lizenzverwaltung ist im Systembereich erreichbar.

Die Anmeldung aus 8.0.1 bleibt erhalten. Dominique hat am 05.11.2026 bestätigt, dass die Anmeldung nach diesem Fix auf seiner Anlage funktioniert. Eine erneute Passwortvergabe ist für dieses Update nicht erforderlich.

## ZIP kopieren und veröffentlichen

1. Eigene Änderungen sichern/committen. ZIP in einen kurzen Ordner wie `C:\nw` entpacken.
2. Den gesamten Inhalt von `ioBroker.eos-admin` in den vorhandenen Projektordner kopieren und Release-Dateien ersetzen. `.git` behalten; keine zusätzliche Ordnerebene einfügen.
3. Im VS-Code-Terminal Node prüfen: `node --version`. Unterstützt sind Node 22 ab 22.23.4 oder Node 24 ab 24.22.1, jeweils innerhalb der Hauptversion.
4. `npm.cmd publish --dry-run` ausführen. Bei Erfolg `npm.cmd publish` ausführen.

Der vorgebaute Stand benötigt vor dem Upload keinen lokalen Neubau. Die automatische Kopierübernahme sichert und entfernt ausschließlich bekannte entfallene Originaldateien mit passendem Hash. Unbekannte oder geänderte Dateien werden gemeldet. Schutzprüfungen nicht umgehen.

## Anlage über PuTTY aktualisieren

Voraussetzung: 8.0.2 ist erfolgreich veröffentlicht. Zuerst:

```bash
iobroker backup
```

Nur bei erfolgreicher Sicherung fortfahren:

```bash
iobroker upgrade eos-admin@8.0.2 --debug
```

Danach die EOS-Seite vollständig neu laden (Strg+F5) oder ein privates Browserfenster öffnen. Bestehenden Benutzer und gültiges Passwort verwenden.

## Kurze Prüfung auf der Anlage

- Als Administrator: „System“ öffnen. Vorhandener Kunden-/Anlagenname und Standort müssen geladen werden. Eine bewusst geänderte Einstellung speichern, erneut öffnen und den Wert prüfen; bei einem Testwert anschließend den ursprünglichen Wert wiederherstellen.
- Expertenmodus ein- und wieder ausschalten; erweiterte Ansichten müssen passend reagieren. Ein gewöhnlicher Benutzer darf dadurch keine zusätzlichen Rechte erhalten.
- Im Systembereich die EOS-Lizenzverwaltung öffnen. Vorhandener Home-/Pro-Status und UUID-Zuordnung bleiben erhalten. Eine gültige Lizenz für die Prüfung nicht entfernen.
- Anmeldung und bestehende EMS-/Gerätekonfiguration müssen weiterhin funktionieren.

Die Lizenzverwaltung erfordert weiterhin HTTPS oder einen lokalen Loopbackzugriff; dieses Update schaltet keine unverschlüsselte Lizenzübertragung im LAN frei. Rechte werden weiterhin serverseitig geprüft.

Bei Problemen den Fehlertext ohne Passwörter, Aktivierungsschlüssel oder Sitzungstokens sichern. Vor einem Rückfall die Sicherung und die bekannten Einschränkungen von 8.0.1 berücksichtigen. Prüfbericht und technische Nachweise stehen unter `docs/security/admin8-2026-11-05/system-fix/`. Lokale Tests ersetzen nicht die Abnahme auf einer Kundenanlage.
