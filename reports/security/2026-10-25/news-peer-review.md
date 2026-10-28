# Unabhängiger Review des News-Sicherheitsfixes

Prüfdatum: 25.10.2026. Geprüft wurden src/lib/eosNewsSecurity.js, src-admin/src/helpers/eosNewsSecurity.ts, die betroffenen Aufrufe in src/main.ts/NewsAdminDialog.tsx, tools/nexowatt-news-security-patch.cjs und test/eos-news-security.test.cjs. Kein Live-System und kein vollständiger Browser-End-to-End-Test.

## Ergebnis

Der neue Parser beseitigt die geprüfte Ausführung von News-Daten als JavaScript. Er erlaubt ausschließlich einen der Operatoren <, <=, >, >=, ==, ===, !=, !== und eine nichtnegative sichere Ganzzahl. Führende/nachfolgende Leerzeichen bleiben möglich; JavaScript-Ausdrücke, negative/dezimale/exponentielle Werte, führende Nullen, überlange Eingaben und falsche Typen werden abgelehnt. Die beabsichtigte dokumentierte Form, etwa >= 15000, bleibt erhalten. Frontend und Backend liefern für die geprüften Positiv- und Negativfälle dieselben Ergebnisse. Die Funktion ist lokal konstant begrenzt und benutzt weder eval noch dynamische Codeerzeugung.

Der neue Node-Release-Abruf verwendet den bestehenden begrenzten HTTPS-Client mit festem Host nodejs.org, 2 MiB Antwortgrenze und 5 Sekunden Netzwerkbudget. Der Validator begrenzt die Liste auf höchstens 5000 Einträge und übernimmt nur begrenzte version/npm-Zeichenfolgen. Ungültige Einträge werden ausgelassen; ungültige Top-Level-Strukturen werden verworfen. Diese Änderung ist für die lesende Versionsanzeige geeignet; sie belegt keine vollständige semantische SemVer-Validierung jedes zugelassenen Prerelease-Strings.

## Beim Review gefundene und behobene Auslieferungslücke

Die ursprüngliche Änderung schrieb den Frontend-Bootstrap unter unverändertem Dateinamen bootstrap-COulQZax-v84.js. Bei aktiviertem settings.cache können Blattmodule rund 356 Tage frisch im Browsercache bleiben; frische HTML-Einstiegsseiten allein erzwingen dann kein erneutes Laden dieses Moduls. Damit konnte ein aktualisiertes Backend weiterhin mit einem gecachten Frontend mit eval verwendet werden.

Auf ausdrücklichen Folgeauftrag wurde der komplette betroffene Runtime-Namensraum von v84 auf v85 angehoben: 21 Module umbenannt, zugehörige URL-/Import-/Preload-/Manifestreferenzen umgeschrieben, runtimeEntry aktualisiert. Die drei aktiven Regressionstests mit festen v84-Pfaden lesen jetzt runtimeEntry aus der Build-Info. Historische, nicht aktive versionsgebundene Tests und SVG-Koordinaten wurden nicht global ersetzt. Im aktiven Graph gab es keinen unverändert benannten Importeur eines umbenannten Moduls. Die Mutation ist im cache-bust-v85-provenance.json mit Vorher-/Nachher-Hashes dokumentiert. Kein vollständiger Frontend-Neubuild wird behauptet.

## Prüfungen

Ausgeführt unter Node.js v24.22.1:
- Parser- und Frontend-Parität, echter ausgelieferter Frontend-Ausdruck, begrenztes Node-Index-Schema: 3 gezielt ausgewählte Tests bestanden.
- Frontend-Graph: bestanden, 208 erreichbare JavaScript-Dateien, genau ein HTML5-Backend.
- Importintegrität inklusive Vite-Preload-Arrays: bestanden.
- Syntax aller ausgelieferten Frontend-Module und klassischen Skripte: bestanden.
- Einstiegskette: bestanden, 16 Skripte plus rollenabhängiger Anwendungseinstieg, Runtime v85.
- Laufzeitbereinigungstest: bestanden.
- Aktive Rollen- und UI-Overview-Regressionen: bestanden.
- Stable-v7103-Regression konnte die v85-Datei nach Anpassung lesen, meldete danach Versionsdrift während der parallelen 7.10.12-Metadatensynchronisierung; dies muss der abschließende Hauptlauf auflösen.

Der Test für die tatsächlich neu emittierte Backend-Methode wurde hier absichtlich nicht mit dem zu Beginn noch alten Build als bestanden ausgegeben; der Hauptagent emittiert und prüft den abschließenden Build.

## Abgrenzungen und kleine Restpunkte

1. Der Parser selbst weist falsche Typen zurück. Der aufrufende Legacy-Code behandelt falsche Werte wie leerer String, false, 0 oder null jedoch weiterhin als fehlenden optionalen Filter, weil er die Funktion nur bei einem wahrheitswertigen Feld aufruft. In einem isolierten Test der aktuellen Source-Methode wurden solche Nachrichten angezeigt. Das ist keine erneute Codeausführung; für eine strengere Feed-Schema-Regel sollte zwischen fehlendem und vorhandenem ungültigem Feld unterschieden werden.
2. Das Patchwerkzeug kann bei null Ersetzungen ohne bereits vorhandenen sicheren Ausdruck erfolgreich enden. Der aktuelle Test am ausgelieferten Bundle deckt dies auf; als zusätzliche Werkzeughärtung wäre eine ausdrückliche Known-safe-/Replacement-Nachbedingung sinnvoll.
3. stripTypeScriptTypes im Test setzt einen neueren Node-Testläufer voraus. Der hier dokumentierte Lauf auf Node 24.22.1 belegt keine Ausführung des Tests auf jedem im Paket zugelassenen Node-22-Patchstand.
4. Bereits geöffnete Tabs führen ihren schon geladenen Code weiter aus. Nach dem Update ist ein vollständiges Neuladen bzw. Schließen und erneutes Öffnen der Oberfläche erforderlich. Der neue v85-Namensraum verhindert beim neuen Einstieg die Wiederverwendung der alten v84-Module; ein echter Browser mit vorgewärmtem Cache wurde hier nicht gestartet.

Keine Aussage über Lückenfreiheit, IEC-Zertifizierung oder vollständige CRA-Konformität.


## Abschlussnachtrag des Integrators

Die Punkte 1 und 2 wurden vor dem Endlauf korrigiert: vorhandene ungültige Newsfelder werden abgewiesen und das Patchwerkzeug verlangt einen bekannten sicheren Ausdruck. Auch die echte Backendmethode und der vollständige Stabilitätslauf inklusive stable-v7103 bestanden nach Versionssynchronisation. Maßgeblich: fixed-raw/stability-final.log. Node-22- und warmer Browsercache-End-to-End-Nachweise bleiben offen.
