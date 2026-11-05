# Prüfung des npm-Abbruchs – 25.10.2026

Prüfgegenstand vor Reparatur: EOS Admin 7.10.12 aus der zuletzt gelieferten ZIP.
Der vom Nutzer gezeigte Logausschnitt nennt den gesamten fehlgeschlagenen
`prepublishOnly`-Befehl, nicht die konkrete Teilzeile. Das zugehörige Repository
reproduziert einen vorgesehenen Abbruch in `check:eos-production-release`.

## Ursache

Der Backend-Lock enthält 563 Paketorte ohne `resolved` und ohne starke
`integrity`; daraus entstehen 1.126 Meldungen. Der Frontend-Lock hat dafür keine
Meldungen. Es handelt sich um fehlende Lieferkettenmetadaten, nicht um 563 CVEs
und nicht um einen belegten npm-Anmelde- oder 2FA-Fehler. Unvollständig sind auch
die direkten Laufzeitabhängigkeiten compression 1.8.1, cookie-parser 1.4.7,
express-fileupload 1.5.2, json5 2.2.3 und mime 3.0.0.

Die 563 Orte entsprechen 532 eindeutigen wirklichen Paketnamen/-versionen.
Drei Aliasorte müssen nach `entry.name` aufgelöst werden: string-width-cjs →
string-width 4.2.3, strip-ansi-cjs → strip-ansi 6.0.1 und wrap-ansi-cjs →
wrap-ansi 7.0.0. Ein einfacher Paketname aus dem Installationsordner wäre falsch.
128 Orte stimmen nach Namen/Version mit vollständigen Frontend-Lockeinträgen
überein. Das Kopieren wäre jedoch nur Metadatenwiederverwendung, kein neuer
Registry- oder Byteprüfnachweis.

## Korrekte Grenze der Reparatur

Der Aufnahmecheck verlangt gültige Lockstruktur, Manifestgleichheit, starke
SRI-Prüfsumme und HTTPS-Tarballherkunft von registry.npmjs.org. Links und andere
Registries sind bewusst nicht freigegeben. Für diesen Lock wurden keine
fälschlich als Link oder optionale Leermetadaten erkannten Einträge gefunden.

Die kleinste geeignete Änderung ist eine Ergänzung fehlender Herkunfts-/SRI-
Felder für die schon exakt festgelegten Versionen, ohne neue Versionen,
Abhängigkeitskanten, Codeänderungen oder automatisches Neuversiegeln. Abweichende
bereits vorhandene Werte dürfen nicht still überschrieben werden. Metadaten
müssen vom festen offiziellen HTTPS-Endpunkt kommen und mit Namen/Version und
zulässigem Tarballziel geprüft werden. Alle Abfragen müssen vor dem ersten
Lockschreibvorgang erfolgreich sein; Sicherung, Änderungsschutz und Prüfbericht
sind nötig. Ein Registry-Timeout darf keinen teilweise reparierten Baum erzeugen.

Der Editor hat inzwischen festgestellt, dass ein zuerst erfolgreicher `npm view`
aus dem Cache kam; nicht gecachte Registry-Abfragen sind in dieser Umgebung
fehlgeschlagen. Deshalb kann hier kein erfolgreicher aktueller Registryabgleich
oder vervollständigter Lock behauptet werden. Die lokale Reparatur muss im
erreichbaren Netz des Nutzers laufen und auf Fehler mit unverändertem Lock enden.

Ein anschließendes `npm ci --ignore-scripts --no-audit --no-fund` in isolierter
Buildumgebung ist ein geeigneter weiterer Schritt zur tatsächlichen Paket-
Byteprüfung gegen SRI, ohne Installationsskripte auszuführen. Es wurde hier nicht
als erfolgreich ausgegeben. `npm ls --all --json` und `npm sbom` können erst
danach Belege über den tatsächlichen Baum liefern. Ein Lockinventar allein
bleibt ein Referenzinventar. `--force`, `--legacy-peer-deps` oder ein Publish
mit `--ignore-scripts` wären keine Reparatur dieser Integritätsgrenze.

