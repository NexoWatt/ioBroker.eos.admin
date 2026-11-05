> Aktueller Korrekturstand: **8.0.1**. Einstieg und PuTTY-Update: `START_HERE_8.0.1.md`. Die Anleitung unten zur ursprünglichen 8.0.0-Übernahme gilt für den Kopierablauf weiterhin.

# ZIP in den bestehenden Git-Ordner kopieren und veröffentlichen

Stand: 05.11.2026, EOS Admin 8.0.0. Der gewünschte Ablauf ist **ZIP-Inhalt über den bestehenden Projektordner kopieren → in VS Code npm publish ausführen**. Der Git-Ordner muss dafür weder gelöscht noch neu aufgebaut werden.

## Einmalige Node-Voraussetzung

Unterstützte Sicherheitsprofile:

| Hauptversion | Mindest-Patchstand | Obergrenze |
| --- | --- | --- |
| Node.js 22 | 22.23.4 | kleiner 23 |
| Node.js 24 | 24.22.1 | kleiner 25 |

Node-22-Anlagen dürfen auf ihrer Hauptversion bleiben. Der gemeldete Windows-PC mit **24.21.0** benötigt ein Patch-/Minor-Update innerhalb der 24er-Reihe. Aus einer generischen „neueste LTS“-Installation kann inzwischen eine andere Hauptversion werden; deshalb ausdrücklich die passende 22er-/24er-Version wählen. Offizielle Release-/Downloadseiten: https://nodejs.org/en/blog/release/v22.23.4 und https://nodejs.org/en/blog/release/v24.22.1 . Den Installer passend zu x64/ARM64 und zum vorhandenen Installationsverfahren verwenden. Kein versteckter Download oder Austausch der lokalen Node-Installation durch das Adapterpaket.

Nach der Aktualisierung VS Code vollständig schließen und neu öffnen. Im Terminal prüfen:

```powershell
node --version
where.exe node
npm.cmd --version
```

Zeigt `node --version` weiterhin den alten Stand, verwendet das Terminal noch eine andere Installation aus PATH. Diese Zuordnung zuerst korrigieren. Die neue erste Publish-Stufe nennt bei einer nicht unterstützten Version das tatsächlich verwendete Node-Programm, bevor sie Dateien verändert.

## Regelmäßiger Kopierablauf

1. Eigene Änderungen vor dem Ersetzen committen oder separat sichern. Das gilt auch für unversionierte eigene Dateien. Der spätere npm-Lauf kann vom Explorer bereits überschriebene Inhalte nicht wiederherstellen.
2. Das vollständige ZIP in einen kurzen temporären Pfad wie `C:\nw` entpacken. Den langen ZIP-Namen nicht als zusätzlichen Entpackordner verwenden.
3. **Den Inhalt** des entpackten Projektordners auswählen und nach `C:\Users\User\Desktop\ioBroker\ioBroker.eos.admin` kopieren. Alle enthaltenen Dateien ersetzen lassen, auch `.gitattributes`, `.gitignore`, `tools`, `src`, `admin`, `adminWww`, `build`, `package.json` und Locks. Es darf keine zusätzliche Ebene `ioBroker.eos-admin` im Ziel entstehen.
4. Den vorhandenen Ordner in VS Code öffnen und wie gewohnt ausführen:

```powershell
npm.cmd publish
```

Ein vorheriger Git-Upload ist nicht nötig. Wer erst ohne Veröffentlichung prüfen möchte, führt `npm.cmd publish --dry-run` aus. Kein zusätzliches Merge-Skript, kein Neuaufbau und kein `npm install` sind für den vorgebauten Lieferstand erforderlich. `npm.cmd` vermeidet die mögliche PowerShell-Sperre von `npm.ps1`, ohne die Ausführungsrichtlinie abzuschalten.

## Was automatisch geschieht

Die erste Stufe prüft die Node-Version und danach alle aktuellen versiegelten Dateien. Nur wenn der neue Stand vollständig und unverändert vorliegt, werden entfallene Dateien aus den nachgewiesenen älteren Lieferständen anhand **Pfad und SHA-256** erkannt. Sie werden zunächst vollständig gesichert und dann aus dem Releasebereich ausgelagert. Der dokumentierte Katalog enthält den historischen Stand 7.10.12 und das tatsächlich geladene vollständige 7.10.9-Paket. Er ist selbst Bestandteil der neuen Versiegelung.

