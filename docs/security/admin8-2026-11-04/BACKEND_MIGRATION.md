# Admin 8: Backend-Migration und Sicherheitsnachweis

Stand: 04.11.2026. Lieferstand: EOS Admin 8.0.0, Teststand. Dieser Vermerk beschreibt den Backend-Anteil; Gesamtfreigabe, Abhängigkeiten, Webserver/Proxy und Oberfläche haben zusätzliche Nachweise im selben Verzeichnis.

## Herkunft und Umfang

Die Migration verwendet den echten ioBroker-Admin-Quellstand **v8.3.5**, Commit `6f77eedf525813a7a61d79188d1ff05dffd05086`, mit Dreiervergleich gegen **v7.9.2**, Commit `d5b9a4d11ed79cece0f097e0225a8aad72b68e6d`. Die EOS-Anpassungen stammen aus EOS Admin **7.10.12**. Der frühere, unvollständige Admin-8-Versuch ist keine Quellbasis.

Übernommen und angepasst wurden `src/main.ts`, Backend-Typen, `objectFixes.ts`, die gemeinsamen URL-Hilfen und die neue Admin-8-Logsuche. Die Webserver-/Proxy-Migration ist gesondert dokumentiert. Die EOS-Rollenprüfung, verzögerungsfreie Sitzungswiderrufe, Passwortpflichten, sichere Startsequenz, Schutzregeln für Systemobjekte, HTTPS-Datenabrufe und NWL2-Lizenzverwaltung bleiben erhalten. Home/Pro-Signaturprüfung, UUID-Bindung, Hersteller-Vertrauensschlüssel und verschlüsselte Lizenzablage wurden nicht durch einen neuen Lizenzmechanismus ersetzt.

Die Admin-8-Logsuche und Antworten über GUI-Abonnements sind tatsächlich integriert. Die neue GUI-Berechtigung ist an den authentifizierten Socket, dessen Benutzer, den Sicherheitsstand der Sitzung, die Rolle und ein Ablaufdatum gebunden. IPC-Aufrufe müssen vom eigenen EOS-Socketadapter stammen und den dort authentifizierten Benutzer benennen. Nach Widerruf, Socketverlust oder Rechtewechsel wird auch ein bereits berechnetes Ergebnis nicht mehr zugestellt. Ausbleibende/ungültige Dispatcher-APIs verhindern den Socketstart, statt die EOS-Rechteprüfung still zu überspringen.

## Bewusste Abweichungen von Upstream

| Bereich | Verhalten im EOS-Lieferstand | Grund |
| --- | --- | --- |
| AI/MCP-Chat | Bereits deaktivierte Chat-Befehle bleiben abgelehnt; unerreichbare Implementierung und deren Builddateien entfernt. | Kein zusätzlicher KI-/Werkzeugzugriff oder unnötige Laufzeitabhängigkeit. |
| `verifyAdapterCore` | Versionsdiagnose bleibt; automatischer Shellaufruf `npm install` beim Adapterstart entfernt. | Keine unkontrollierte Änderung der gemeinsam genutzten Controller-Laufzeit aus dem Dienstprozess. |
| Betriebssystem-Passwörter | Legacy-RPC deaktiviert; Hinweis auf autorisierte Betriebssystemwartung. Keine automatischen Loginversuche. | Keine Vermischung von EOS-Rollen und Betriebssystemidentitäten, kein `su`-Pfad im Anwendungsbetrieb. |
| Neue Logsuche | Live-Autorisierung, begrenzte Parallelität und Datenmengen; lokale Dateien ohne Folgen eines finalen Symlinks unter der geprüften Linux-Umgebung. | Diagnosefunktionen enthalten möglicherweise vertrauliche Logdaten und dürfen Ressourcen nicht unbeschränkt belegen. |

Die **ioBroker-Benutzerverwaltung und persönliche Passwortänderung** bleiben bestehen. Die deaktivierte Funktion betrifft ausschließlich Betriebssystemkonten. Bestehende Hinweise zur früheren Betriebssystem-Passwortprüfung führen jetzt zu einer erklärenden Anzeige statt einem Änderungsformular.

## Befund EOS-ADMIN8-OS-CREDENTIAL-001

**Befund:** Der geerbte `admin:setPassword`-Nachrichtenpfad rief die Betriebssystem-Passwortänderung ohne eigene EOS-Rollenprüfung auf. Die Hilfsfunktion startete `su`/`passwd`. Zusätzlich führte der Adapter beim Start Loginversuche mit bekannten Betriebssystem-Standardpasswörtern aus. Ein separat ausgeliefertes Testprogramm enthielt denselben Zugriffspfad.

**Angriffsbedingungen:** Ein Aufrufer, der die entsprechende IPC-Nachricht absetzen kann, konnte den Pfad erreichen. Die Betriebssystemänderung benötigte weiterhin die vom Betriebssystem akzeptierten bisherigen Anmeldedaten; eine passwortlose Übernahme wurde nicht nachgewiesen. Der fehlende Rollenübergang und der privilegierende Anwendungsweg widersprachen dennoch dem EOS-Sicherheitsmodell.

**Maßnahme:** `admin:setPassword` antwortet für sämtliche Rollen mit `EOS_OS_PASSWORD_MANAGEMENT_DISABLED`, Status 410. `admin:getNotificationSchema` zeigt ausschließlich den Wartungshinweis. Eingehende Anmeldedaten werden weder verarbeitet noch gespiegelt. Automatische Prüfaufrufe und die Dateien `checkLinuxPass`/`testPassword` wurden aus Quelle und Build entfernt. Für Betriebssystemkonten sind die dafür autorisierten Wartungswerkzeuge zu verwenden; kein Ersatz-RPC wurde eingerichtet.

