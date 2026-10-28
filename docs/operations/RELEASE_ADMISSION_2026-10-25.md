# Lokale Veröffentlichungsprüfung und Integrationspakete

Die am 25.10.2026 bestätigte Lücke im lokalen Prüfablauf ist geschlossen:
`prepublishOnly` führt nach der Versionssynchronisation nun den tatsächlichen
Lock-Aufnahmecheck aus. `check:eos-release` beginnt ebenfalls mit diesem Check.
`check:eos-production-release` ruft `tools/nexowatt-lock-provenance-check.cjs`
auf; ein Selftest des Prüfers ersetzt diese Aufnahme nicht. Fehlende Dateien,
unvollständige Herkunft/Integrität oder Manifestabweichungen führen zu einem
Fehlerexit und unterbrechen die normale lokale Veröffentlichungskette.

Die vorhandenen 563 unvollständigen Backend-Lockeinträge wurden nicht künstlich
ergänzt. Produktveröffentlichung über diesen regulären Ablauf bleibt deshalb
gesperrt, bis die tatsächlichen Paketquellen und Integritätswerte kontrolliert
nachgetragen und geprüft sind. Das ist keine Aussage über 563 Schwachstellen.

`prepack` bleibt der Prüfer für das versiegelte Integrationsartefakt. Ein
vollständiges Repository-ZIP oder ein lokal erzeugtes Testpaket kann weiterhin
zur Prüfung geliefert werden. Solche Pakete sind kein Nachweis einer bestandenen
Produktaufnahme. Der Build, aktuelle Advisory-Abgleich, tatsächliche SBOM und
reale ioBroker-/Geräteintegration bleiben eigenständige Nachweise; der
Lock-Check allein bestätigt sie nicht.

`npm run test:eos-release-admission` prüft die echte Check-CLI am aktuellen
Repository und an isolierten Fixtures: vollständige Metadaten werden angenommen,
fehlende starke Integrität und eine fehlende Lockdatei abgewiesen. Zusätzlich
prüft der Test die Bindung an die lokalen Publish-/Release-Skripte und die
getrennte Paketierung. Es werden dabei weder Abhängigkeiten installiert noch
Pakete veröffentlicht.

Diese lokale Sicherung setzt einen vertrauenswürdigen Veröffentlichungspfad
voraus. Ein berechtigter Maintainer kann Quellcode oder npm-Optionen verändern;
gegen absichtliches Umgehen gehören eingeschränkte Veröffentlichungsrechte und
ein unabhängiger Releaseprozess hinzu. Der bisherige npm-Kanal `latest` wurde
durch diese Änderung nicht umgestellt.

## Systemweite Home-/Pro-Mengen

Die noch offene Mengenaggregation wird durch die Releaseprüfung nicht behoben.
Der aktuelle Lizenzdienst prüft je Anfrage die signierten Grenzen, kennt aber
keine systemweite, überschneidungsfreie Anlagenliste. Eine pauschale Reservierung
der angefragten Menge pro Instanz würde bestehende Adapter sperren, die dieselbe
Hardware abbilden, und ließe bei falsch angegebenen Mengen weiter Umgehungen zu.

Vor einer kompatiblen Umsetzung müssen die Verbraucheradapter gemeinsame stabile
Ressourcenkennungen, Besitz-/Mehrfachansichtsregeln und die autoritative
Anlagenkonfiguration liefern. Dann kann der Admin die eindeutigen Ressourcen
atomar zählen und bei Umkonfiguration, Neustart, verlorenem Kontakt oder
Lizenzwechsel neu prüfen. Jeder Verbraucher muss die Freigabe vor seinen
geschützten Betriebsbefehlen erzwingen und bei Verlust seinen gerätespezifischen
sicheren Zustand einnehmen. Die bestehenden NWL2-Schlüssel, Signaturen und
Home-/Pro-Claims werden für diese Auditkorrektur unverändert akzeptiert;
eine neue systemweite Durchsetzung wird damit nicht behauptet.
