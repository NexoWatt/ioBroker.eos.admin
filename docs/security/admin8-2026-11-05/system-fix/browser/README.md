# Browserprüfung – EOS Admin 8.0.2

Der tatsächlich gebaute React-Frontendstand wurde mit Chromium 153.0.8010.0 und Playwright 1.62.1 geprüft. HTTP-, WebSocket-, Lizenz- und Datenbankantworten stammen ausschließlich aus einem lokalen synthetischen Prüfstand. Keine Anmeldung an einer Anlage, keine produktiven Benutzer, keine echten Lizenzcodes und kein echter Controller wurden verwendet.

## Ergebnis

**Bestanden: 25 Ablaufprüfungen in drei Browserszenarien.** Frontend-Manifest SHA-256: `0a996d86e1f8f3ac8021a5c7d89107ac2278b4afff2db023c4155d0cb687a540`.

| Szenario | Tatsächlich geprüft |
| --- | --- |
| Administrator, 1900 × 1000 | System- und Expertenschaltflächen sichtbar, innerhalb des Sichtbereichs und am Mittelpunkt anklickbar; weiterhin erreichbar bei bis zum Ende gescrollter langer Adapternavigation; Expertenmodus ein/aus. |
| Administrator, 390 × 844, leerer Anlagenname | Dasselbe nach Öffnen des normalen mobilen Menüs; die Kopfzeile und der Menüknopf bleiben auch ohne Anlagenname erhalten. |
| Beide Administratoransichten | Native Basiseinstellungen mit Kunden-/Anlagenname, Land, Stadt, Breitengrad und Längengrad; Speichern und Wiederöffnen; gezielt abgelehnter Speichervorgang erhält den Entwurf und erlaubt einen erneuten Versuch; Verwerfen verändert gespeicherte Werte nicht. |
| Beide Administratoransichten | Eigener Reiter EOS Home / Pro; Home-Status; gezielte HTTP-503-Antwort und anschließende Wiederherstellung; synthetischer Aktivierungsablauf zeigt Pro und leert das Eingabefeld; kein Code in Browser-Storage; Lizenzentfernung mit Abbrechen und bestätigtem Entfernen. |
| Beide Administratoransichten | Schreibanfragen verwenden den bestehenden Same-Origin-Vertrag und `X-EOS-License: 1`; kein schwebender Lizenzlink; ein authentifiziertes Rollenänderungsereignis blendet die Administrator-Steuerelemente unmittelbar aus. |
| Endnutzer, 1440 × 1000 | Kein System-/Expertenzugang; direkter Aufruf des System-/Lizenzpfads öffnet weder Einstellungsfelder noch sendet er eine Lizenzanfrage. |

Die lange Testnavigation misst am Desktop 3427 Pixel bei 1556 Pixel sichtbarer Breite, mobil 3319 bei 98 Pixel. System und Experte bleiben davor erreichbar. Die Prüfung verwendet zusätzlich `elementFromPoint` und Playwright-Aktionsprüfungen: Ein zwar vorhandener, aber verdeckter oder abgeschnittener Knopf würde nicht als bestanden zählen.

Keine Seitenfehler, fehlenden Dateien oder unerwarteten externen Abrufe. Je Administratorlauf erscheint genau die erwartete Browser-Konsolenmeldung zur absichtlich erzeugten HTTP-503-Antwort. Sie belegt den ausgeführten Fehlerfall und wird nicht als fehlerfreies Netz bezeichnet. Andere Warnungen und Fehler führen zum Fehlschlag.

Die vorhandene Standortkarte wird mit synthetischen Bildkacheln beantwortet, die Ortssuche mit einer leeren Testantwort. Es erfolgen keine echten Karten-/Geokodierungsabrufe. Dieser Nachweis bestätigt deshalb nicht die Verfügbarkeit eines externen Kartendienstes.

## Umfang und Grenzen

Geprüft werden echte ausgelieferte UI-Komponenten und deren Interaktionen. Persistenz und Antworten der Lizenzverwaltung sind simuliert. Verschlüsselung, Signaturkontrolle, HTTPS-Konfiguration und serverseitige Rechteprüfung werden durch diesen Browserlauf **nicht** nachgewiesen; dafür gelten die gesonderten Backendtests. Die Ergebnisse ersetzen keinen Test auf Dominiques Anlage, keine reale Mobilgeräteprüfung und keine IEC-/CRA-Konformitätsbewertung.

`system-browser-result.json` enthält die aufgezeichneten Abläufe und synthetischen Socketaufrufe. `integrity.json` bindet Skripte, Ergebnis, Browserdatei und Frontendstand über SHA-256. Vorläufige Läufe und interne Screenshots wurden nicht in diesen Ergebnisordner übernommen.

## Wiederholung

Voraussetzungen: vollständiges gebautes Repository, separat installiertes Playwright und passender Chromium-Browser. Diese Prüfwerkzeuge sind keine Laufzeitabhängigkeiten des Adapters.

```bash
node docs/security/admin8-2026-11-05/system-fix/browser/system-browser.cjs --root /pfad/ioBroker.eos-admin --output /pfad/browser-neulauf
```

`--root` ist optional, wenn das Skript an seinem vorgesehenen Ort im vollständigen Repository liegt. Ohne `--output` wird ein separates Unterverzeichnis `rerun` angelegt; die ursprünglichen Belege bleiben unverändert. Die Produktversion im Frontendmanifest muss zur Repositoryversion passen. Neue Buildbytes erzeugen einen neuen Nachweis mit ihrem eigenen Manifest-Hash.

| Umgebungsvariable | Verwendung |
| --- | --- |
| `EOS_PLAYWRIGHT_MODULE` | Optionaler absoluter Pfad zum getrennt installierten Playwright-Modul; ansonsten normale Modulauflösung. Im Codex-Prüfumfeld wird alternativ dessen vorhandene Runtime verwendet. |
| `EOS_BROWSER_EXECUTABLE` | Optionaler absoluter Pfad zu Chromium; sonst Playwright-Standardbrowser. |
| `EOS_BROWSER_PROFILE=sparticuz` | Nur für den hier verwendeten Linux-Prüfbrowser aus `@sparticuz/chromium@153.0.0`. Aktiviert dessen benötigte Startparameter einschließlich `--no-sandbox`; dies ist ausschließlich eine isolierte Prüfstandseinstellung und keine Empfehlung für Kundenbrowser. |

Jedes Szenario startet einen eigenen Browserprozess. Das verhindert eine bekannte Einschränkung des verwendeten Single-Process-Prüfbrowsers beim Schließen und Neuerstellen von Browserkontexten. Es ist keine Produktänderung. Die Browserherkunft und Integrität dieses getrennten Werkzeugs sind außerdem im bestehenden Nachweis `docs/security/admin8-2026-11-04/browser/README.md` dokumentiert.
