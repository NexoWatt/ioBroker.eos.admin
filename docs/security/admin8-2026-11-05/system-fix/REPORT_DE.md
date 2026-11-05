# Prüfvermerk EOS Admin 8.0.2 – Systembereich und Expertenmodus

Stand: 05.11.2026. Vollständiges Repository auf Basis des ausgelieferten Login-Fixes 8.0.1. Dominique bestätigt die funktionierende Anmeldung auf seiner Anlage; das ist eine Nutzerbeobachtung, kein hier ausgeführter Anlagentest. Quell-/Artefaktbindung und Umgebungen: `validation.json`.

## Ergebnis und Änderungen

- **EOS-A8-SYSTEM-001 – abgeschnittene Bedienelemente:** Admin 8 verschob System- und Expertenbedienung in den unteren Bereich der vertikalen Navigation. Das EOS-Layout stellt diese Navigation waagerecht dar und schnitt die Elemente ab. System und Experte stehen jetzt vor der unabhängig scrollenden Adapterliste. Die Kopfzeile bleibt auch ohne Anlagennamen vorhanden. Auf kleinen Bildschirmen erfolgt der Zugang über den beschrifteten Menüknopf. Systemreiter erhalten lesbaren Kontrast und Tastaturfokus.
- **EOS-A8-SYSTEM-002 – Rollen-/Gruppenkontext:** Eine weitere Gruppenabfrage verwendete noch den Anzeigenamen aus `row.id` statt der technischen ID aus `row.value._id`. Übersetzte Namen konnten einen Fehler auslösen, individuelle Administratorkonten falsch eingestuft werden. Die Abfrage prüft nun die technischen IDs und lehnt fehlerhafte, doppelte oder unvollständige Antworten ab. React verwendet den geprüften Rollenstatus auch nach Rechteentzug. Die Passwort- und Sitzungsprüfung aus 8.0.1 bleibt erhalten.
- **EOS-A8-SYSTEM-003 – Lizenzintegration und Fehlerrückmeldung:** Die vorhandene EOS-Lizenzverwaltung liegt als Reiter **EOS Home / Pro** im Systembereich; der schwebende Knopf entfällt. Native Plattformlizenzen bleiben separat als Adapter-Lizenzen erhalten. Lade-/Speicherfehler blockieren nicht dauerhaft und werden nicht mehr als Erfolg ausgegeben.

Die native Basiseinstellung enthält weiterhin Kunden-/Anlagenname, Sprache, Einheiten, Expertenmodus und Standort. `system.config.common.siteName` bleibt das vorhandene Feld für den im Nutzerbild gezeigten Kundennamen. Keine Datenmigration, kein Passwortreset, kein neuer Lizenzspeicher und keine Änderung des Home-/Pro-Formats oder der UUID-Bindung.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis und Grenze |
| --- | --- |
| Backend- und Frontend-Typprüfung, gezieltes ESLint | bestanden für geänderte Bereiche; Belege der jeweiligen Teilberichte |
| Vollständiger Front-/Backend-Build | bestanden; vorgebaute Laufzeit enthalten; Public-Assets tragen `eos-release=8.0.2` zur Cachetrennung |
| Paketprüfungen | 74 bestanden |
| EOS-Verhaltenstests | 269 bestanden, 0 fehlgeschlagen, 0 ausgelassen |
| Entwicklungsnachweis | 8 erfolgreiche Prüfgruppen, 773 gebundene Eingabedateien |
| Browserprüfung | 25 Abläufe auf Desktop, schmaler Ansicht und Endnutzerprofil; echte React-Oberfläche, synthetische Controller-/Lizenzantworten |
| Rollen-/OAuth-/Lizenzgrenze | aktuelle Web-Implementierung mit echten HTTP-/OAuth-Modulen; individuelle Benutzer, Cookie/Bearer, erlaubte und verweigerte Rollen geprüft; Persistenz simuliert |
| Node-22-Installation | vollständiges gepacktes npm-Artefakt in frischem Verbraucherverzeichnis installiert, Installationsskripte aktiv; Node 22.23.4/npm 10.9.9, 274 Pakete, Exit 0 |
| Anmeldung nach Paketinstallation | Node 22.23.4 und 24.22.1: gültiges Kennwort akzeptiert, falsches abgewiesen, Refresh erfolgreich, alte Sitzungen nach Kennwortänderung widerrufen; Controller-Persistenz simuliert |
| Produktionsabhängigkeiten | `npm audit --omit=dev` des tatsächlich installierten Verbraucherbaums: 0 gemeldete Befunde; kein Vollständigkeits- oder Sicherheitsversprechen |
| Kopierübernahme 8.0.1 → 8.0.2 | vollständige ältere ZIP mit neuer Lieferung überlagert; 63 bekannte Altdateien mit Hashprüfung gesichert und entfernt; Git-Metadaten, Abhängigkeitsmarker und Nutzernotizen erhalten |
| Veröffentlichung ohne Upload | normaler `npm publish --dry-run --json` nach Kopierübernahme unter Node 22/npm 10: Exit 0; aktuelle versiegelte Dateien unverändert |
| Build-/Paketintegrität | 1181 Quell-/Laufzeitdateien versiegelt; veraltete Zwischenbuild-Chunks aus der Laufzeit entfernt; Komponenten-/Lizenzinventar aktualisiert |

