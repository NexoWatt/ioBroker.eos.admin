# EOS Admin 8 – Frontend-Migration und Prüfung

Ausgangspunkt ist der vollständige EOS-Quellstand 7.10.12. Die ioBroker-Oberfläche wurde anhand des gemeinsamen Vorfahren Admin 7.9.2 dreiseitig auf den verifizierten offiziellen Stand 8.3.5 migriert. Der fehlgeschlagene frühere Admin-8-Versuch wurde nicht als Quellbasis verwendet.

- Gemeinsamer Vorfahr: `d5b9a4d11ed79cece0f097e0225a8aad72b68e6d` (Admin 7.9.2).
- Offizielle Admin-8-Basis: `6f77eedf525813a7a61d79188d1ff05dffd05086` (Admin 8.3.5).
- EOS-Produktversion: 8.0.0. Das ist von der offiziellen ioBroker-Basisversion zu unterscheiden.
- Der Merge-Bericht erfasst 588 Frontend-Pfade; eigene EOS-Dateien und Branding-Assets wurden erhalten und Konflikte in den React-Komponenten fachlich aufgelöst.

## Tatsächlicher neuer Build

Die Oberfläche wird aus React-19-Quellen mit `@iobroker/gui-components` 10.3.14 und Vite 8.3.5 erstellt. Es handelt sich nicht um eine Umbenennung alter Admin-7-Bündel. Die installierten Versionen sind im Lockfile festgelegt. Die zwei JSON-Editoren verwenden den bereits vorhandenen Ace-Editor; der nicht mit dem gewählten Monaco kompatible React-Wrapper und die ungenutzte direkte Monaco-Abhängigkeit wurden entfernt.

Der vollständige Frontend-Typecheck wird vor dem Vite-Build ausgeführt. `tasks.mts` lädt keine Dateien aus GitHub nach, synchronisiert keine Backend- und Frontend-Dateien anhand von Zeitstempeln, löscht keinen Backend-Build und installiert keine Pakete während des Builds. Abhängigkeiten müssen zuvor über die Lockfiles installiert sein. Nur ein vollständig erzeugter Frontend-Build wird nach `adminWww` kopiert.

Das Paket enthält die reguläre Vite-Dateiliste, das Module-Federation-Manifest und `NEXOWATT_EOS_FRONTEND_MANIFEST.json`. Letzteres bindet die Ausgabe an SHA-256-Hashes der Frontend-Quellen und erfasst tatsächliche Modulpfade, Abhängigkeiten und die von Module Federation erzeugten JavaScript-Startdateien. Die Startdatei wird erst vom vorhandenen EOS-Rollenbootstrap geladen. Ein ungeprüfter paralleler Moduleinstieg wird nicht in das ausgelieferte HTML geschrieben.

Die nicht gehashten öffentlichen JavaScript- und CSS-URLs bekommen beim Build einen zusätzlichen, an die Produktversion gebundenen `eos-release`-Parameter. Dadurch kann ein noch aus Admin 7 für ein Jahr gespeicherter Browserinhalt den neuen Einstieg nicht übernehmen. Auch der Socket-Loader und die tatsächliche Federation-Datei sind versioniert; `remoteEntry.js` bleibt nur als explizit erzeugte Kompatibilitätsweiterleitung bestehen.

Die separate EasyAccess-Konfigurationskomponente unter `admin/custom` wird weiterhin über `admin/jsonConfig.json5` verwendet. Sie stammt als bereits gebautes Fremdpaket aus der gelockten `@iobroker/admin-component-easy-access` 3.0.8 und ist kein Teil des neu kompilierten Hauptfrontends. Der abschließende Paketvergleich fand 146 übernommene Dateien aus der Admin-7-Basis, die beim bisherigen Zusammenkopieren liegen geblieben waren. Der Kopierschritt ersetzt jetzt ausschließlich das von diesem Paket verwaltete Verzeichnis `admin/custom` vollständig. Der tatsächliche Kopierlauf entfernte alle 146 Altdateien; die verbleibenden 26 Dateien stimmen bytegenau mit dem gelockten Paket überein. Alle 32 übrigen Dateien unter `admin` sowie das Hauptfrontendmanifest blieben unverändert. Beleg: `easy-access-packaging-cleanup.json`.

