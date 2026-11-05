# Nachprüfung EasyAccess – EOS Admin 8.0.0

**Stand: 05.11.2026. Anwendungscode und Produktversion unverändert.** Diese Ergänzung setzt die bei der Admin-8-Migration offene Prüfung fort. Ausgangspunkt ist die vollständig bereitgestellte Repository-ZIP mit SHA-256 `c030f893e9f03b584e8ec3d107fbd5d5bf32cccffe72b11973c73628edacdb12`. Die 1.090 versiegelten Quell-/Laufzeitdateien und die Entwicklungstestbindung bleiben unverändert.

## Entscheidung und Geltungsbereich

**EOS-ADMIN8-CUSTOM-BUNDLE-001 ist für den vorliegenden Lieferstand geschlossen:** Die zuvor nicht nachvollzogene Herkunft und Zusammensetzung des vorgebauten EasyAccess-Bundles sowie seine Zuordnung zu aktuellen npm-Sicherheitsmeldungen sind jetzt belegt. Der tatsächliche Browserbetrieb wurde zusätzlich mit den mitgelieferten Bibliotheken und zusammen mit der geladenen EOS-Oberfläche geprüft.

Das schließt weder neue Funktionsbefunde noch die reale Zielsystemabnahme. Eine vollständige manuelle Prüfung jeder Zeile sämtlicher Fremdbibliotheken, Freiheit von unbekannten Schwachstellen, IEC-Zertifizierung und CRA-Konformität werden nicht behauptet. Allgemeine JSONConfig-Ausdrucks-/HTML-Funktionen bleiben die bereits beschriebene Vertrauensgrenze für installierte Adapter und ihre Konfigurationsmetadaten.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| Herkunft | Offizieller Tag `v3.0.8` und npm-`gitHead` stimmen auf Commit `ae303bdabc73c2588b1194d2f0c4951ac0d8b00e` überein. Registry-Tarball SHA-512 und alle 26 Lieferdateien entsprechen dem EOS-Paket. | `../../ea/EASY_ACCESS_SOURCE_REVIEW_DE.md`, Registry-/Vergleichsdateien |
| Signaturen | npm-eigene Prüfung Exit 0; keine ungültigen oder fehlenden Signaturen. SLSA-Nutzlast bindet Tarball, Commit und Hersteller-Build. | `../../ea/registry-signature-verification.json`, Attestate |
| Reproduktion | Offizieller Quellstand mit unverändertem Lock: 26 von 26 Dateien bytegleich; keine zusätzlichen oder abweichenden Dateien. | `../../ea/original-build-comparison.json` |
| Tatsächliche Bundle-Zuordnung | 12.089 Moduleinträge in 14 Chunks; 63 physische Paketinstallationen, keine unzugeordneten physischen Module. OXC-Runtime und 28 generierte Module samt Generatorherkunft zusätzlich erfasst. Beobachter verändert keine Produktbytes. | `../../ea/easy-access-bundle-inventory.json`, `easy-access-bom.cdx.json` |
| Advisory-Triage | Original-Buildbaum: 23 Paketmeldungen, davon 10 hoch und 13 mittel. Kein gemeldetes Paket trägt ein physisches Modul zum nachgewiesenen Browserbundle bei. Betroffene Node-Server-/Editor-/Typgeneratorpfade sind auch nicht Bestandteil des erzeugten Browserhilfscodes. Direkte Abfrage tatsächlicher Komponenten und Generatoren ist separat dokumentiert. | `../../ea/upstream-source-lock-audit.json`, Inventur und Bulk-Anfrage/-Antwort |
| Dateigraph und Fachlogik | Alle 15 JavaScript-Dateien parsebar; 12 vom produktiven Entry literal erreichbar, keine fehlenden/externen literalen Imports. Acht normale Fachlogikprüfungen am echten kompilierten Body bestanden, mit ausdrücklich ersetzten Framework-/Socket-Bindings. | `artifact/review-summary.json`, `artifact/behavior-review.json` |
| Echter Browser, eigenständige Komponente | Remote-Entry, echtes React/GUI/JSONConfig, drei Instanzzeilen, vier Checkboxen, beide Freigabelisten korrekt geändert; HTML in einer synthetischen Instanz-ID bleibt Text. Keine Konsolen-/Seitenfehler oder fehlenden/externen Ressourcen. | `browser/standalone-easyaccess-browser.json` |
| Echter Browser mit EOS-Host | Tatsächliche EOS-Oberfläche geladen; Remote-Komponente mit vorhandener Host-React-Laufzeit **19.3.1** gerendert. Gleiche Interaktionen und Fehlerfreiheit im beschriebenen Prüfstand. | `browser/host-easyaccess-browser.json` |

Browserumgebung: Linux x64, Node.js 24.22.1, Playwright 1.62.1 und Chromium 153.0.8010.0. Daten und Socket-Antworten sind synthetisch. Es wurde keine Kundenanlage verbunden und kein echtes Controllerobjekt gespeichert. Der Hosttest lädt und rendert die echte Komponente im gestarteten EOS-Frontend, automatisiert aber nicht den vollständigen Einstellungsdialog mit dessen Speichern am realen Controller. Der ursprüngliche lokale Build-/Publish-Dry-Run-Nachweis bleibt für den unveränderten Anwendungscode gültig; bei dieser Dokumentergänzung wurde nichts veröffentlicht oder erneut als neuer Produktbuild ausgegeben.

