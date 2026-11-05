# Admin 8 – Abhängigkeiten und Lieferkette

Prüfstand: 4. November 2026. Ausgangspunkt ist der echte ioBroker Admin 8.3.5, Commit `6f77eedf525813a7a61d79188d1ff05dffd05086`. Die Prüfung erfolgte mit Node.js 24.22.1 und npm 11.9.0. Es wurde kein Paket veröffentlicht.

## Ergebnis der aktuellen npm-Prüfung

| Umfang | Kritisch | Hoch | Mittel | Niedrig |
| --- | ---: | ---: | ---: | ---: |
| Backend, nur Produktionsabhängigkeiten | 0 | 0 | 0 | 0 |
| Frontend, gesamter Abhängigkeitsbaum einschließlich Build-Werkzeugen | 0 | 0 | 0 | 0 |
| Backend, einschließlich Entwicklung/Test/Lint | 0 | 0 | 15 | 0 |

**Prüfgrenze der Nullbefunde:** Die npm-Ergebnisse gelten ausschließlich für die aktuellen Lockdateien `package-lock.json` (Produktionsabhängigkeiten) und `src-admin/package-lock.json` (gesamter Baum). Die ergänzende Frontend-Paketzuordnung betrifft das neu gebaute `adminWww` einschließlich des ausdrücklich verifizierten lokal beigefügten Acorn-Parsers. Das getrennte, vorgebaute **`admin/custom` ist von diesem Nullbefund ausdrücklich ausgenommen**. Dessen Paket- und Dateiherkunft ist unten gesondert beschrieben; eine vollständige Bibliotheks-/CVE-Zuordnung des vorgebauten Codes wurde nicht durchgeführt.

Die 15 mittleren Backend-Meldungen sind keine 15 unterschiedlichen Sicherheitslücken. npm führt zusätzlich die betroffenen übergeordneten Pakete auf. Es verbleiben drei bekannte Befunde ausschließlich in Entwicklungswerkzeugen:

- `esbuild` 0.11.23: Zugriff auf einen laufenden Entwicklungsserver durch fremde Webseiten, GHSA-67mh-4wv8-2f99. Der Produktionsadapter startet diesen Server nicht; die alte Version wird durch das geerbte Testwerkzeug eingebunden.
- `glob` 13.0.6: Dateisystemsuche kann trotz abgebrochenem AbortSignal weiterlaufen, GHSA-3g3m-2fjr-6pw4. Betroffen sind geerbte Build-/Testwerkzeuge.
- `minimatch` 10.x: Ressourcenverbrauch bei speziell konstruierten Globmustern, GHSA-g3hv-75wg-m249. Betroffen sind Lint-/Build-/Testwerkzeuge; der bisherige Produktionspfad über `archiver` wurde vollständig entfernt.

Diese Restbefunde sind offen dokumentiert. Ungeprüfte fremde Projekte, Dateibäume und Globmuster sollen nicht im vertrauenswürdigen Release-Arbeitsverzeichnis verarbeitet werden. Ein Toolchain-Wechsel über mehrere Hauptversionen wurde nicht allein zum Unterdrücken der Scanneranzeige erzwungen. Die npm-Prüfung beweist weder Lückenfreiheit noch IEC-/CRA-Konformität.

## Durchgeführte Änderungen

