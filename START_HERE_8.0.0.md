# NexoWatt EOS Admin 8.0.0

Dieses vollständige Repository enthält einen neu gebauten Admin-8-Kern auf Basis von ioBroker Admin **8.3.5**. Die eigene EOS-Produktversion ist **8.0.0**.

## Gewohnter Upload aus VS Code

1. ZIP direkt nach **`C:\nw`** in einen neuen Arbeitsordner entpacken und `C:\nw\ioBroker.eos-admin` in VS Code öffnen. Keinen zusätzlichen Ordner mit dem langen ZIP-Namen erzeugen. Einen vorhandenen Git-Ordner nicht löschen oder blind überkopieren: sichere Übernahme siehe **`WINDOWS_GIT_NPM_DE.md`**.
2. Im Terminal `node --version` prüfen: benötigt wird Node.js **>=24.22.1 und <25**.
3. Zuerst **`npm publish --dry-run`** ausführen. Nur bei erfolgreicher Prüfung mit dem vorhandenen berechtigten npm-Konto wie bisher **`npm publish`** ausführen. Unter PowerShell kann `npm.cmd` verwendet werden, falls die Ausführungsrichtlinie `npm.ps1` blockiert.

Der fertige Build liegt bei. Der Upload prüft Quellen, Laufzeitdateien, Lock-Metadaten und die gebundenen Entwicklungstests. Er baut und versiegelt nichts heimlich neu. Fehlende Entwicklungsabhängigkeiten sind kein Grund für eine Umgehung der Prüfungen. Keine Option `--ignore-scripts` zum Veröffentlichen verwenden.

Für diesen vorgebauten Lieferstand ist vorher kein `npm install`, `npm ci` oder neuer Build nötig. Ein erfolgreicher Dry-run ersetzt weder npm-Anmeldung/Veröffentlichungsrechte noch die Prüfung, ob Version 8.0.0 bereits veröffentlicht wurde. Eine bereits veröffentlichte Paketversion kann nicht erneut verwendet werden; dann ist ein neuer vollständig gebauter und geprüfter Versionsstand erforderlich. Nicht nur die Versionsnummer im fertigen Paket ändern.

Der Nachweisordner wurde am 05.11.2026 nach `docs/ea/` verkürzt, damit die langen EasyAccess-Dateinamen unter Windows kopierbar sind. `.gitattributes` erhält die exakten Datei-Bytes beim Git-Transport; bestehende Quellen, Builds, Sperrdateien und Sicherheitsprüfungen bleiben unverändert.

## Installation auf dem Zielsystem

Vorher vollständige Sicherung samt Lizenzablage und getrenntem lokalem Schlüssel erstellen. Benötigt werden ioBroker js-controller **>=7.2.5**, das unterstützte Node-24-Profil und HTTPS für Fernzugriff. Adapter regulär im Controller aktualisieren; bloßes Kopieren von Browserdateien ersetzt das Instanz-Upgrade nicht.

Die vorhandenen NWL2-Home-/Pro-Lizenzen und UUID-Bindung bleiben erhalten. Windows als Entwicklungs-/Uploadsystem ist von der unterstützten Linux-Lizenzlaufzeit zu unterscheiden.

Bewusste Sicherheitsänderungen: keine Betriebssystem-Passwortänderung oder Standardpasswort-Proben aus dem Adapter; keine automatische npm-Installation beim Adapterstart; eingeschränkte Customkarten statt ausführbarer Funktions-/HTML-Konfiguration. Bestehende Customwerte bleiben erhalten. Die normale ioBroker-Kontoverwaltung bleibt verfügbar.

Die Anleitung mit Integrationsgrenzen und Zielsystem-Abnahmeliste steht in **docs/ADMIN8_MIGRATION_8.0.0_DE.md**. Der Abschlussbericht und die Rohbelege stehen unter **docs/security/admin8-2026-11-04/**. Die Screenshots zeigen die echte gebaute Oberfläche mit ausdrücklich synthetischen Testdaten.

Die EasyAccess-Nachprüfung wurde am 05.11.2026 ergänzt: offizieller Quell-/Signaturnachweis, bytegleicher Nachbau, tatsächliche Bibliothekszuordnung, Advisory-Triage und echte Browserprüfungen bestanden im dokumentierten Umfang. Die ursprüngliche Herkunfts-/Inventurlücke ist geschlossen. Drei kleinere Funktions-/Robustheitsbefunde und die Anlagenabnahme bleiben offen. Einzelheiten: `docs/security/admin8-2026-11-05/EASYACCESS_FOLLOWUP_DE.md`.

Die lokale Prüfung ersetzt keine Anlagenabnahme, IEC-Zertifizierung oder CRA-Konformitätsbewertung. Es wurde weder auf npm veröffentlicht noch auf einer Kundenanlage installiert.
