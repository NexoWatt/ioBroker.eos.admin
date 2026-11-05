# Drittanbietertexte für Admin 8

Dieses Verzeichnis enthält unverändert übernommene LICENSE-, NOTICE-, COPYING- und COPYRIGHT-Dateien der im Vite-Build identifizierten Frontend-Pakete sowie des eingesetzten OAuth-Forks und Acorn. `NOTICE-PROVENANCE.json` nennt Paketversion, npm-Herkunft, Paketintegrität, Quelldatei und SHA-256 jeder beigefügten Datei.

Fehlte der Text im npm-Tarball, wurden für vier Pakete die Lizenzdateien aus dem in den npm-Release-Metadaten genannten exakten Git-Commit übernommen. Die UTF-8-Dateien stimmen mit dem Git-Blob-SHA überein. Die Nachweise stehen in `UPSTREAM-NOTICE-SOURCES.json` und `NPM-RELEASE-METADATA.json`.

Eine offene Einschränkung bleibt bei **size-sensor 1.0.2**: Sowohl das installierte Paket als auch dessen exakter Release-Commit enthalten lediglich die ISC-Zuordnung zu `hustcc` im README, keinen vollständigen Lizenztext. Dieses ursprüngliche README ist beigefügt; die fehlenden vollständigen Bedingungen werden nicht durch eine erfundene Hersteller-Lizenzdatei ersetzt. Die Lizenzzuordnung im Paketmanifest und die vorhandene Autorenangabe bleiben nachvollziehbar. Diese Sammlung ist keine rechtliche Konformitätsbestätigung.

Zur erneuten Bestandsaufnahme nach einem endgültigen Frontend-Build zuerst die Lock-Inventur und anschließend das Artefaktwerkzeug ausführen:

```sh
npm run security:inventory
node tools/nexowatt-artifact-inventory.cjs
```

Das zweite Werkzeug arbeitet ohne Netzwerkzugriff. Es überprüft gespeicherte ergänzende Quellen gegen Hash, Git-Blob und aktuelle Paketintegrität, erfasst die tatsächlich installierten Paketversionen und ordnet die vom Vite-Manifest gemeldeten Module den tatsächlichen Ausgabedateien zu. Laufzeitseitig geladene fremde Adapter bzw. Module-Federation-Anbieter benötigen eigene Nachweise.
