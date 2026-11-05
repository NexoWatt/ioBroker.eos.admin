# npm-Publish-Reparatur – EOS Admin 7.10.12

25.10.2026, Fortsetzung der Sicherheitskorrektur. Änderungskennung
EOS-RELEASE-002, Bezug EOS-RELEASE-001/EOS-DEP-001.

**Aktueller Ablauf, Nachtrag EOS-RELEASE-003:** Der nachstehend dokumentierte
Reparaturschritt ist inzwischen in `npm publish` eingebunden. Ein zusätzlicher
manueller Befehl ist nicht mehr erforderlich. Die ursprünglichen Testergebnisse
bleiben historische Nachweise; die Prüfung des direkten VS-Code-/Terminal-
Ablaufs steht in `DIRECT_PUBLISH_2026-10-25.md`.

## Ursache und Ergebnis

Der ausgelieferte 7.10.12-Stand stoppt in `prepublishOnly` bei der tatsächlichen
Lock-Aufnahme. Bei 563 Backend-Lockeinträgen fehlen Registryquelle und starke
Integrität; der Prüfer meldet dafür 1.126 Einzelhinweise. Frontend: keine
entsprechende Lücke. Das ist keine Zahl bestätigter CVEs. Diese Ausgabe passt
zum vom Nutzer übermittelten Ende des npm-Fehlerprotokolls; der vollständige
lokale Windows-Log und die dortige Arbeitskopie wurden nicht eingelesen.

Eine isolierte `npm install --package-lock-only --ignore-scripts`-Probe ergänzte
die fehlenden Felder nicht. Ein erster erfolgreicher `npm view`-Abruf wurde
anschließend als Cachetreffer erkannt. Ungecachte Registryabrufe sind in dieser
Bearbeitungsumgebung nicht möglich. Es wurden deshalb keine Prüfsummen erfunden
und die Produktionsprüfung wurde nicht abgeschaltet.

Neu ist `npm run repair:eos-lock`: Das Werkzeug ergänzt auf dem Rechner mit
Registryzugriff nur fehlende Metadaten der bereits exakt festgelegten Versionen,
prüft Identität/Quelle/kanonisches SHA-512, aktualisiert die Lock-Referenzinventare
und führt den echten Aufnahmecheck aus. 563 Einträge ergeben 532 eindeutige
Paket-/Versionsabfragen; npm-Aliasnamen werden anhand des tatsächlichen Namens
behandelt. Ein Online-Erfolg dieses vollständigen Abgleichs wird hier nicht
behauptet. Die ZIP erfordert diesen einmaligen Reparaturlauf vor dem Publish.

## Sicherheitsverhalten

- Offizielle HTTPS-Registry, TLS-Prüfung, feste Host- und Pfadkontrolle;
  je Abruf maximal fünf Sekunden und 4 MiB, keine Redirects/automatischen Retries.
- Vier gleichzeitige Abrufe, keine weiteren Aufträge nach dem ersten Fehler.
- Bereits vorhandene widersprüchliche oder schwache Metadaten verlangen Review.
- Keine Paketversionsänderung, Installation, Lifecycleausführung oder Veröffentlichung.
- Alle Antworten müssen validiert sein, bevor Lockdateien geschrieben werden.
  Vorher werden Änderungen durch einen anderen Prozess erkannt.
- Originalkopien, Hashbericht und temporäre Dateien; atomare Umbenennung je Lock.
  Das ist keine absturzatomare Transaktion über zwei Dateien. Bei einem normalen
  Commitfehler wird zurückgesetzt; zwischenzeitliche fremde Änderungen werden
  erhalten und verlangen Prüfung der Originalkopien.
- Kein Neuaufbau oder Neuversiegeln von Produktcode beim Reparatur-/Publishlauf.
- Native HTTPS-Verbindung; npm-Proxykonfiguration wird nicht übernommen.

Die Registry-Metadatenprüfung ist kein Download-/Bytevergleich der Tarballs,
kein Publisher-Attestationsnachweis und kein Advisoryscan. Die root-package-lock
wird von npm nicht als Sperre des beim Nutzer installierten Abhängigkeitsbaums
veröffentlicht. Herkunftsaufnahme, tatsächlich installierter Baum, Build-SBOM
und Kundeninstallation bleiben getrennte Nachweise.

## Windows-Prüfkorrekturen