Der neue Entwicklungsnachweis enthält auch die neuen Tests, die TypeScript/React oder installierte HTTP-Module benötigen. Bei der Veröffentlichung einer vorgebauten ZIP ohne Entwicklungspakete wird der an exakt diese Quellen gebundene erfolgreiche Nachweis geprüft. Es wird weder still neu gebaut noch veränderter Code automatisch neu versiegelt.

Der erste Build mit verknüpften Entwicklungspaketen wurde vom Komponentenabgleich wegen außerhalb des Arbeitsbaums liegender Modulpfade zurückgewiesen. Die Abhängigkeiten wurden unverändert in reale lokale Verzeichnisse übernommen, neu gebaut und vollständig zugeordnet: 168 Frontendpakete, 0 unklassifizierte Module. Die Prüfung wurde nicht abgeschwächt. Vorhandene deklarierte optionale Abhängigkeiten und der dokumentierte Hinweis zur fehlenden separaten Lizenzdatei von `size-sensor@1.0.2` bleiben im Komponentenbericht sichtbar.

## Sicherheitswirkung und offene Grenzen

System-/Expertenzugriff bleibt auf die vorgesehenen Rollen begrenzt. Die neue EOS-Lizenzansicht ist ausschließlich für die serverseitig ermittelte Administratorrolle vorgesehen; Backendautorisierung bleibt verbindlich. Same-Origin-/CSRF-Prüfung, HTTPS außerhalb Loopback, Raten-/Größenlimits und verschlüsselte Ablage bleiben erhalten. Aktivierungscodes werden nicht in Browser-Speicher geschrieben oder aus dem gespeicherten Bestand zurück angezeigt. Antworten sind begrenzt, geprüft und auf öffentliche Statusfelder reduziert; Anfragen werden nach fünf Sekunden beziehungsweise beim Verlassen abgebrochen.

Das vorhandene Speichern mehrerer Systemobjekte ist keine atomare Transaktion. Nach einem Teilerfolg kann ein späterer Schreibvorgang scheitern; die Oberfläche meldet dies jetzt ausdrücklich und erhält den Entwurf. Bestehende Kartendienste wurden nicht geändert; die Browserprüfung verwendet synthetische Kacheln und weist deren reale Erreichbarkeit nicht nach.

Nicht durchgeführt: Installation auf Dominiques Anlage, native Windows-Ausführung, echte Mobilhardware, kundenspezifischer Key-Generator-/Lizenzimport, externe Penetrationsprüfung oder allgemeine Serienfreigabe. Es wurde nichts auf npm veröffentlicht oder in Git hochgeladen. Der Node-24-HTTP-Test nutzt den unter Node 22 installierten identischen Abhängigkeitsbaum. Die separat inventarisierte WebServer-Quellkomponente wird nicht durch npm-Audit allein bewertet.

IEC 62443 und OWASP ASVS bleiben Entwicklungs- und Prüfbezug; dieser Bericht ist keine vollständige IEC-/CRA-Konformitätsbewertung oder Zertifizierung. Die bestehenden allgemeinen Nachweislücken bleiben bestehen. Innerhalb des beschriebenen Änderungsumfangs sind keine kritischen Prüfungen fehlgeschlagen oder ungeklärte Integritätsabweichungen offen.

## Übernahme und Rückfall

Anleitung: `START_HERE_8.0.2.md`. Vor Übernahme eigene Git-Änderungen sichern; vor Anlagenupdate ein erfolgreiches Backup erstellen. ZIP-Inhalte wie bisher übernehmen und Version 8.0.2 aus VS Code veröffentlichen, erst danach über PuTTY installieren. Vorhandene Benutzer, Kennwörter, Anlagen-/Standortdaten und Lizenzen weiterverwenden.

Auf der Anlage System öffnen, gespeicherte Werte kontrollieren, Expertenmodus ein/aus prüfen und vorhandenen Home-/Pro-Status ansehen. Eine gültige Lizenz für diesen Test nicht entfernen. Bei Rückfall auf 8.0.1 dessen bekannte Einschränkung der Systemnavigation beachten. Für diese Änderung gibt es keine Datenformatmigration.

Rohbelege liegen in `release/`, `browser/` sowie den Teilberichten in diesem Ordner. Der intern installierte npm-Tarball ist in `validation.json` gehasht; die abschließende Repository-ZIP enthält zusätzlich die danach erzeugten Prüfbelege. Der darin enthaltene ausführbare Stand ist über dieselbe unveränderte Versiegelung gebunden.
