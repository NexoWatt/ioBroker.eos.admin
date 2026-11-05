# EasyAccess-Artefaktprüfung, 05.11.2026

Geltungsbereich: unverändertes `admin/custom` aus EOS Admin 8.0.0. Ausschließlich lokale Quell-/Artefaktanalyse und isolierter Test der echten kompilierten Fachklasse; kein Browser- oder Backend-Rechte-Test und keine vollständige CVE-Prüfung. Repositorydateien wurden nicht verändert.

## Nachweise

- 26 Dateien vorhanden, 15 JavaScript-Dateien vollständig mit dem im Repository vendorten Acorn geparst: keine Syntaxfehler.
- 12 JavaScript-Dateien sind vom tatsächlich eingebundenen `customComponents.js` über statische und literal-dynamische Imports erreichbar. Keine fehlenden oder externen **literalen** Imports. Eine dynamische Importvariable in der erreichbaren JSONConfig-Federation-Laufzeit bleibt außerhalb dieses statischen Graphen. Drei weitere JS-Dateien gehören zum mitgelieferten Bootstrap/Demo-Bestand und werden von diesem Entry nicht literal referenziert.
- `Components-I39zZDnw.js` ist die 1.967-Byte-Fachklasse. Sie liest `getAdapterInstances`, bildet und sortiert eine Auswahlliste und gibt Änderungen an `accessAllowedConfigs` und `accessAllowedTabs` an `ConfigGeneric.onChange` weiter. Kein eigener Shell-, eval-, Raw-HTML- oder direkter Netzwerkpfad. Instanznamen werden als React-Kinder übergeben. Dies ersetzt keine Berechtigungsprüfung beim serverseitigen Speichern.
- Die Fachklasse importiert ihre Basisklasse und UI-Bindings direkt aus den großen mitgelieferten GUI-/JSONConfig-Chunks. Die Behauptung, diese vorgebauten Bibliotheken seien wegen Host-Sharing grundsätzlich irrelevant, wäre falsch. Welche Implementierungen nach Live-Rebinding tatsächlich verwendet werden, verlangt den Browsernachweis.
- React/ReactDOM 19.2.8 sind zusätzlich zur Federation-Deklaration als tatsächliche Code-Versionszuweisungen gefunden. Weitere konkrete Marker im JSONConfig-Chunk: Federation-Hostlaufzeit 2.9.0, Ace `ace/config` 1.44.0. Manifestangaben zu GUI 10.2.1, JSONConfig 9.1.2 und MUI 9.4.0 sind weiterhin Herstellerangaben, keine vollständige Inhaltszuordnung.

## Konkrete Restbefunde

1. **P2, UI-Verhalten:** `renderItem(_error, _disabled, _defaultValue)` ignoriert `_disabled`. Im isolierten Test des originalen kompilierten Klassenkörpers bleiben alle drei Checkboxen ohne `disabled=true`; ein Klick ruft trotz `renderItem(false,true)` `onChange` auf. Das ist eine Verletzung des UI-Vertrags, **kein nachgewiesener Backend-ACL-Bypass**. Der aktuelle EOS-Schemaeintrag setzt selbst keine `disabled`-Bedingung; die reale Reichweite ist deshalb mit dem Dialog zu prüfen.
2. **P2, Robustheit:** Eine gespeicherte nicht-arrayförmige Allowlist löst beim Rendern `TypeError: h.includes is not a function` aus. Ein Fehler von `getAdapterInstances()` propagiert aus dem eigenen `componentDidMount()` ohne lokale Fehler-/Retryanzeige. Keine Behauptung, ein unprivilegierter Remote-Nutzer könne solche Daten schreiben; übergeordnete Framework-Fehlerbehandlung wurde nicht mitgetestet.
3. **Offene Vertrauens-/Inventurgrenze:** Erreichbare Vendor-Dateien enthalten unter anderem `Function`-/`AsyncFunction`-Schemaauswertung, dynamisches Laden und vier Raw-HTML-Konfigurationstypen. Der fachliche EasyAccess-Code führt diese Pfade nicht selbst auf. Die vorhandene Vertrauensgrenze für allgemeine JSONConfig-Schemata bleibt daher relevant; aus dem reinen API-Vorkommen folgt noch keine ausnutzbare Lücke dieser konkreten EasyAccess-Seite.

## Abhängigkeitshinweise

Die vom Quellenreview genannten Forge-/Axios-/Zod-Advisories dürfen nicht allein aus dem Upstream-Entwicklungslock auf das Laufzeitpaket übertragen werden. In den drei großen gelieferten LoadShare-Chunks wurden keine charakteristischen Literale für `forge`/`node-forge`/`PKCS`/`createCertificate`, `AxiosError`/`axios`/`isAxiosError` oder `Zod`/`zod` gefunden. Das ist **kein positiver Einbindungsbeleg und kein vollständiger Ausschlussbeweis**. Numerische Suchtreffer wie `1.18.0` und `1.4.0` waren SVG-Pfadkoordinaten und dürfen nicht als Versionsbeleg verwendet werden.

## Was sich damit schließen lässt

Syntax und der literale Dateigraph sind nachvollziehbar; acht normale Fachlogikprüfungen bestehen, und die drei oben beschriebenen Fehlerreaktionen sind reproduziert. Die Herkunfts-/Bytegleichheitsbelege des parallelen Quellenreviews ergänzen diese Analyse. `EOS-ADMIN8-CUSTOM-BUNDLE-001` kann damit präzisiert, aber nicht vollständig geschlossen werden: vollständige Bundle-Komposition, gezielte CVE-Zuordnung und Browserintegration der tatsächlich verwendeten Bibliotheken bleiben eigene Nachweise. Sinnvoller nächster Schritt ist eine Korrektur im nachvollziehbaren TSX-Quellstand, anschließend reproduzierbarer Build mit Bundle-Inventur und gezieltem Dialogtest; keine nachträgliche Minified-Bundle-Manipulation.

## Dateien

`analyze.cjs` / `static-review.json`: vollständige AST-Kandidaten und Dateigraph. `review-summary.json`: begrenzter, übernehmbarer Graph-/API-/Versionsbeleg. `behavior-review.cjs` / `behavior-review.json`: originaler kompilierter Komponentenbody mit ausdrücklich ersetzten Framework-/Socket-Bindings, acht bestandene Normalfall-Assertions und die getrennt erfassten Fehlerfälle. Das Testharness ist keine Sandboxempfehlung und führt ausschließlich den eigenen unveränderten gelieferten Komponentenbody aus.
