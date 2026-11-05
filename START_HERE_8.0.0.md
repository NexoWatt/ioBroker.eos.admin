# NexoWatt EOS Admin 8.0.0

Dieses vollständige Repository enthält einen neu gebauten Admin-8-Kern auf Basis von ioBroker Admin **8.3.5**. Die eigene EOS-Produktversion ist **8.0.0**.

## Gewohnter Upload aus VS Code

1. Einmalig `node --version` prüfen: unterstützt sind **Node 22 ab 22.23.4** oder **Node 24 ab 24.22.1**, jeweils innerhalb ihrer Hauptversion. Node 24.21.0 muss innerhalb der 24er-Reihe aktualisiert werden. Anschließend VS Code neu öffnen, damit das Terminal die neue Installation verwendet.
2. ZIP zunächst in einen kurzen temporären Ordner wie `C:\nw` entpacken. Dann den **gesamten Inhalt** des darin enthaltenen Projektordners in den bisherigen Git-Ordner kopieren und vorhandene Release-Dateien ersetzen. Kein zusätzlicher Projekt-Unterordner im Git-Ordner; `package.json` bleibt an derselben Stelle. `.git` nicht löschen oder verschieben.
3. Im bisherigen VS-Code-Ordner wie gewohnt **`npm.cmd publish`** ausführen. Optional vorher `npm.cmd publish --dry-run`.

Die Kopierübernahme läuft automatisch als erste Publish-Stufe. Sie prüft zunächst die vollständigen aktuellen Release-Dateien. Bekannte entfallene Dateien aus den dokumentierten Altständen werden nur bei exakt passendem Hash unter `.eos-backup/` gesichert und aus den Releasebereichen ausgelagert. Unbekannte oder lokal veränderte Zusatzdateien bleiben erhalten und werden konkret gemeldet. Fehlende aktuelle Dateien werden nicht erfunden, Hashfehler nicht übergangen und der Release nicht heimlich neu gebaut oder versiegelt.

`.git`, vorhandene `node_modules` und Dateien außerhalb der Releasebereiche bleiben erhalten. Die Sicherung wird weder ins npm-Paket noch regulär ins Git aufgenommen. Vor dem Überkopieren eigene Änderungen committen oder separat sichern: Eine bereits durch Explorer überschriebene eigene Änderung kann die nachfolgende Übernahmeprüfung nicht rekonstruieren.

Der fertige Build liegt bei. Für diesen Upload sind vorher kein `npm install`, `npm ci`, MERGE_UPDATE-Aufruf oder neuer Build notwendig. Die optionalen `MERGE_UPDATE.*`-Starter führen ausschließlich denselben npm-Dry-run aus. Details und Rückfall: **`WINDOWS_GIT_NPM_DE.md`**.

Alle bisherigen Integritäts-, Lock-, Sicherheits- und Stabilitätsprüfungen bleiben aktiv. Keine Veröffentlichung mit `--ignore-scripts`. npm-Anmeldung, Rechte/2FA und eine noch unveröffentlichte Version bleiben erforderlich. Bereits veröffentlichte 8.0.0 nicht durch bloßes Ändern der Versionsnummer umgehen; hierfür benötigt es einen neuen vollständig geprüften Stand.

## Installation auf dem Zielsystem

Vorher vollständige Sicherung samt Lizenzablage und getrenntem lokalem Schlüssel erstellen. Benötigt werden ioBroker js-controller **>=7.2.5**, eines der unterstützten Node-22-/Node-24-Profile und HTTPS für Fernzugriff. Adapter regulär im Controller aktualisieren; bloßes Kopieren von Browserdateien ersetzt das Instanz-Upgrade nicht.

Die vorhandenen NWL2-Home-/Pro-Lizenzen und UUID-Bindung bleiben erhalten. Windows als Entwicklungs-/Uploadsystem ist von der unterstützten Linux-Lizenzlaufzeit zu unterscheiden.

Bewusste Sicherheitsänderungen: keine Betriebssystem-Passwortänderung oder Standardpasswort-Proben aus dem Adapter; keine automatische npm-Installation beim Adapterstart; eingeschränkte Customkarten statt ausführbarer Funktions-/HTML-Konfiguration. Bestehende Customwerte bleiben erhalten. Die normale ioBroker-Kontoverwaltung bleibt verfügbar.

Die Anleitung mit Integrationsgrenzen und Zielsystem-Abnahmeliste steht in **docs/ADMIN8_MIGRATION_8.0.0_DE.md**. Der Abschlussbericht und die Rohbelege stehen unter **docs/security/admin8-2026-11-04/**. Die Screenshots zeigen die echte gebaute Oberfläche mit ausdrücklich synthetischen Testdaten.

Die EasyAccess-Nachprüfung wurde am 05.11.2026 ergänzt: offizieller Quell-/Signaturnachweis, bytegleicher Nachbau, tatsächliche Bibliothekszuordnung, Advisory-Triage und echte Browserprüfungen bestanden im dokumentierten Umfang. Die ursprüngliche Herkunfts-/Inventurlücke ist geschlossen. Drei kleinere Funktions-/Robustheitsbefunde und die Anlagenabnahme bleiben offen. Einzelheiten: `docs/security/admin8-2026-11-05/EASYACCESS_FOLLOWUP_DE.md`.

Die lokale Prüfung ersetzt keine Anlagenabnahme, IEC-Zertifizierung oder CRA-Konformitätsbewertung. Es wurde weder auf npm veröffentlicht noch auf einer Kundenanlage installiert.
