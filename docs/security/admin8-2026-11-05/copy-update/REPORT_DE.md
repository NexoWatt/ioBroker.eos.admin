# Kopierupdate und Node-22-Unterstützung — EOS Admin 8.0.0

Stand: 05.11.2026. Dieser Nachtrag ersetzt die vorherige Empfehlung, für jede Übernahme einen neuen Git-Arbeitsordner anzulegen, sowie das bisherige ausschließliche Node-24-Profil. Gewünschter Ablauf: vollständigen ZIP-Inhalt in den bestehenden Projektordner kopieren und anschließend wie gewohnt `npm publish` ausführen.

## Ursache und abgegrenzter Befund

Der ursprüngliche Ausschnitt zeigt nur die abschließende npm-Fehlerzusammenfassung und Node 24.21.0. Die konkrete erste Fehlermeldung fehlt; die tatsächliche Abbruchstelle dieses Nutzerlaufs ist deshalb nicht bewiesen. Die alte Pipeline erzwingt den Node-Patchstand nicht ausdrücklich, sodass die Node-Zeile allein die Ursache nicht belegt.

Unabhängig davon wurde `EOS-ADMIN8-COPY-UPDATE-001` reproduziert: Beim Überkopieren blieben alte CSS-/Map-/EasyAccess-Dateien und entfernte Quellen erhalten. Der bisherige Dateinamen-Bereiniger erkannte von sechs repräsentativen Dateien nur eine. Die folgende Versiegelung lehnt die verbliebenen Zusatzdateien korrekt ab. Der alte Merge-Selbsttest prüfte überwiegend Skriptmarker, nicht den tatsächlichen Altstand-Übergang.

## Änderung und Sicherheitswirkung

`nexowatt-prepare-copy-update.cjs` läuft jetzt zuerst in prepublishOnly und prepack. Die Node-Prüfung erfolgt vor Schreibzugriffen. Alle aktuellen versiegelten Dateien müssen vollständig und bytegleich vorliegen. Ein selbst versiegelter Katalog enthält 602 frühere Pfade mit 621 erlaubten historischen Hashes aus dem vorhandenen 7.10.12-Nachweis und dem tatsächlich geladenen vollständigen 7.10.9-ZIP. Nur exakt passende Altdateien werden zunächst gesichert, zurückgelesen und dann in zusätzliche Sicherungsdateien verschoben. Unbekannte/veränderte Zusatzdateien und unvollständige aktuelle Releases stoppen ohne Bereinigung.

Kurze flache Backupnamen, Journal, Sperre, Pfad-/Symlink-/Junction-Prüfung, Größen-/Anzahlgrenzen und ein Rücklauf ohne Überschreiben neuer Dateien begrenzen Datenverlust und Pfadmissbrauch. `.git`, lokale Abhängigkeiten und fremde Bereiche werden nicht verändert. Die Sicherung ist vom npm-Paket und regulären Git-Add ausgeschlossen. Der bisherige ungebundene Admin8-Löschweg nach Dateinamenmustern ist deaktiviert; anschließend bleibt die strenge vollständige Versiegelung aktiv. Die optionalen Merge-Starter führen nur den normalen Dry-run aus, patchen keinen Quellcode und umgehen keine PowerShell-Richtlinie.

Dies ist eine lokale Übernahmeprüfung in einem vertrauenswürdigen Arbeitsordner, keine Betriebssystem-Sandbox gegen einen Angreifer mit derselben Benutzeridentität und voller Schreibberechtigung. Der Inhalt eigener Änderungen muss vor dem Explorer-Überschreiben gesichert werden; bereits überschriebene Bytes kann ein nachfolgender npm-Lauf nicht rekonstruieren. Bei künftigen Releases ist der Katalog um die tatsächlich entfallenen bisherigen Release-Dateien zu ergänzen und auf die neue Zielversion zu binden. Keine pauschale Aussage, beliebige unbekannte Altstände seien automatisch abgedeckt.

## Node 22 und Node 24

Auf ausdrücklichen Nutzerhinweis unterstützt der Admin nun **Node 22 ab 22.23.4** sowie **Node 24 ab 24.22.1**, jeweils innerhalb ihrer Hauptversion. Die Mindeststände enthalten die offiziellen Sicherheitskorrekturen vom 21.10.2026. Node-22-Anlagen brauchen deshalb keinen erzwungenen Hauptversionswechsel. Node 24.21.0 muss aktualisiert werden. Paket/Lock, erste Publish-Prüfung, CI-Matrix, Betriebsanleitung und Projektvorgabe sind aufeinander abgestimmt. Die CI-Konfiguration wurde geändert, aber kein entfernter CI-Lauf ausgeführt.