Die im EasyAccess-Federation-Manifest genannten Versionen GUI 10.2.1 und JSON Config 9.1.2 sind die Metadaten dieses separat vorgebauten Fremdpakets. Sie sind nicht die Quellabhängigkeiten des neuen EOS-Hauptfrontends. Welche gemeinsamen Module der separate Dialog tatsächlich zur Laufzeit auflöst, wurde nicht durch die drei Übersichts-/Login-Browserproben nachgewiesen; diese riefen keine `custom`-Ressource ab. Der Konfigurationsdialog benötigt einen eigenen Integrationstest. Der npm-Audit-Befund der installierten Abhängigkeiten darf nicht als vollständige Prüfung aller in diesem fremden Bundle enthaltenen Versionen ausgegeben werden.

## Erhaltene und angepasste Schutzfunktionen

- EOS-Rollenbootstrap, Rollenoberfläche, Lizenzverknüpfung, Kontoverwaltung, Basis-Einstellungen, EMS-Übersicht und Auto-Update-Oberfläche bleiben eingebunden.
- Die neue Admin-8-Systemeinstellungsschaltfläche und der Expertenmodus werden nach EOS-Rolle angezeigt; eine unbekannte Rolle wird nicht als Administrator behandelt.
- Objektbearbeitung verwendet den tatsächlichen Admin-8-Vertrag `notEditable` und die vorhandenen serverseitigen Rechte. Der ergänzende manuelle Schreibschutz wird vor dem Bundle aus geprüften GUI-Quelldateien eingearbeitet. Ein geänderter GUI-Stand ohne erneute Prüfung lässt den Build scheitern.
- Nachrichtenbedingungen bleiben reine Vergleiche mit begrenzten, nichtnegativen Ganzzahlen. Ausführbarer JavaScript-Text wird nicht für diese Bedingungen ausgewertet.
- Dokumentation wird mit `react-markdown` und GFM-Unterstützung gerendert. Fremdes HTML wird nicht ausgeführt, gefährliche URL-Schemata werden verworfen und externe Fenster erhalten keinen Opener-Zugriff. Dokumentabrufe erhalten eine tatsächliche Abbruchfrist von fünf Sekunden und eine Grenze von 2 MiB.
- Die direkten `new Function`-Pfade im Objekt- und Custom-Editor wurden entfernt. Eine begrenzte Syntaxprüfung und die Prüfung der Custom-Schemata erfolgen vor dem Aufruf des fremden Konfigurationsrenderers; ausführbare Regeln, nachladbare Custom-Komponenten, dynamische Select-Antworten und rohe HTML-Schalter werden an dieser Grenze gesperrt. Betroffene bestehende Werte bleiben erhalten; das Speichern betroffener Custom-Karten ist gesperrt.
- Die Kompatibilitätsoberfläche übergibt die Übersicht an den nativen React-Baustein. Ein Browserdurchlauf fand zunächst einen doppelten Übersichtsbereich; die Übergabe entfernt jetzt nur den alten, explizit markierten Kompatibilitätsknoten. Der alte EMS-Poller liest nicht parallel weiter, sobald die native Karte vorhanden ist.
- Die neue Admin-8-Systemübersicht wird als „Systemstatus“ benannt, damit sie nicht mit der bestehenden EOS-Übersicht verwechselt wird. Der EOS-Starteinstieg bleibt die Übersicht.

## Prüfnachweise

