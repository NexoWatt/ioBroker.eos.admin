# EOS-A8-SYSTEM-001 – Systemzugang und Expertenmodus

Stand: EOS Admin 8.0.2, 05.11.2026. Ausgangspunkt: ausgelieferte 8.0.1; die Anmeldung wurde von Dominique als wieder funktionsfähig bestätigt. Die gemeldete fehlende Bedienbarkeit von System und Expertenmodus ist ein gesonderter Oberflächenfehler.

## Befund und Änderung

Die neue Admin-8-Oberfläche legt Systemzugang und globale Schalter in einen vertikalen Drawer-Fußbereich. Die vorhandene EOS-Gestaltung verwandelt den Drawer dagegen in eine horizontale Navigationszeile mit fester Höhe und `overflow-y: hidden`. Der weiterhin vertikale Fußbereich wird dort abgeschnitten beziehungsweise hinter langen Adapterlisten aus dem sichtbaren Bereich geschoben. Zusätzlich hing die Existenz der Kopfzeile vom eingetragenen Anlagennamen ab.

Der native React-Drawer enthält jetzt vor der getrennt horizontal scrollenden Adapterliste einen festen Bereich für **System** und **Expertenmodus**. System öffnet weiterhin den vorhandenen nativen Systemeinstellungsdialog. Bestätigung, temporäre Browser-Einstellung und dauerhafte Systemvoreinstellung des Expertenmodus bleiben erhalten. Benachrichtigungen, Design und Synchronisierung sind wieder in der stets vorhandenen Kopfzeile. Der Kontozugang hat einen eigenen horizontalen Bereich. Der mobile Menüknopf besitzt eine übersetzte zugängliche Beschriftung und meldet seinen Öffnungszustand. Im nativen Systemdialog erhalten Reiter und Icons einen zur dunklen EOS-Fläche passenden Kontrast, inklusive sichtbarem Tastaturfokus; deaktivierte Reiter bleiben deaktiviert. Die Branding-Schicht erkennt den nativen Drawer-Kopf über eine ausdrückliche Markierung, nicht mehr über das erste beliebige `div`.

Eine nach dem Start oder bei Wiederverbindung eintreffende Backend-Rollenrichtlinie löst nun auch eine React-Aktualisierung aus. Ohne authentifizierte, freigeschaltete administrative Rolle bleiben System- und Expertenschalter gesperrt; ein direkt angesprungener Systemdialog wird dann ebenfalls nicht gerendert. React-Ansichten und ihre Ereignisbehandlung verwenden den aus der authentifizierten Backend-Policy abgeleiteten React-Zustand. Eine nachträgliche Änderung der globalen Kompatibilitätsvariable kann widerrufene Rechte daher nicht wieder als sichtbare Bedienelemente erscheinen lassen. Auch zuvor erzeugte Expertenschalter und Bestätigungsdialoge prüfen den aktuellen Zustand beim Klick erneut. Berechtigungen werden weiterhin serverseitig geprüft; der Expertenmodus ist eine Ansichtseinstellung und vergibt keine zusätzlichen Serverrechte.

## Prüfungen

| Prüfung | Ergebnis | Geltungsbereich |
| --- | --- | --- |
| `node --test test/eos-admin8-navigation.test.cjs` | 7/7 bestanden unter Node 24.22.1 und Node 22.23.4 | Tatsächliche TSX-Methoden, React-Elemente und Zustandsübergänge; externe Persistenz nicht beteiligt |
| Expertenmodus bestätigen, abbrechen, ein/aus, dauerhafter Standard | Bestanden | Vorhandener Bestätigungsdialog und Session-Storage-Verhalten |
| Systemnavigation und direkter Dialog nach Rolle | Bestanden | Admin/Service sichtbar; Installer/Endkunde/unbekannt gesperrt |
| Rolle trifft nach Start ein / wird entzogen / Passwort-Ersteinrichtung offen / spätere globale Rollenänderung | Bestanden | React-Zustand und Schalter aktualisiert; kein unbeabsichtigter administrativer Rückfall |
| ESLint `src/App.tsx src/components/Drawer.tsx` | Exit 0, keine Meldungen | Geänderte React-Dateien |
| JavaScript-Syntax `nexowatt-native-shell.js` | Exit 0 | Geänderte Shell-Datei |

Die Tests führen aus den aktuellen Quelldateien extrahierte Methoden mit TypeScript-Transpilierung aus und prüfen echte Handler-Ergebnisse. Sie ersetzen keine Browser-Layoutprüfung. Die Prüfung des vollständig gebauten Frontends mit langen Menüs, Desktop und Mobilansicht sowie der System-/Lizenzdialoge erfolgt im übergeordneten Änderungsnachweis. Eine reale Anlagenprüfung dieses Lieferstands steht bei der Übergabe noch aus.

Rohbelege und Quellbindungen stehen im Unterordner `navigation/`. Die hier dokumentierte Entwicklungsprüfung ist weder IEC-Zertifizierung noch vollständiger CRA-Konformitätsnachweis.

## Kurzer Anlagentest

Nach Sicherung und Update auf 8.0.2 die Seite vollständig neu laden. Als berechtigter Administrator muss **System** am Anfang der Navigation stehen und der Expertenschalter unabhängig von der Länge der Adapterliste erreichbar bleiben. Expertenmodus nach Bestätigung einschalten und wieder ausschalten. System öffnen und vorhandenen Anlagennamen/Standort kontrollieren; die Lizenzverwaltung ist Teil des Systemdialogs. Mit einem eingeschränkten Benutzer dürfen dadurch keine zusätzlichen Verwaltungsrechte entstehen. Bei einer notwendigen Rückkehr zum vorherigen Stand die zuvor gesicherte Konfiguration und den dokumentierten Rückfallweg verwenden.