Keine der geprüften Lock-Engine-Angaben steht Node22.23.4 entgegen. Die wirklichen Anwendungsquellen sowie Backend-/Frontend-/EasyAccess-Laufzeitdateien sind gegenüber dem vorherigen Lieferstand bytegleich; Änderungen betreffen Release-Werkzeuge, Metadaten, Tests und Dokumentation. Der separate historische Fallback-Compiler bleibt ein Node24-Entwicklungswerkzeug und gehört nicht zur normalen Adapterlaufzeit oder Publish-Kette. Die bestehende Empfehlung für Node24 ist keine automatische Zwangsmigration einer Node22-Anlage.

Offizielle Quellen: https://nodejs.org/en/blog/release/v22.23.4 ; https://nodejs.org/en/blog/release/v24.22.1 ; https://nodejs.org/en/blog/vulnerability/october-2026-security-releases . Das Node22-Linux-x64-Binärarchiv wurde von nodejs.org geladen und gegen die offizielle HTTPS-SHA256-Liste geprüft; keine zusätzlich geprüfte Herausgebersignatur behauptet.

## Tatsächliche Prüfungen

- Kanonischer vollständiger Build mit Node24.22.1: erfolgreich. Acht Entwicklungsprüfgruppen, darunter 74 Pakettests und 227 EOS-Tests, bestanden; neuer Quellbezug mit 685 Eingaben, anschließend regulär neu versiegelt.
- Dieselben acht Prüfgruppen mit echter Node22.23.4-Laufzeit: erfolgreich. 74 Pakettests und 227 EOS-Tests, keine übersprungenen EOS-Tests. Originaler Quellhash ist gebunden, Logs separat erhalten.
- Kopierhelfer: 26 positive/negative Fälle einschließlich manipuliertem/fehlendem aktuellem Stand, unbekannten/bearbeiteten Altdateien, Pfadmanipulation, Sperren, Sicherungsfehlern, Dateiaustausch während des Verschiebens und Rücklauf ohne Überschreiben.
- Gesonderter KI-Code-Review und 29 Helfer-/Orchestrierungstests erfolgreich. Kein unabhängiger externer Penetrationstest oder Zertifizierungsnachweis.
- Echtes vollständiges 7.10.9-Repository, vollständiger neuer Stand darüberkopiert, danach normales `npm publish --dry-run --json` unter Node22.23.4/npm10.9.9: erfolgreich. **581 alte Dateien** gesichert und ausgelagert; Sicherungskopien/hashgleiche verschobene Dateien geprüft; 1.093 aktuelle versiegelte Dateien unverändert. Git-Metadaten, ein vorhandener node_modules-Prüfmarker und eigene Notizen unverändert; Backup nicht im npm-Paket. Der Marker ersetzt keine Behauptung, sämtliche früheren installierten Entwicklerpakete seien getestet worden.
- Vorheriges vollständiges 8.0.0-ZIP plus neuer Stand unter Node24.22.1/npm11.9.0: normaler Publish-Dry-run erfolgreich; keine entfallenen Dateien, identische Schutzprüfungen. Wiederholte Vorbereitung bleibt wirkungslos.

Die Overlay-Kopien enthielten auch lokal generierte, nicht ausgelieferte Frontend-Buildausgaben; diese sind kein npm-Laufzeitinhalt. Die finale Repository-ZIP lässt node_modules, Git-Metadaten, lokale Sicherungen und temporäre Buildverzeichnisse weg und wird gegen die aktuelle Versiegelung sowie Pfadbudget geprüft. Alle genannten Ablaufprüfungen liefen unter Linux x64 mit der Verzeichnisschachtelung des Nutzerziels, nicht unter nativem Windows.

## Grenzen und nächste Schritte

Native Windows-/Explorer-Ausführung, das echte npm-Konto einschließlich 2FA, die tatsächliche Veröffentlichung sowie Installation und Anlagenabnahme auf realen Node22-/Node24-Systemen wurden nicht durchgeführt. Die vorher dokumentierten drei EasyAccess-Robustheitsbefunde und die allgemeine Zielsystemabnahme bleiben offen. Dieser Release-Nachtrag behauptet keine Fehlerfreiheit, IEC-Zertifizierung oder CRA-Konformität.

Der reguläre Betriebs-/Rückfallablauf steht in `WINDOWS_GIT_NPM_DE.md` im Repositorywurzelverzeichnis. Bei einem weiteren Abbruch ist die erste konkrete Fehlermeldung über dem npm-Schlussblock erforderlich. Sicherungen und Journale bis zur erfolgreichen Übernahme behalten.
