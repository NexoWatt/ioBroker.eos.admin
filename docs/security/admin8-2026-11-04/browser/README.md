# Browsernachweis für EOS Admin 8.0.0

Dieser Ordner enthält echte Screenshots der gebauten Oberfläche, die dazugehörigen Browserprotokolle und einen portablen Prüfstand. Die drei Ansichten wurden mit dem unveränderten Produktionsbuild geprüft. HTTP- und WebSocket-Antworten werden ausschließlich lokal durch synthetische Daten ersetzt. Es erfolgt keine Anmeldung an einer Anlage, kein Zugriff auf Kundendaten und kein Test des echten Backends.

Die Übersicht trägt sichtbar „Vorschau · synthetische Testdaten“. Der Prüfstand speichert synthetische Objektänderungen nur im Prozessspeicher. Die ausgewertete Rollenanzeige ist ein UI-Nachweis; sie ersetzt keine serverseitigen Berechtigungsprüfungen. Produktquellen und Builds werden durch diesen Prüfstand nicht geändert.

## Enthaltene Belege

| Datei | Inhalt |
| --- | --- |
| `admin8-login-preview.png` | Anmeldeoberfläche |
| `admin8-overview-preview.png` | Übersicht als Administrator |
| `admin8-enduser-preview.png` | Übersicht als Endnutzer |
| `browser-verification-summary.json` | Ergebnisse, Buildbindung und SHA-256 der Screenshots |
| `browser-*-result.json` | Tatsächlich beobachtete Ressourcen, Browserfehler und synthetische Socket-Aufrufe |
| `browser-smoke.cjs` | Browserstart, lokale HTTP-Antworten, Screenshot und Ergebnisprüfungen |
| `overview-fixture.cjs` | Synthetische ioBroker-WebSocket-Antworten |
| `portability-check.json` | Erneute Anmeldung und Admin-Übersicht nach Ablageverlagerung, geprüfte Konfigurationswege und Fixture-Hashes |
| `FRONTEND_MIGRATION.md` | Migration, Schutzmaßnahmen und Grenzen des Nachweises |

Alle drei Ansichten bestehen mit null Seitenfehlern, null Konsolenwarnungen/-fehlern, null fehlenden Ressourcen und null externen Abrufen. Die angemeldeten Ansichten zeigen genau eine native Übersicht. Benutzerverwaltung und Expertensteuerung folgen der vorgegebenen Rolle. Der Browser verwendet die versionierte Federation-Datei und die 15 versionierten öffentlichen EOS-Skripte.

Der kanonische vollständige Build wurde anschließend erfolgreich ausgeführt und erzeugte dieselbe Frontend-Bindung. Geprüfter Manifest-Hash: `f46e01154994d504c064a6351cb8ba4fc15beda450afb96adba1db16962739a9`. Quellbindung: `2723fbf3f7fa97d6312b1fde4c9d9a3d9a17e7d0312d4854be149849aaf6da2c`.

## Erneut ausführen

Voraussetzungen: Node.js 24, das vollständige EOS-Repository einschließlich des gebauten Verzeichnisses `adminWww`, Playwright 1.62.1 und ein dazu geeigneter Chromium-Browser. Browser und Testwerkzeuge werden separat installiert; sie gehören nicht zum ausgelieferten Adapter. Ein bereits vorhandenes `playwright` oder `playwright-core` wird über die normale Node-Modulauflösung gefunden. Alternativ zeigt `EOS_PLAYWRIGHT_MODULE` auf dessen absolutes Modulverzeichnis.

Beispiel für PowerShell im Repository-Wurzelverzeichnis, mit einer getrennten Werkzeugablage:

```powershell
$browserTools = Join-Path $env:TEMP 'eos-admin8-browser-tools'
npm install --prefix $browserTools --no-save --ignore-scripts playwright@1.62.1
$env:EOS_PLAYWRIGHT_MODULE = Join-Path $browserTools 'node_modules/playwright'
node (Join-Path $env:EOS_PLAYWRIGHT_MODULE 'cli.js') install chromium
node docs/security/admin8-2026-11-04/browser/browser-smoke.cjs
node docs/security/admin8-2026-11-04/browser/browser-smoke.cjs --overview
node docs/security/admin8-2026-11-04/browser/browser-smoke.cjs --enduser
```

Die Installation benötigt Netzverbindung. Die drei Browserläufe beantworten dagegen sämtliche HTTP- und WebSocket-Anfragen innerhalb des Prüfstands; externe HTTP-Anfragen werden gesperrt und als Fehler gewertet. Kein ioBroker-Dienst muss gestartet werden.