**Nachweis:** Ausgeführte Tests des tatsächlich emittierten Admin-Codes prüfen Administrator, Installateur, Endkunde und fehlenden Benutzer, die Abwesenheit der Prober im Liefercode und den Erhalt der ioBroker-Passwortbereitstellung. Kein echter Betriebssystem-Login oder Passwortwechsel wurde dafür ausgeführt.

## Ressourcen und Vertrauensgrenzen der Logsuche

- Höchstens eine aktive Suche je Benutzer und vier gleichzeitig je Adapter; maximal 256 GUI-Berechtigungen, maximal eine Stunde Lebensdauer und nie länger als die konfigurierte Loginlaufzeit.
- Höchstens 8 MiB je Logdatei, einschließlich entpackter Gzip-Daten; höchstens 64 ausgewählte Dateien, 5.000 Ergebniszeilen und 4 MiB Ergebnistext. Sehr große Dateien werden abgelehnt, nicht vollständig in den Browser geladen.
- Lokale Dateilesevorgänge und einzelne Controller-Anfragen haben ein 5-Sekunden-Limit. Die Suchschleife prüft ein 30-Sekunden-Budget. Das ist **keine garantierte 30-Sekunden-Gesamtdeadline** für vorgeschaltete Dateisystem-/Datenbankabfragen und die gesamte Remote-Ermittlung. Ausstehende Datenbankoperationen halten ihren begrenzten Suchplatz; es werden keine unbeschränkten Ersatzoperationen gestartet.
- Controller-Antworten werden auf Typen, Größen und Werte geprüft. Unbekannte Dateinamen, Traversal, übergroße Gzip-Ausgaben und nicht passende GUI-Identitäten werden abgewiesen.
- Der ioBroker-Controller und Prozesse mit denselben Datenbank-/Betriebssystemrechten sind keine gegeneinander isolierten Mandanten. Eine lokale Vollkontrolle kann durch diese Adapterprüfung nicht aufgehoben werden.

## Ergänzende Qualitätskorrekturen

Der vollständige Backend-Lintlauf wurde erstmals gegen die migrierte Konfiguration ausgeführt. Der Großteil der geerbten Befunde betraf Formatierung und Blockklammern. Diese wurden ohne Abschalten von Regeln korrigiert. Zusätzlich wurden ungenutzte Fehlerbindungen entfernt, die vorhandene Ablehnung von Steuerzeichen ohne problematische Regex-Schreibweise ausgedrückt und nicht-stringförmige Fetch-Metadaten abgewiesen, ohne fremde `toString`-Methoden aufzurufen. Die atomare Lizenzablage bewahrt einen primären Schreibfehler sowie eventuelle Aufräumfehler; Aufräumfehler überschreiben die ursprüngliche Ursache nicht mehr. Dafür bestehen eigene Negativtests.

## Prüfstand und Grenzen

Die Befehle, Exitcodes, Node-/Betriebssystemversion, Rohlogs und SHA-256-Bezüge stehen in `backend-evidence.json` und den benachbarten Text-/TAP-Dateien. Die finale Gesamtprüfung des Release-Prozesses hat Vorrang vor einem früheren Zwischenlauf.

Die Tests verwenden echte lokale temporäre Dateien, Gzip-Daten und den emittierten JavaScript-Code, wo angegeben. Controller, Benutzerzustand und Socketgrenzen werden in den Backend-Tests simuliert. Die gesamte ioBroker-Installation auf der Hausanlage, Windows-Laufzeit, Gerätebetrieb, Update/Restore auf dem Zielsystem und eine unabhängige Sicherheitsprüfung sind hier **nicht nachgewiesen**. Der Symlink-Test wurde unter Linux ausgeführt; Windows benötigt dafür passende Betriebssystemunterstützung beziehungsweise Berechtigungen.

Der neue GUI-Sitzungshelfer besteht zusätzlich das strenge Profil mit `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns` und weiteren Prüfungen. Der Gesamtbackend-Build besteht das im Repository aktivierte Strict-Profil. Bestehende JavaScript-Dateien werden vom Build kopiert und gelintet; `checkJs` ist im Gesamtprojekt weiterhin deaktiviert. Dies ist kein vollständiger Typnachweis sämtlicher geerbter JavaScript-Module.

Dieser Stand ist eine belegte Migration und Härtung, keine Zusicherung „ohne Sicherheitslücken“ und keine IEC- oder CRA-Zertifizierung. Für die Betriebsfreigabe sind die dokumentierten Zielsystem- und Integrationsprüfungen erforderlich.

Abschließender vollständiger Backend-Lintlauf (`npm run lint-backend`) und TypeScript-Prüfung (`tsc --noEmit`) sind erfolgreich; siehe `backend-full-lint-final.txt` und `backend-typecheck-final.txt`. Der spätere vollständige `npm test`-Lauf enthält 74 echte Paketprofilprüfungen und 200 EOS-Tests, jeweils ohne Fehler. Die 195 Tests im früheren `backend-evidence.json` bleiben als zeitlich früherer Lauf erhalten. Paketprofil und dessen ausdrücklich begrenzte Abweichungen sind in `PACKAGE_TEST_PROFILE.md` und `package-test-evidence.json` dokumentiert.