Eine erste zusätzliche Harnessprobe importierte irrtümlich den getrennten Demo-ReactDOM-Bootstrap der Remote-Komponente in den bereits gestarteten Host. Das erzeugte einen React-Versionskonflikt. Dieser Bootstrap gehört nicht zum statisch nachgewiesenen produktiven EasyAccess-Importgraphen. Der korrigierte Hosttest benutzt den tatsächlich vorhandenen Hostrenderer, wie beim Einbetten einer Komponente vorgesehen. Diagnose und Ursache bleiben in `browser/harness-diagnostic-demo-renderer.json` erhalten; der Fehler wurde nicht durch eine Produktänderung oder unterdrückte Prüfung verdeckt.

## Neue, weiterhin offene Funktionsbefunde

| Kennung | Priorität und Befund | Auswirkung / nächster Schritt |
| --- | --- | --- |
| EOS-ADMIN8-EASYACCESS-DISABLED-001 | P2: Die Fachklasse ignoriert das übergebene `_disabled` und lässt im isolierten Komponententest weiterhin Checkboxänderungen zu. | Kein nachgewiesener Backend-Rechtebypass; der aktuelle EOS-Schemaeintrag setzt selbst keine `disabled`-Bedingung. NexoWatt/Upstream: den deaktivierten Zustand im TSX-Quellstand an Checkboxen und Änderungsbehandlung weitergeben, anschließend realen Dialog nachprüfen. |
| EOS-ADMIN8-EASYACCESS-CONFIG-TYPE-001 | P2: Eine nicht-arrayförmige gespeicherte Freigabeliste verursacht einen Renderfehler. | Keine nachgewiesene Schreibmöglichkeit für unprivilegierte Remote-Nutzer. NexoWatt/Upstream: Typen vor Verwendung prüfen, beschädigte Werte sichtbar melden und erhalten, keine stillschweigende Bereinigung beim Speichern. |
| EOS-ADMIN8-EASYACCESS-LOAD-ERROR-001 | P2: Ein Fehler beim Lesen der Instanzen propagiert ohne eigenen lokalen Fehler-/Wiederholungszustand. | Übergeordnete Frameworkbehandlung ist nicht abschließend bewertet. NexoWatt/Upstream: begrenzten Fehlerzustand und manuelles Wiederholen im TSX-Quellstand ergänzen. |

Diese drei Fälle wurden am unveränderten kompilierten Fachklassenkörper reproduziert. Sie wurden in diesem Prüfschritt **nicht behoben**. Vor einer Erweiterung um schreibgeschützte Dialoge oder einer allgemeinen Kundenfreigabe sind Reichweite und Korrektur fachlich abzuarbeiten. Änderungen müssten aus nachvollziehbaren Quellen neu gebaut und geprüft werden; nachträgliche Manipulation komprimierter Bundles ist keine Lösung.

## Lieferkette und verbleibende Abnahme

Die gesicherten Drittanbietertexte und Herkunftsbelege stehen unter `../../ea/third-party/` und `license-provenance.json`. Vollständige Lizenztexte fehlen im jeweiligen Herstellerpaket weiterhin für `qrcode-generator` 2.0.4 und das native Build-Binding `@rolldown/binding-linux-x64-gnu` 1.2.7. Sie wurden nicht durch erfundene Texte ersetzt. Der bereits dokumentierte separate `size-sensor`-Restpunkt des Hauptfrontends bleibt ebenfalls bestehen.

Die reale Anlagenabnahme, Backup/Wiederherstellung, alle Rollen und Home-/Pro-Lizenzen auf dem Zielsystem behalten ihre bisherigen offenen Kennungen. Der technisch geprüfte Lieferstand ist damit weiterhin keine automatisch erteilte Serien- oder Kundenfreigabe. Für das Vorgehen gelten `START_HERE_8.0.0.md` und die bestehende Migrationsanleitung.

## Reproduzieren

Die Browseranleitung steht in `browser/README.md`. Der Quellreview enthält den gepinnten Upstream-Quellstand, Original-Lock und separate Inventurkonfiguration. Alle Dateien in `../../ea/` sind über `evidence-sha256.json` gebunden. Die Artefaktprüfung kann mit `node docs/security/admin8-2026-11-05/artifact/behavior-review.cjs` erneut ausgeführt werden; neue Ausgaben gehen standardmäßig nach `artifact/rerun/`. Dieses Harness ersetzt Framework/Socket ausdrücklich und ist keine Sandbox für fremden Code.

Für eine eigene Buildwiederholung `../../ea/upstream-source-proof/` zuerst in einen **separaten Prüfungsordner außerhalb des Releaseordners** kopieren. Dort mit dem mitgelieferten unveränderten Lock `npm ci --ignore-scripts --no-audit --no-fund` ausführen, anschließend die im Quellenbericht protokollierten `tasks.ts --0-clean`, `--2-compile` und `--3-copy`-Stufen. Für die beobachtete Inventur `../../ea/vite.config.inventory.ts` neben die Original-`vite.config.ts` dieser Prüfkopie kopieren und `node node_modules/vite/bin/vite.js build --config vite.config.inventory.ts` ausführen. Der Beobachter schreibt in den Elternordner. Danach sämtliche Lieferdateien gegen `admin/custom` vergleichen; ein erfolgreicher Build allein darf die vorhandene Hashbindung nicht ersetzen. Native Drittanbieter-Lifecycle-Skripte wurden für den dokumentierten Lauf nicht benötigt.
