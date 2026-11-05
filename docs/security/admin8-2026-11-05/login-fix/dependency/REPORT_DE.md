# EOS-ADMIN8-DEP-001 – feste OAuth-Auflösung in der ausgelieferten Runtime

Stand: EOS Admin 8.0.1, 05.11.2026. Ergänzender Lieferkettenbefund. Der bestätigte Anmeldefehler wird durch die gesonderte Korrektur der Gruppenansicht behoben; OAuth 3 wurde nicht als Ursache dieses Anmeldefehlers nachgewiesen.

## Befund

Das offizielle Paket `@iobroker/webserver` 3.4.0 fordert `oauth2-server ^3.1.1`. Die npm-Override des EOS-Entwicklungsprojekts wird bei Installation von EOS als Dependency eines fremden npm-Projekts nicht automatisch übernommen. Ein isolierter Consumer erhielt deshalb OAuth 3.1.1 statt des im Entwicklungsprojekt geprüften Forks 5.3.1. Der alte Zweig funktionierte in der simulierten Anmeldung, erzeugte aber einen abweichenden Lieferstand und High-Auditbefunde. Die konkrete Ausnutzbarkeit jedes Advisories ist damit nicht nachgewiesen.

Der zunächst untersuchte verschachtelte `file:`-Archivansatz wurde verworfen. Die kleine Fixture hatte unbemerkt Zugriff auf einen außerhalb des Pakets verbliebenen Producer-Ordner. Die vollständige EOS-Paketinstallation scheiterte bei npm-Arborists Erstellung des Dependency-Baums vor Entpacken der inneren Datei mit ENOENT. Das Archiv war im äußeren Paket vorhanden. Wiederholung, ein Lifecycle-Hook oder ein vorangehendes `npm ci` beim Nutzer lösen dieses Reihenfolgeproblem nicht zuverlässig. Sämtliche Ergebnisse dieses Zwischenstands liegen ausdrücklich als verworfene Historie unter `rejected-file-dependency/`.

## Endgültige Änderung

Die vollständigen **39 Originaldateien** aus dem offiziellen WebServer-3.4.0-Paket werden direkt unter `src/lib/vendor/webserver/` sowie im ausgelieferten `build/lib/vendor/webserver/` geführt. Jede Datei einschließlich `package.json`, Lizenz, JavaScript und Typdeklarationen bleibt byteidentisch. Der Backend-Build kopiert nach TypeScript die Originaldateien erneut ins Laufzeitverzeichnis, damit der Compiler keine veränderten JavaScript- oder Map-Dateien ausliefert. `src/lib/web.ts` importiert dieses lokale Modul.

Der ursprüngliche `require('oauth2-server')`-Aufruf bleibt unverändert. Seine tatsächlich installierten Runtime-Abhängigkeiten deklariert EOS direkt im Root-Manifest:

| Dependency | Verbindlicher Manifestwert |
| --- | --- |
| oauth2-server | `npm:@node-oauth/oauth2-server@5.3.1` |
| jsonwebtoken | `9.0.3` |
| jwks-rsa | `4.1.0` |

Es gibt keine lokale `file:`-Dependency und kein verschachteltes Installationsarchiv mehr. Der enthaltene ursprüngliche WebServer-Paketmanifest beschreibt die Upstream-Distribution; sein Dependency-Feld wird nicht durch npm installiert. Maßgeblich sind EOS-Rootmanifest und Lockfile. Originale MIT-Lizenz und Paketmetadaten bleiben zur Herkunftszuordnung erhalten.

## Herkunft und Zulassung

`tools/vendor/webserver-3.4.0-source.provenance.json` enthält die offizielle Registry-Quelle und SHA512-Integrität, den SHA256-Wert des Originalarchivs, Einzeldateilängen und SHA256-Werte aller 39 Dateien sowie die genauen drei Registry-Lockeinträge. Das Originalarchiv `webserver-3.4.0-upstream.tgz` ist beigefügt. Sein SHA256 lautet `9da0473e723b0863ac1e1d2622e4ed268fa332d7f82448201692f213346ebf32`.

Der dependencyfreie Prüfhelfer `tools/nexowatt-vendored-webserver.cjs` bindet die Provenienzdatei selbst an einen festen SHA256-Wert. Für das Produkt `iobroker.eos-admin` prüft er unabhängig vom Vorhandensein eines Aliasmarkers die vollständigen Quell- und Laufzeitdateisätze sowie alle drei Manifest- und Lockeinträge. Fehlende oder zusätzliche Dateien, veränderte Bytes, symbolische Links, entfernte Alias-/Lockeinträge und Registry-Paketsubstitutionen sperren die Zulassung. Unbekannte lokale Dependencies bleiben durch das allgemeine Registry-Gate verboten. Die automatische Lockreparatur darf den Vendorbestand nicht umschreiben oder neu versiegeln.

Das Backend-SBOM enthält einen gesondert gekennzeichneten WebServer-Source-Vendor-Bestand mit Upstream-Archivhash und Provenienzdateihash. Das Artefaktinventar führt `vendoredBackend` mit Einzeldateinachweisen. Der Backend-Lock enthält keinen vorgetäuschten installierten `@iobroker/webserver`-Eintrag.

## Nachweise und Grenzen

`source-vendor-tests.json` und die beiden zugehörigen Rohlogs dokumentieren die gezielten Tests unter Node 22.23.4 und 24.22.1. Dazu gehören zehn Vendor-/Manipulationsfälle sowie HTTP-, Releasezulassungs- und Lockreparaturtests. Backend-Build, Lockprovenienzprüfung, SBOM-Erstellung und Artefaktinventar wurden mit der endgültigen Source-Vendor-Variante ausgeführt.

`http-consumer-check.cjs` ist die Probe für die anschließend tatsächlich installierte vollständige EOS-Paketdatei. Sie löst Express, EOS-Sitzungsschutz, WebServer und OAuth ausschließlich aus dem installierten Consumer-Paket auf. Geprüft werden gültige Anmeldung, falsches Passwort, Access-Lookup, Refresh und Widerruf beider Tokenarten nach Passwortänderung. Die Controller-Persistenz bleibt dabei simuliert; die Gruppenansicht verwendet einen Anzeigenamen in `row.id` und die kanonische Objekt-ID in `row.value._id`. Aufruf: `node http-consumer-check.cjs CONSUMER_ORDNER` (die ältere Form `REPO_ORDNER CONSUMER_ORDNER` bleibt kompatibel, der Producer-Pfad wird nicht verwendet).

Die Ergebnisse der vollständigen EOS-Consumerinstallation, des vollständigen Produktions-Audits und der finalen Paket-/Releaseprüfung werden im übergeordneten Login-Fix-Prüfbericht geführt. Die verworfenen kleinen Fixture-Consumer ersetzen diese Prüfungen ausdrücklich nicht. Keine reale Anlagen-, native Windows- oder IEC/CRA-Zertifizierungsprüfung; der Praxistest mit dem tatsächlichen ioBroker-Controller bleibt erforderlich.

Offizielle Grundlage zur Root-only-Wirkung von Overrides: https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#overrides . Offizielle Originalquelle: https://registry.npmjs.org/@iobroker/webserver/-/webserver-3.4.0.tgz .
