# EOS Admin 8.0.2 – Rollenauflösung der Systemverwaltung

Stand: 05.11.2026. Änderung und Review zur gemeldeten fehlenden Systemverwaltung
und zum Expertenmodus nach erfolgreicher Anmeldung in 8.0.1.

## Befund EOS-A8-SYSTEM-002

`src/lib/web.ts`, Methode `getEosGroupDetailsForUser`, wertete weiterhin `row.id`
aus der Controller-Gruppenansicht als technische Gruppenkennung aus. Die bereits
in 8.0.1 korrigierte Sitzungskontrolle war davon getrennt. Die offizielle Ansicht
des Controllers 7.2.5 gibt an dieser Stelle den Anzeigenamen aus. Namen können
übersetzt sein. Beim Sortieren mehrerer passender Gruppen entstand dann
`a.id.localeCompare is not a function`. Bei einem einfachen Anzeigenamen konnte
die konfigurierte Administrator-/Installateurgruppe nicht erkannt werden.
Der ausdrücklich benannte Standardbenutzer `admin` besitzt zwar eine eigene
Rollenzuordnung; der Fehler beim Gruppensortieren konnte auch ihn vorher treffen.

Auswirkung: Rollen-/Sicherheitskontext nicht verfügbar oder zu geringe erkannte
Rolle trotz gültiger Anmeldung. Die Anzeige von Systemverwaltung und Expertenmodus
konnte dadurch ausfallen. Ein zusätzliches Frontend-Synchronisationsproblem wird
getrennt geprüft. Diese Feststellung ist keine Behauptung, den Browser oder die
konkrete Datenbank der Kundenanlage ausgelesen zu haben.

## Korrektur

- Ausschließlich `row.value._id` ist die Gruppenidentität. Namen und
  Beschreibungen bleiben Anzeigeinformationen und können keine Rechte erteilen.
- Gültiger Gruppentyp, technische Kennung mit nichtleerem Suffix, maximal
  1.024 Zeichen, höchstens 1.024 Zeilen, eindeutige Kennungen und der Arraytyp
  einer vorhandenen Mitgliederliste werden geprüft.
- Deterministische Sortierung nach technischen Kennungen.
- Eine ungültige oder nicht verfügbare Ansicht erzeugt
  `EOS_SECURITY_GROUPS_UNAVAILABLE`. Es wird weder eine Teilmenge als vollständig
  ausgegeben noch eine Ersatzrolle als gültiger Kontext angenommen.
- Benutzer-/Passwortprüfung, Sitzungswiderruf, Rollenberechtigungen und
  verschlüsselte Lizenzablage bleiben unverändert.

## Ausgeführte Prüfungen

`test/eos-admin8-role-context.test.cjs` führt den aktuellen TypeScript-Webcode
transpiliert aus und verwendet die tatsächlich installierte OAuth-/WebServer-
Implementierung. Nur Controller-Objekte und Sitzungsspeicherung sind synthetisch.
Die Gruppenansicht stammt aus der bestehenden, quellengebundenen Fixture
`test/fixtures/controller-7.2.5-group-view.json`.

| Prüfung | Ergebnis |
| --- | --- |
| Derselbe Test gegen unveränderten Webcode 8.0.1 | 0/5 bestanden; Fehler reproduziert |
| Korrigierter Webcode, Node.js 24.22.1 | 5/5 bestanden, keine übersprungenen Tests |
| Korrigierter Webcode, Node.js 22.23.4 | 5/5 bestanden, keine übersprungenen Tests |
| Backend-Typprüfung `tsc -p tsconfig.build.json --noEmit` | Erfolgreich |
| ESLint `src/lib/web.ts` mit Projektkonfiguration | Erfolgreich |

Geprüft wurden Standard-Admin und abweichender Benutzername mit Administratorgruppe,
konfigurierte Servicegruppe, Installateur, Endkunde, übersetzte und identische
Anzeigenamen, manipulierte Anzeige-IDs, ungültige/fehlende/zu viele Gruppen,
duplizierte technische Kennungen und Datenbankfehler. Die HTTP-Prüfung meldet
Testkonten am echten OAuth-Endpunkt an und ruft Sicherheitskontext und geschützten
Lizenzstatus jeweils mit Cookie und Bearer-Token auf. Nur die Administratorrolle
erhält den Lizenzstatus; Installateur, Endkunde und anonyme Anfrage werden abgelehnt.

Rohbelege: `role-context-before.log`, `role-context-test.log`,
`role-context-node22.log`, `role-context-lint.log`. Die leere Lintdatei ist die
erfolgreiche Ausgabe ohne Befunde. Die Vorher-Prüfung verwendete die unveränderte
lokale Kopie des ausgelieferten 8.0.1-Webcodes; die temporäre Testkopie wurde entfernt.

## Lizenzschnittstelle und Grenzen

Die vorhandene Schnittstelle akzeptiert ein gültiges HttpOnly-Zugriffscookie oder
den Bearer-Header. Sie verlangt ein aktiviertes Konto mit Administratorrolle und
abgeschlossener persönlicher Passwortvergabe. Außerhalb von Loopback wird HTTPS
verlangt. Schreibzugriffe behalten Same-Origin-Prüfung, `X-EOS-License: 1`, kleine
Bodygrenze und Ratenbegrenzung. Der neue Systembereich darf diese bestehende
Schnittstelle verwenden; eine zweite Lizenzablage ist nicht erforderlich.

Kein Test auf einer laufenden echten Controller-/Windows-/Kundenanlage wurde hier
ausgeführt. Die Browserintegration und der vollständige Releasebau werden im
übergeordneten Prüfvermerk geführt. Keine vollständige IEC-/CRA-Konformität oder
Unabhängigkeit einer externen Sicherheitszertifizierung wird daraus abgeleitet.