- Das veraltete `oauth2-server` 3.1.1 wurde innerhalb von `@iobroker/webserver` durch den gepflegten, exakt gebundenen npm-Alias `@node-oauth/oauth2-server` 5.3.1 ersetzt. Der Fork erhält die verwendeten Konstruktoren und die Benutzerobjekt-Identität für die EOS-Sitzungsprüfung. Der bisherige gefährdete Lodash-/Bluebird-Unterbaum entfällt. Die zugehörigen HTTP-Regressionstests für Anmeldung, Refresh, Wiederverwendung, falsche Zugangsdaten und Sitzungswiderruf werden im Hauptprüfbericht nachgewiesen.
- Nicht mehr verwendete Pakete wurden entfernt: Backend `archiver` und dessen Typen; Frontend `react-monaco-editor`, `monaco-editor`, `react-showdown` und `@originjs/vite-plugin-commonjs`. Die Oberfläche verwendet die vorhandenen Ace-/Markdown-Komponenten. Das tatsächlich verwendete `vite-plugin-commonjs` bleibt erhalten.
- Backend-Sicherheitsbindungen: `node-forge` 1.4.3, `@grpc/grpc-js` 1.14.5, `fast-uri` 3.1.9, `follow-redirects` 1.16.2, `probe-image-size` 7.5.0, `js-yaml` 4.3.2/5.4.2 sowie gezielte kompatible Patches für Brace Expansion, AJV, HumanFS, Serialize JavaScript und die neuere esbuild-Linie.
- Frontend-Sicherheitsbindungen: zusätzlich Axios 1.20.0, Undici 7.30.1, Browserslist 4.28.7, Baseline Browser Mapping 2.11.3, Picomatch 2.3.2 im Micromatch-Unterbaum, YAML 1.10.3 im Cosmiconfig-Unterbaum und Babel Core 7.29.13.
- `@iobroker/types` ist auf die stabile Version 7.2.5 gebunden. Der bisherige Alpha-Typensatz löste einen echten Peer-Konflikt aus. Das inkompatible Monaco-Wrapper-Peer wurde durch die Komponentenportierung beseitigt. Weder `--force` noch `--legacy-peer-deps` wurden eingesetzt.
- `acorn` 8.17.0 ist nun eine ausdrücklich deklarierte Entwicklungsabhängigkeit für die syntaktische Prüfung echter JavaScript-Imports im Auslieferungsmanifest; keine zusätzliche Laufzeitabhängigkeit.

## Installation und Nachweisgrenzen

Beide Abhängigkeitsbäume wurden tatsächlich mit npm installiert. Fremde Installationsskripte waren dabei ausdrücklich deaktiviert (`--ignore-scripts`). Die nachfolgenden realen TypeScript-/Vite-/HTTP-Prüfungen sind separat im Hauptprüfbericht dokumentiert. Daraus folgt kein Nachweis eines vollständigen ioBroker-Starts mit allen optionalen nativen Modulen auf Windows.

Das ursprüngliche Backend-Lockfile enthielt 334 Pakete ohne vollständige Herkunfts- und Integritätsangaben. npm ergänzte diese Informationen bei Installation nicht zuverlässig. Die ergänzende Reparatur ändert ausschließlich fehlende `resolved`-/`integrity`-Felder für bereits festgelegte exakte Versionen. Paketidentität, Version, SHA-512-Format und offizielle npm-Tarballadresse werden vor jeder Übernahme geprüft. Versionsänderungen durch die Sicherheitsupdates sind davon getrennt.

Die Entwicklungsumgebung konnte direkte native HTTPS-Abfragen zum npm-Register nicht abschließen; ein leerer isolierter npm-Cache bestätigte dagegen erfolgreichen echten Registerzugriff über npm. Deshalb wurde ausschließlich in der Entwicklungsprüfung der npm-CLI-Transport verwendet. TLS-Prüfung blieb eingeschaltet (`strict-ssl=true`). Jede vollständige öffentliche Antwort wurde gehasht; bereits validierte Antworten dürfen bei einem begrenzten Wiederholungsversuch anhand ihres gespeicherten Hashes wiederverwendet werden. Dies wird ausdrücklich als Wiederverwendung und nicht als erneuter Netzabruf protokolliert. Der Produkttransport wurde dadurch nicht verändert.

Die maschinenlesbaren Audit-, Metadaten- und Tarballnachweise in diesem Verzeichnis sind maßgeblich. Die Tarballprüfung kontrolliert die tatsächlichen zwischengespeicherten Paketbytes anhand des SHA-512-Werts und die installierte Paketidentität. Sie ist kein Publisher-Attest und kein vollständiger Dateivergleich jeder entpackten `node_modules`-Datei.

## Ergänzende Artefakt- und Lizenzinventur