## Windows-Publish-Harness

Zwei vorhandene Tests verursachten unabhängig von der Lockursache vermeidbare
Windowsprobleme. Die Korrektur betrifft ausschließlich Tests:

- `test/eos-license-trust.test.cjs`: Der Linux-Dateisystemmock verwendet nun
  ausdrücklich POSIX-Pfade. Die Windows-Ablehnung prüft einen kanonischen
  Windows-Pfad mit `path.win32`. Zuvor mischte der Mock Linux-Plattform mit der
  echten Windows-Pfadimplementierung.
- `test/eos-web-resources.test.cjs`: POSIX-Modusbits werden nur unter POSIX
  geprüft. Ein zusätzlicher regulärer Wiederherstellungskopiertest läuft auf
  beiden Plattformen. Der echte Symlink-/Modustest bleibt für Linux erhalten
  und ist unter Windows ausdrücklich als POSIX-Test übersprungen; ein Windows-
  Symlinktest würde sonst erhöhte Rechte bzw. Entwicklermodus voraussetzen.

Die produktive Schutzpolitik wurde nicht geändert. Insbesondere wird keine
Windows-ACL-Provisionierung des Lizenz-Trust-Ankers erfunden. Der vorhandene
produktive Windows-Fail-Closed-Pfad bleibt bestehen.

Quelle und Buildvariante bestanden jeweils 24 Fälle unter Linux/Node 24.22.1
(5 Trust, 19 Webressourcen). Kein tatsächlicher Windows-Testlauf fand statt.
Rohdaten: `portable-test-results.json`, `portable-source.log`, `portable-build.log`.
Die Tests, die `module.stripTypeScriptTypes` nutzen, benötigen mindestens
Node 22.13; für den geprüften Veröffentlichungsablauf ist Node 24 vorgesehen.

## Dry-run-Semantik

Ein isoliertes, künstliches Paket wurde mit npm 11.9.0 und `npm publish
--dry-run` geprüft. Die Registry war absichtlich ein nicht erreichbarer
Loopback-Port; es wurden keine Credentials verwendet und nichts veröffentlicht.
Der Lauf bestand und führte nacheinander `prepublishOnly`, `prepack`, `prepare`,
`postpack`, `publish`, `postpublish` aus. Ein Dry-run kann also auch eigene
Hookeffekte auslösen. Beim echten Repository sind deshalb vor dem Dry-run die
Hooks zu prüfen; die hier gelesene Fassung besitzt keine selbsttätig extern
veröffentlichenden publish/postpublish-Hooks. Der Dry-run ersetzt keine echte
npm-Authentifizierungs-/Berechtigungsprüfung.

Belege: `npm-publish-dry-run-fixture.json` und `.log`. Die Fixture ist kein
Bestandteil des auszuliefernden Adapters.

## Offizielle Quellen

- npm 11 Lockformat und Veröffentlichung: https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/
- npm 11 Installations-/Lockoptionen: https://docs.npmjs.com/cli/v11/commands/npm-install/
- npm 11 Lifecycle: https://docs.npmjs.com/cli/v11/using-npm/scripts/
- Node-Modul-API und Einführung von stripTypeScriptTypes in 22.13: https://nodejs.org/api/module.html

npm veröffentlicht `package-lock.json` nicht als wirksamen Lock eines fremd
installierten Pakets. Der derzeitige Aufnahmecheck attestiert deshalb die
Entwicklungs-/Buildreferenz, nicht den später durch Semver-Bereiche aufgelösten
Baum jeder Kundenanlage. Für den letztgenannten Baum bleibt eine gesonderte
Auslieferungs-/Installationsstrategie und Bestandsprüfung nötig.
