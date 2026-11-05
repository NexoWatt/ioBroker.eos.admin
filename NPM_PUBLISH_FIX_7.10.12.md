# EOS Admin 7.10.12 – direkt aus VS Code veröffentlichen

Der Abbruch im zuletzt gelieferten Paket wird durch `check:eos-production-release`
verursacht: In der Backend-Lockdatei fehlen bei 563 Einträgen sowohl `resolved`
als auch eine starke Integritätsangabe. Die neue Prüfung stoppt deshalb vor dem
Upload. Das ist kein Nachweis eines npm-Anmelde-/2FA-Fehlers. Ein einfaches
`npm install --package-lock-only` hat diese Lücken im geprüften Stand nicht ergänzt.

## Vorgehen in VS Code

Diese vollständige ZIP in **einen neuen Ordner** entpacken und diesen Ordner in
VS Code öffnen. Unter **Terminal → Neues Terminal** das integrierte Terminal
öffnen; dort muss `package.json` liegen. Für die Entwicklungs-/Publish-
Prüfungen Node.js 24.x verwenden (`node --version`). Die Laufzeitfreigaben für
bestehende Geräte werden durch diese Werkzeugkorrektur nicht erweitert.

```powershell
npm publish
```

Ein gesonderter Reparaturbefehl ist nicht mehr erforderlich. `npm publish`
startet die Reparatur automatisch über `prepublishOnly`, aktualisiert danach
die Inventare und führt die bisherigen Prüfungen aus. Die vorhandene lokale
npm-Anmeldung wird wie bisher verwendet. Eine von npm verlangte Anmeldung
oder Bestätigung erfolgt im üblichen npm-Ablauf.

Die Reparatur ruft bei fehlenden Angaben die Metadaten der bereits festgelegten exakten Paketversionen
von `https://registry.npmjs.org` ab. Sie kontrolliert Paketname, Version,
Paketadresse und kanonische SHA-512-Integrität; bei npm-Aliasnamen wird der
tatsächliche Paketname verwendet. Sie ergänzt ausschließlich fehlende
Quell-/Integritätsfelder. **Keine Paketversion wird erhöht, kein Paket installiert,
kein Produktskript neu gebaut und kein Code neu versiegelt.** Danach werden die
Lock-Referenzinventare aktualisiert und die tatsächliche Aufnahmeprüfung erneut
ausgeführt. Erst nach erfolgreicher Prüfung folgt der Upload. Bei bereits
vollständigen Lockdateien benötigt die Reparatur keine Registryabfragen.

Originale Lockdateien und ein Prüfbeleg mit Vorher-/Nachher-Hashes liegen nach
erfolgreicher Reparatur unter `reports/security/lock-repair/`. Bestehende falsche
oder widersprüchliche Metadaten werden nicht ungefragt überschrieben. Bei einem
Netz-/Validierungsfehler bleiben die Lockdateien unverändert. Schreibfehler
werden mit Rückfall und Originalkopien behandelt; ein Hinweis
`LOCK_WRITE_FAILED_REVIEW_BACKUP` verlangt eine Prüfung der dortigen Kopien.

## Wenn der Abruf abbricht

Das Werkzeug benötigt direkten HTTPS-Zugriff auf die offizielle Registry. Es
übernimmt keine npm-Proxykonfiguration und deaktiviert keine Zertifikatsprüfung.
Jeder Abruf hat höchstens fünf Sekunden einschließlich Verbindung und Antwort,
maximal 4 MiB Antwortgröße und keine Weiterleitung oder automatischen Retries.
Höchstens vier Abrufe laufen gleichzeitig. Nach dem ersten Fehler werden keine
neuen Abrufe begonnen. Nach Behebung des Verbindungsproblems kann derselbe
Befehl `npm publish` erneut ausgeführt werden. Für eine isolierte Diagnose
bleibt `npm run repair:eos-lock` verfügbar; für den normalen Upload ist dieser
Zusatzschritt nicht erforderlich.

In der Bearbeitungsumgebung war dieser Netzabruf nicht möglich. Die 563 Einträge
sind deshalb in dieser ZIP **noch nicht mit erfundenen Werten aufgefüllt**; die
automatische Reparatur muss auf dem Rechner mit Registryzugriff erfolgreich laufen. Der erste
scheinbar erfolgreiche `npm view`-Abruf hier stammte aus vorhandenem Cache;
ungecachte Paketabfragen und der echte Reparaturversuch scheiterten. Das ist im
Prüfbericht ausdrücklich festgehalten.

## Weitere korrigierte Windows-Prüfstellen

Linux-Dateirechte und der reale POSIX-Symlinktest werden nur auf passenden
Systemen ausgeführt. Der normale Restore-Kopiertest läuft weiterhin auch auf
Windows. Die Linux-Vertrauensanker-Fixture verwendet ausdrücklich POSIX-Pfade,
damit Windows-Pfadregeln keinen künstlichen Fehler verursachen. Die produktive
Linux-Sicherheitsrichtlinie und die Ablehnung unprovisionierter Windows-
Vertrauensanker bleiben erhalten. Fehlende TypeScript-Testfunktionen melden
jetzt eine verständliche Node-Versionsempfehlung.

Es wurde kein echter Windows-Rechner ausgeführt und kein Paket hochgeladen.
Die npm-Anmeldedaten verbleiben bei dir. Die technischen Tests und verbleibenden
Build-/Anlagenprüfungen stehen in
`reports/security/PUBLISH_REPAIR_2026-10-25.md` sowie im Nachtrag
`reports/security/DIRECT_PUBLISH_2026-10-25.md`. Eine Testveröffentlichung ist
keine automatische Serienfreigabe oder IEC-/CRA-Konformität.