- Mehrere echte TypeScript- und Vite-Durchläufe erfolgreich, nach Einbau der neuen Quellen und der Sicherheitskorrekturen. Der abschließende vollständige Build ist in `../canonical-build.log` dokumentiert; er erzeugte dieselbe unten genannte Frontend-Bindung.
- Vollständiges Frontend-ESLint: 0 Fehler, 6 verbleibende Warnungen (bestehende Klassenmethoden, Hook-Abhängigkeiten und JSDoc). Ausgabe: `eslint-final.log`.
- `nexowatt-admin8-public-assets-selftest.mjs`: echte 7→8-Cache-URL-Unterscheidung, Bindung an die Buildversion, unveränderte gehashte und externe URLs.
- `nexowatt-admin8-overview-selftest.cjs`: tatsächliche Kompatibilitätsfunktionen geprüft; Übergabe an React, keine doppelte Kopfzeile und keine parallelen EMS-Leseaufrufe.
- Weitere Nachweise der zuständigen Teilprüfung: 55 ObjectBrowser-Interaktionsprüfungen, vier versions- und hashgebundene GUI-Transformationen, Markdown-SSR-/Lifecycle-Prüfungen und echte Streaming-/Abbruchprüfungen.

## Tatsächliche Browseransicht

Die Screenshots stammen aus der gebauten Produktionsoberfläche in Chromium 153.0.8010.0. Der Browser wurde über ein festgelegtes npm-Paket außerhalb des Produktprojekts bezogen; dessen SHA-512 wurde gegen die Registry-Metadaten geprüft. Das Standard-Playwright-CDN lieferte zuvor kein gültiges Browserarchiv.

Der lokale Browserprüfstand beantwortet HTTP- und WebSocket-Anfragen mit synthetischen Daten und benutzt keinen ioBroker-Zugang des Nutzers. Die Übersichtsseite trägt deshalb sichtbar „Vorschau · synthetische Testdaten“. Der unveränderte Produktionscode liest diese Daten über seine tatsächlichen Schnittstellen.

Der abschließende Durchlauf gegen den vollständig neu gebauten Stand besteht für Anmeldung, Admin-Übersicht und Endnutzer-Übersicht. Jede Ansicht hat null Seitenfehler, null Warnungen oder Fehler in der Browserkonsole, null fehlende Ressourcen und null externe Abrufe. In beiden angemeldeten Ansichten ist genau eine native Übersicht und kein alter Kompatibilitätskopf vorhanden. Benutzerverwaltung und Expertensteuerung sind für die Admin-Rolle sichtbar und für die Endnutzerrolle verborgen. Im ruhenden 1,2-Sekunden-Messfenster erfolgen ein EMS-Leseaufruf beim Admin und keiner beim Endnutzer. Alle 15 tatsächlich geladenen öffentlichen EOS-Skripte tragen `eos-release=8.0.0`; der Browser lädt ausschließlich die neue `remoteEntry-eos-8.0.0.js` als Federation-Einstieg.

Die drei PNG-Dateien wurden nach diesem Durchlauf visuell geprüft. Die tatsächlichen Browseransichten und ihre Hashes sind in `browser-verification-summary.json` dokumentiert; die Rohdaten stehen in `browser-login-result.json`, `browser-overview-result.json` und `browser-enduser-result.json`. Screenshots: `admin8-login-preview.png`, `admin8-overview-preview.png`, `admin8-enduser-preview.png`.

Bindung an den geprüften Build:

- Frontend-Manifest SHA-256: `f46e01154994d504c064a6351cb8ba4fc15beda450afb96adba1db16962739a9`.
- Frontend-Quellbindung: `2723fbf3f7fa97d6312b1fde4c9d9a3d9a17e7d0312d4854be149849aaf6da2c`.
- Tatsächlicher Start: `assets/mf-entry-bootstrap-0-a6a54377.js`.

Diese Nachweise ersetzen keinen Test auf der konkreten Anlage und sind weder eine IEC-Zertifizierung noch eine Behauptung vollständiger CRA-Konformität oder völliger Fehlerfreiheit.