Ohne Parameter wird der Repository-Pfad aus dem Ablageort dieses Skripts ermittelt. Für eine andere Kopie:

```powershell
node docs/security/admin8-2026-11-04/browser/browser-smoke.cjs --root 'C:\Pruefung\ioBroker.eos.admin' --output 'C:\Pruefung\browser-neulauf' --overview
```

| Einstellung | Bedeutung |
| --- | --- |
| `--root` oder `EOS_ADMIN_ROOT` | Repository-Wurzel; darunter wird `adminWww` gelesen |
| `--output` oder `EOS_BROWSER_OUTPUT_ROOT` | Ausgabeordner; standardmäßig ein neues Unterverzeichnis `rerun` neben diesem Skript |
| `EOS_PLAYWRIGHT_MODULE` | Optionaler absoluter Pfad zu `playwright` oder `playwright-core` |
| `EOS_BROWSER_EXECUTABLE` | Optionaler absoluter Pfad zu einem vorhandenen Chromium-Browser; sonst Playwright-Standardbrowser |
| `EOS_BROWSER_PROFILE=sparticuz` | Nur für die unten dokumentierte Linux-Serverless-Binärdatei; aktiviert deren erforderliche Startargumente |

Die mitgelieferten ursprünglichen Screenshots und Protokolle werden bei normalen Neuläufen nicht überschrieben. Der Prozess endet mit einem Fehlercode bei abweichender Buildbindung, Seitenfehlern, fehlenden Ressourcen, unerwarteten Rollenanzeigen oder fehlerhaften Cache-URLs. Ein anderer Produktbuild benötigt eigene Nachweise; den erwarteten Hash nicht bloß anpassen, um einen fehlgeschlagenen Vergleich grün zu machen.

## Tatsächlich verwendete Browserumgebung

- Playwright: **1.62.1**.
- Chromium: **153.0.8010.0**, Linux x64.
- Browserpaket: **`@sparticuz/chromium@153.0.0`** aus `https://registry.npmjs.org/@sparticuz/chromium/-/chromium-153.0.0.tgz`.
- Geprüfte Archivintegrität: `sha512-jiGWqSvPMdu4+P9TilYqAR7yEGPEHINx+lCvE/NqNO/EHYzF/x1hUiI5T6ioVIt7dEy7n88byyT0vk+dnsgQwA==`.
- SHA-256 der tatsächlich ausgeführten entpackten Chromium-Datei: `53a15d6c3a3d27dfb54c4ba60278b1683136f70cf1e67e989da7dfbd3d451ef0`.
- Startprofil: `sparticuz`; Argumente stehen ausdrücklich im Prüfsystem. Dieses Profil verwendet `--no-sandbox` ausschließlich für den isolierten lokalen Browserprüfstand und ist keine Konfiguration für einen normalen Benutzerbrowser oder den Produktbetrieb.
- Die zugehörigen SwiftShader-Bibliotheken und Schriften wurden aus demselben Paket entpackt. Browser, Archive, Bibliotheken und `node_modules` sind bewusst nicht in diesem Ordner enthalten.

Das normale Playwright-CDN lieferte in der damaligen Prüfumgebung kein gültiges Browserarchiv. Deshalb wurde das festgelegte npm-Archiv bezogen und vor Entpacken gegen die Registry-SHA-512 geprüft. Die oben gezeigte Standardinstallation ist ein portabler Wiederholungsweg, kein Versprechen identischer Browserbytes. Bei anderem Betriebssystem, anderen Schriften oder anderem Browser sind pixelgleiche Screenshots nicht zu erwarten; die funktionalen Prüfungen bleiben dieselben.

Der portable Prüflauf wurde nach der Ablageverlagerung für Anmeldung und Admin-Übersicht erneut gegen dasselbe Artefakt mit dem dokumentierten Chromium ausgeführt. Standardpfad, expliziter Repository-Pfad, getrennte Ausgaben und beide Playwright-Auflösungswege bestanden. Die ursprünglichen drei Screenshot-Belege bleiben unverändert. Die PowerShell-Befehle sind eine Installationsanleitung; in diesem Linux-Prüfstand wurde kein Windows-Test durchgeführt.

Diese Belege sind keine IEC-Zertifizierung, keine vollständige CRA-Konformitätsbewertung und kein Ersatz für Installation, Backup/Rückfall und Funktionsprüfung auf Dominiques konkretem ioBroker-System.
