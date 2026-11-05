# Prüfung des direkten npm-Publish-Ablaufs – 25.10.2026

Geprüfter Änderungszweck: Aus VS Code genügt wieder `npm publish`; die zuvor separat nötige Reparatur ist Teil von `prepublishOnly`. Der bestehende Ablauf `repair:eos-lock` führt Reparatur, neues Referenzinventar/SBOM und Lock-Zulassungsprüfung mit `&&` aus. Ein zusätzliches Orchestrierungswerkzeug ist dafür nicht erforderlich.

## Ergebnis

- **2/2 neue Regressionstests bestanden**. Umgebung: Linux, Node.js 24.22.1 und npm 11.9.0. Rohdaten: `direct-publish-tests.log` und `direct-publish-tests.json`. Eingabebindung: `review-input-hashes.json`.
- Echte npm-Lifecycle-Ausführung ausschließlich mit `npm publish --dry-run`, leerer lokaler npm-Konfiguration und absichtlich unerreichbarer Loopback-Registry. Die Tests übernehmen die tatsächlichen `prepublishOnly`- und `repair:eos-lock`-Skripte aus dem Repository.
- Isolierte Fixture verwendet die echten Funktionen für Reparatur, Inventarerzeugung und Zulassungsprüfung. Registry-Metadaten sind injizierte Testdaten; die restlichen Produktprüfungen und `prepack` sind kontrollierte Marker. Deren fachliche Funktion wird dadurch nicht neu bestätigt.
- Fehlende Metadaten werden vor Inventar, Zulassung und Verpackungsphase ergänzt; genaue Paketversionen und restlicher Dependency-Baum bleiben gleich. Beide SBOM-Inventare enthalten danach keine fehlenden Integritätswerte.
- Zweiter Publish-Trockenlauf mit vollständig ergänzten Locks fragt keine Registry-Metadaten erneut ab und verändert die Locks nicht.
- Ein injizierter Registryfehler stoppt npm vor Inventar, Zulassung, weiteren Prüfungen und `prepack`; beide ursprünglichen Locks bleiben bytegleich und es entsteht kein Erfolgsbericht.

## Sicherheitsbewertung und Grenzen

Die Integration verändert die Sicherheitskriterien nicht und führt keinen Code-Neubau oder automatisches Neuversiegeln im Publish-Ablauf ein. Das Inventar liegt außerhalb der vom Prebuilt-Siegel überwachten Verzeichnisse, daher verursacht dessen normale Aktualisierung keine automatische Änderung des Produktsiegels. Die exakt gleichen Registry-, TLS-, Größen-, Zeit- und Konfliktprüfungen der vorhandenen Reparatur bleiben wirksam.

Der Test startet npm über seine JavaScript-CLI mit dem laufenden Node-Prozess, nicht durch direktes Spawnen von `npm.cmd`. Ein temporärer Pfad mit Leerzeichen wird genutzt. **Kein echter Windows-Lauf und kein tatsächlicher npm-Upload** wurden durchgeführt. Direkter Registryzugriff und die npm-Anmeldung/Versionverfügbarkeit auf dem Benutzerrechner bleiben getrennte Voraussetzungen; npm-Proxykonfiguration wird vom bestehenden Reparatur-HTTPS-Client nicht übernommen.

Die Prüfung ist eine interne Code- und Regressionstestprüfung; sie ist keine unabhängige Zertifizierung, vollständige Schwachstellenfreiheit oder IEC-/CRA-Konformitätsbescheinigung.