Die bisherigen Tests setzten teilweise Linux-Dateirechte und POSIX-Pfade auch
auf Windows voraus. Der echte Symlink-/Modustest bleibt auf POSIX erhalten;
ein zusätzlicher normaler Restore-Kopiertest läuft plattformübergreifend.
Linux-Trust-Fixtures verwenden POSIX-Pfade, und der Windows-Negativfall einen
Windows-Pfad. Produktive Zugriffs-/Speicherregeln wurden nicht gelockert.
Fehlt die TypeScript-Transformationsfunktion des Testläufers, wird nun gezielt
auf eine geeignete Node-Version hingewiesen; Node 24.x wird für Publishtests empfohlen.

## Ausgeführte Prüfungen

Linux, Node 24.22.1, npm 11.9.0. Keine echte Windows-Ausführung, kein npm-Upload.
Rohbelege: `2026-10-25-publish/`.

| Prüfung | Ergebnis |
| --- | --- |
| Reparaturtests mit kontrolliertem Registrytransport | 10/10 bestanden: Positivlauf, keine Versionsänderung, Aliasnamen, Dry-Run, Fehler/Manipulation, Paralleländerung, Rollback und Erhalt fremder Änderungen |
| Trust-/Datei-/Restoreprüfungen, Source und Build | Je 24/24 bestanden; keine zusätzlichen unabhängigen Windows-Läufe |
| Vollständige vorhandene Paket-/Stabilitätskette | Bestanden; finaler Sicherheitssammellauf 153/153, zusätzlich vorhandene 40 Boundary-Prüfungen und weitere bestehende Prüfgruppen |
| Echter Online-Reparaturversuch | REGISTRY_UNAVAILABLE, Exit 1; Vorher-/Nachher-Hashes beider Lockdateien identisch |
| Echter `npm publish --dry-run` am Repository | Erwartet Exit 1 bei noch fehlender Registry-Metadatenaufnahme; kein Upload |
| Isolierte npm-Dry-Run-Lifecycleprobe | Bestätigt, dass npm 11.9.0 die lokalen Veröffentlichungshooks auch beim Dry-Run ausführt |

Die auf dem Nutzerrechner erforderliche Reihenfolge steht in
`NPM_PUBLISH_FIX_7.10.12.md`: Reparatur erfolgreich abschließen, anschließend
normal veröffentlichen. Der Gate meldet bei erneutem Abbruch jetzt am Ende
eine kurze Zusammenfassung mit passendem Reparaturhinweis.

## Lieferstand und Nachweisgrenzen

Ausgangs-ZIP SHA-256:
`61fc93464a87ae7a8290a221a80da30e465df13787615eb721934ed153a63a82`.
Produktversion bleibt 7.10.12; Produktquellen und ausgelieferte Runtime sind
gegenüber diesem Stand unverändert. Geändert wurden Veröffentlichungswerkzeug,
Test-Fixtures, Paket-/Lock-Root-Metadaten und Dokumentation. Das aktualisierte
Prebuilt-Siegel gehört genau zu diesen geprüften Werkzeug-/Teständerungen.

`release-manifests/full-repository-files.json` bindet die ausgelieferte ZIP.
Nach der beabsichtigten lokalen Metadatenreparatur unterscheiden sich Lockdateien
und Inventare von diesem ZIP-Snapshot; der erzeugte Reparaturbericht dokumentiert
diesen Übergang. Er ist kein nachträgliches Siegel unbekannten Produktcodes.

Offen bleiben der tatsächliche Registrylauf auf dem Entwicklungsrechner,
gegebenenfalls Windows-spezifische Restprobleme sowie die bereits dokumentierten
Normalbuild-, Advisory-, Controller-/Anlagen- und übergreifenden Lizenzprüfungen.
Die Veröffentlichungssperre wurde nicht wegen fehlender allgemeiner
Serienfreigabepapiere eingeführt oder erweitert. Nach bestandenen technischen
Prüfungen kann ein Testpaket veröffentlicht werden; daraus folgt keine
Serienfreigabe oder IEC-/CRA-Konformität.

Offizielle npm-Dokumentation, am Prüfungstag abgeglichen:

- https://docs.npmjs.com/cli/v11/commands/npm-install/
- https://docs.npmjs.com/files/package-lock.json/
- https://docs.npmjs.com/cli/commands/npm-sbom/
- https://docs.npmjs.com/cli/npm-audit/
