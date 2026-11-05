# Gesonderte Prüfung des Kopier-Update-Helfers

Prüfumfang: `nexowatt-prepare-copy-update.cjs`, seine 26 Fehler-/Normalfalltests und der npm-Orchestrierungstest mit drei Fällen. Exakte Quellhashes, Umgebung und Rohloghash stehen in `copy-helper-review.json`. Dies ist eine gesonderte Prüfung durch einen weiteren Coding-Agenten, keine unabhängige Zertifizierung.

## Ergebnis

Im geprüften Umfang wurden keine blockierenden Sicherheits- oder Datenverlustbefunde festgestellt. Die zusätzlich eigenständig ausgeführten 29 Tests bestanden unter Linux mit Node.js 24.22.1; kein Fall wurde übersprungen. Das Rohprotokoll ist `independent-copy-review-tests.log`.

Die aktuelle Release-Struktur und sämtliche verzeichneten Datei-Hashes werden vor Schreibzugriffen geprüft. Nur zusätzliche Dateien mit ausdrücklich katalogisiertem Pfad und passendem historischen SHA-256 dürfen ausgelagert werden. Fehlende oder veränderte aktuelle Dateien, unbekannte Zusatzdateien und veränderte Altdateien bleiben ein Abbruchgrund. Der Helfer erzeugt keine neue Versiegelung und repariert keine aktuellen Hashabweichungen.

Alle Sicherungskopien werden geschrieben, synchronisiert und anschließend vollständig zurückgelesen und verglichen, bevor die erste Quelldatei verschoben wird. Die verschobenen Originaldateien bleiben zusätzlich in getrennten `.retired`-Dateien erhalten. Bei Fehlern verwendet der Rücklauf ausschließlich exklusives Kopieren; ein zwischenzeitlich neu angelegter Quellpfad wird nicht überschrieben. Journal und Sicherungsdateien ermöglichen eine kontrollierte manuelle Wiederherstellung. Ein nach Prozessabbruch verbleibendes Sperrverzeichnis verhindert einen unbeaufsichtigten erneuten Bereinigungslauf.

Pfade außerhalb der festgelegten Releasebereiche, Traversal, Windows-ADS-/Gerätenamen, problematische Endzeichen, kollidierende Groß-/Kleinschreibungen sowie geprüfte Symlink-/Junction-Fälle werden abgewiesen. Datei-, JSON- und Gesamtgrößen sind begrenzt. Git-Metadaten, installierte node_modules und lokale Dateien außerhalb der Releasebereiche bleiben unberührt.

## Testabgrenzung

Die 26 Helfertests führen den tatsächlichen Helfer gegen kleine isolierte Dateibäume aus, einschließlich Schreibfehler, beschädigter Sicherung, Abbruch während des Verschiebens, konkurrierender Dateiersetzung und Rücklaufkonflikt. Der Test `eos-direct-publish.test.cjs` führt den echten npm-Lifecycle mit den tatsächlichen Orchestrierungsstrings aus. Darin ist die neue Kopiervorbereitung ausdrücklich als Orchestrierungsstub gekennzeichnet; geprüft werden ihre Reihenfolge und der Abbruch vor Versionsabgleich oder Lock-Reparatur. Die echte Lock-Reparatur, Inventur und Zulassungsprüfung werden mit injizierten Registry-Daten ausgeführt. Kein Test veröffentlicht auf npm.

Ein vollständiges Überkopieren eines tatsächlichen alten Release-Repositories und die Prüfung des abschließend gepackten Artefakts gehören zu den gesonderten Releaseprüfungen. Die hier geprüften Quellhashes müssen mit deren abschließendem Stand abgeglichen werden.

## Grenzen

Ein nativer Windows-/Explorer-/ACL-Lauf wurde hier nicht durchgeführt. Automatische Auslagerung gilt für nachgewiesene Katalogeinträge; unbekannte oder lokal bearbeitete Dateien werden bewusst nicht entfernt. Die Sicherungen sind Quellcode-Sicherungen, keine Behauptung einer verschlüsselten Geheimnisablage. Hashmanifeste schützen vor erkannten Dateiabweichungen, sind allein aber keine Herkunfts- oder Signaturprüfung gegen einen Akteur mit Schreibrechten auf das gesamte Repository.