`node tools/nexowatt-artifact-inventory.cjs` ergänzt die Lock-Inventur um tatsächlich installierte Paketmanifeste und SHA-256 der gebauten Frontend-Chunks. Im geprüften Stand wurden 747 Backend- und 559 Frontend-Pakete tatsächlich vorgefunden; 26/23 weitere Lock-Einträge sind plattformabhängige optionale Pakete. 72 Frontend-Chunks melden 13.943 Modulzuordnungen zu 168 Paketinstallationen. Keine gemeldete Paketzuordnung blieb ungeklärt. Der jeweils neu erzeugte `reports/security/artifact-inventory.json` ist nach weiteren Builds maßgeblich.

Die Lock-Inventur enthält weiterhin 6 Backend- und 22 Frontend-Verweise ohne aufgelösten Zielknoten. Alle 28 wurden anhand der tatsächlich installierten Paketmanifeste als ausdrücklich optionale Peer-Abhängigkeiten bestätigt. Sie werden als offen ausgewiesen, nicht aus dem SBOM-Bericht entfernt. Der Bericht ist daher keine Behauptung eines vollständig geschlossenen universellen Abhängigkeitsgraphen.

Die beigefügten Drittanbieter-Lizenztexte und deren Herkunft stehen unter `docs/third-party/admin8/`. Bei size-sensor 1.0.2 bleibt die dort ausdrücklich beschriebene Lücke eines vollständigen upstream-Lizenztexts offen; die originale ISC-Zuordnung im README wurde gesichert.


## Getrennte Prüfgrenze: vorgebautes EasyAccess unter admin/custom

`@iobroker/admin-component-easy-access` **3.0.8** liefert ein eigenes, vorgebautes EasyAccess-Modul für `admin/custom`. Seine npm-Paketidentität, offizielle Tarballadresse und SHA-512 sind im Backend-Lock gebunden. Die Prüfung der aktiven Dateien gegen das installierte gelockte Paket belegt ihre Herkunft; sie ersetzt keine Sicherheitsprüfung aller darin eingebetteten Bibliotheken. Der konkrete nach der Bereinigung erhobene Datei-/Hashvergleich steht in `easy-access-prebuilt-scope.json`.

Das vom Hersteller mitgelieferte `mf-manifest.json` deklariert unter anderem GUI Components 10.2.1, JSON Config 9.1.2 und React 19.2.8. Dies sind **Herstellerangaben zum Build bzw. Module-Federation-Sharing**, keine unabhängig vollständige Paketzuordnung und kein Beweis, welche Version der gemeinsame Provider zur Laufzeit tatsächlich auswählt.

Nachprüfung vom 05.11.2026: Die zuvor offene Herkunfts-/Bibliothekszuordnung wurde durch offiziellen Source-/Signaturnachweis, bytegleichen Nachbau und tatsächliche Moduleinventur ergänzt. 63 physische Paketinstallationen plus gesondert erfasste generierte Helfer sind zugeordnet. Die 23 Meldungen des Original-Buildbaums und eine direkte Advisoryabfrage der tatsächlichen Versionen wurden gegen die ausgelieferten Module bewertet. Echte Browserprüfungen bestanden auch mit geladenem EOS-Host. `EOS-ADMIN8-CUSTOM-BUNDLE-001` ist für diesen konkreten Nachweis geschlossen; neue P2-Funktionsbefunde, vollständiger Dialog-/Speicherablauf am realen Controller und Anlagenabnahme bleiben offen. Der Audit-0-Befund der beiden EOS-Locks bleibt auf diese Locks beschränkt. Keine Zertifizierung oder Garantie unbekannter Fehlerfreiheit.

Siehe `docs/security/admin8-2026-11-05/EASYACCESS_FOLLOWUP_DE.md` und die Inventur/CycloneDX-Liste unter `docs/ea/` einschließlich Lizenz- und Generatorgrenzen. Der vollständige Anwendungs- und Buildstand wurde bei dieser Nachprüfung nicht verändert. Der Nachweisordner wurde am 05.11.2026 für kürzere Windows-Pfade verschoben.
