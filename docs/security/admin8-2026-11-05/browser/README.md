# EasyAccess-Browsernachweis

Die JSON-Protokolle und PNGs zeigen die tatsächliche gelieferte EasyAccess-Komponente mit synthetischen Instanz-/Konfigurationsdaten. Die Remote-Dateien und alle Vendor-Bundles stammen unverändert aus `admin/custom`.

- `standalone-easyaccess-browser.json`: unabhängiges Laden mit den mitgelieferten Bibliotheken.
- `host-easyaccess-browser.json`: gestartete tatsächliche EOS-Oberfläche; Einbettung mit deren vorhandener React-Laufzeit 19.3.1.
- Jeweils drei gefilterte/sortierte Zeilen, vier Checkboxen, korrekte Änderungen beider Freigabelisten und inerte Ausgabe einer HTML-Testzeichenfolge. Keine fehlenden Ressourcen, externen Abrufe, Seiten- oder Konsolenfehler.
- Socket und Speicheränderungen bleiben im Prüfprozess. Der vollständige Einstellungsdialog, das tatsächliche Speichern am Controller, Serverrechte und reale Anlagen sind davon nicht abgedeckt.

Voraussetzungen: Node.js 24, separat installiertes Playwright 1.62.1 und passender Chromium-Browser. Das Tool versucht zunächst `EOS_PLAYWRIGHT_MODULE`, dann normales `require('playwright')`; im Codex-Prüfumfeld besteht zusätzlich die dokumentierte Runtimeauflösung. Keine Browserbinärdatei oder Entwicklungsinstallation gehört zum Lieferpaket.

Vom Repositoryroot:

```text
node docs/security/admin8-2026-11-05/browser/easyaccess-browser.cjs
node docs/security/admin8-2026-11-05/browser/easyaccess-browser.cjs --host
```

Mit `--root` beziehungsweise `EOS_ADMIN_ROOT` kann ein anderes vollständiges Repository gewählt werden; `--output` wählt einen eigenen Ergebnisordner. Standardmäßig schreibt das Skript nach `browser/rerun/` und überschreibt die ursprünglichen Nachweise nicht. Für getrennte Werkzeuginstallationen `EOS_PLAYWRIGHT_MODULE` auf deren Modulverzeichnis setzen. `EOS_BROWSER_EXECUTABLE` wählt eine vorhandene Browserdatei.

Tatsächlich benutzt: Linux x64, Node24.22.1, Playwright1.62.1, Chromium153.0.8010.0 aus `@sparticuz/chromium@153.0.0`. Registry-Archiv SHA512: `jiGWqSvPMdu4+P9TilYqAR7yEGPEHINx+lCvE/NqNO/EHYzF/x1hUiI5T6ioVIt7dEy7n88byyT0vk+dnsgQwA==`; ausgeführter Browser SHA256: `53a15d6c3a3d27dfb54c4ba60278b1683136f70cf1e67e989da7dfbd3d451ef0`.

Nur für dieses isolierte Linux-Testprofil wurde `EOS_BROWSER_PROFILE=sparticuz` gesetzt. Es aktiviert die benötigten Bibliothekspfade und `--no-sandbox`-Startargumente; das ist keine Vorgabe für den Produktbetrieb oder einen normalen Benutzerbrowser. Andere Browser-/Betriebssystemversionen können andere Bildpixel erzeugen. Ein Windows-Lauf wurde nicht ausgeführt.

`harness-diagnostic-demo-renderer.json` bewahrt die erste fehlerhafte Host-Harnessprobe: Sie lud den unabhängigen Remote-Demo-ReactDOM-Bootstrap statt des vorhandenen Hostrenderers und erzeugte dadurch einen Versionskonflikt. Der korrekte Hosttest verwendet den vorhandenen Host-Share-Scope. Die Produktdateien wurden dafür nicht verändert.