Die Sicherungen liegen kurz und flach unter `.eos-backup/r-.../`: `journal.json` ordnet Originalpfade, Hashes und Sicherungsdateien zu. `.bin` enthält die geprüfte Kopie, `.retired` bewahrt die aus dem alten Dateibaum verschobene Datei. Die flachen Namen vermeiden neue Windows-Pfadlängenprobleme. Der Ordner ist in Git ausgeschlossen und liegt außerhalb der npm-Dateifreigabe. Kein Inhalt wird beim Upload automatisch weitergegeben. Sicherungen bis zur erfolgreichen Übernahme behalten.

Unbekannte oder selbst geänderte Zusatzdateien werden **nicht automatisch entfernt**. Der Vorgang stoppt mit den betroffenen Pfaden. Diese Dateien prüfen und, sofern eigene Arbeit, außerhalb der ausgelieferten Releasebereiche sichern oder in einen regulär neu gebauten Stand übernehmen. Bei fehlenden oder veränderten aktuellen Dateien das vollständige ZIP erneut korrekt kopieren. Keine pauschalen Löschbefehle, kein `git reset --hard`, kein `git clean -fdx` und keine neue Versiegelung zum Übergehen eines Fehlers.

`.git` bleibt am bisherigen Ort, ebenso vorhandene `node_modules` und sonstige Dateien außerhalb der festgelegten Releasebereiche. Die normale Publish-Prüfung benötigt die alten Entwicklerabhängigkeiten nicht. `.gitattributes` verhindert Änderungen der Datei-Bytes durch Git-Zeilenendenumwandlung. Vor dem Commit in VS Code sowohl normale als auch bereits vorgemerkte Änderungen prüfen (`git diff`, `git diff --cached`, `git status --short`).

## Abbruch und Wiederherstellung

Bei einem unerwarteten Schreib-/Sperrfehler bleiben die Sicherungsdateien und das Journal erhalten. Bereits ausgelagerte Dateien werden nach Möglichkeit zurückgelegt, ohne eine inzwischen vorhandene Datei zu überschreiben. Bei Prozessabbruch kann `.eos-backup/.lock` erhalten bleiben. Nicht blind entfernen: erst ausschließen, dass noch ein Lauf arbeitet, und den Journalstatus prüfen. Das Journal nennt gegebenenfalls `RECOVERY_REQUIRED`; der Originalinhalt bleibt über die zugeordneten `.bin`-/`.retired`-Dateien verfügbar. Der nächste Lauf darf eine ungeklärte Sicherung nicht still übergehen.

## npm und Prüfgrenzen

Der normale Ablauf führt anschließend alle bisherigen Versions-, Lock-, Paket-, Integritäts- und Sicherheitstests aus. Keine Option `--ignore-scripts`, keine automatische Neuversiegelung, keine Deaktivierung eines Sicherheitsgates. Die optionalen `MERGE_UPDATE.cmd/.ps1/.sh` führen nur `npm publish --dry-run` aus und veröffentlichen nichts.

Für den tatsächlichen Upload sind ein berechtigtes npm-Konto, erforderliche Anmeldung/2FA und eine noch unveröffentlichte Kombination aus Paketname und Version nötig. `npm.cmd whoami` zeigt die aktuelle Anmeldung; bei Bedarf `npm.cmd login`. Eine bereits veröffentlichte `iobroker.eos-admin@8.0.0` kann nicht überschrieben werden.

`npm error code 1` und die abschließende Node-Versionszeile nennen allein nicht die konkrete Ursache. Bei erneutem Abbruch die **erste Fehlermeldung oberhalb dieses Schlussblocks** oder das npm-Debuglog bereitstellen; keine Tokens, Kennwörter oder privaten Schlüssel weitergeben. Der ursprüngliche Windows-Schlussblock ist kein Beweis, dass Node24.21 allein den früheren Abbruch verursacht hat.

Prüfumfang, tatsächliche Node-Läufe, echtes Altstand-Overlay und offene Grenzen stehen unter `docs/security/admin8-2026-11-05/copy-update/`. Native Windows-/Explorer-Tests und Tests auf realen Node-22-Anlagen sind getrennt von den Linux-Laufzeit-/Publish-Tests zu bewerten. Vor Anlagenupdates Sicherung einschließlich Lizenzablage durchführen und die Zielsystem-Abnahme aus `docs/ADMIN8_MIGRATION_8.0.0_DE.md` verwenden.
