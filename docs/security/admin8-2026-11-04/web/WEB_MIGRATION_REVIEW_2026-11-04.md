# Admin 8 Web-Migration – technischer Prüfvermerk

Stand: 04.11.2026; NexoWatt EOS Admin 8.0.0; Node.js 24.22.1.
Vergleich: EOS-7-Bestand, rekonstruierte ioBroker-Admin-7.9.2-Vergleichsbasis und unveränderte ioBroker-Admin-8.3.5-Quelle. Die 21 Konflikte in `src/lib/web.ts` wurden semantisch aufgelöst.

## Umsetzung

- Admin-8-Public-Path-Verarbeitung einschließlich Iframe-Socketpfad, MIME-Typen, JSON-Tab-Validierung, neuer OAuth/WebServer-API und Cache-Verhalten übernommen. Alte feste Chunk-Hashreferenz entfernt.
- EOS-Rollen-/Passwort-/Lizenz-/Upload-/DB-Datei-Grenzen erhalten. DB-Dateien verlangen weiterhin eigene aktuelle Identitätsprüfung und Benutzer-ACL; rekursive ZIP-Ausgabe bleibt deaktiviert. URL-Zugangsdaten werden vor OAuth und Body-Verarbeitung abgelehnt.
- Lokale Anmeldung mit WebServer 3.4.0; SSO (`/sso`, `/sso-callback`, `/sso-token`), offene Clientregistrierung und Authorization-Code-Freigabe bleiben deaktiviert. Externer MCP bleibt deaktiviert. Initialisierung ohne EOS-Session- oder Lizenzdienst bricht vor HTTP-Start ab.
- Gepflegter OAuth-Fork 5.3.1 wird über die vom Dependency-Agenten gesetzte Paket-Aliasauflösung genutzt. Die WebServer-API bleibt unverändert; konkrete HTTP-Anmeldung und Refresh wurden mit derselben User-Objektidentität und EOS-WeakMap-Nachweis geprüft.
- Proxy-Requests umgehen generische Bodyparser und Kompression; Admin-Sitzung und erste Passwortänderung werden vor HTTP-Weiterleitung geprüft. Proxy-eigene aktuelle Ziel-/Rechteprüfung bleibt aktiv. Proxy-Streams schließen bei Widerruf, Passwortänderung und Web-Shutdown. HTTP/2 ist bewusst deaktiviert; TLS über HTTP/1.1 bleibt unterstützt.
- Serialisierte Remote-Logpuffer validieren Bytewerte und 32-MiB-Transferlimit. Anzeigeentscheidungen verwenden tatsächliche Pufferlänge. Entpackung nutzt weiterhin die vorhandenen Ressourcenlimits; ungültige Antworten führen kontrolliert zu Fehlern. Keine unbeschränkte synchronisierte gunzip-Rückkehr.
- `public/404.html` auf neue Platzhalter und öffentliche Rücksprungadresse umgestellt, vorhandenes NexoWatt-Logo eingebettet; Pfadwerte werden vor HTML-Ausgabe escaped. Die frühere clientseitige Reparatur alter Loginpfade wird durch bereits erhaltene Server-Routingkorrektur abgedeckt.
- Explizite `any`, `@ts-expect-error` und doppelte `unknown`-Casts aus `web.ts` entfernt. Die reale strikte Backend-Kompilation und das bereichsbezogene ESLint sind ohne Ausnahmen erfolgreich.

## Nachweise

| Prüfung | Ergebnis | Rohbeleg |
|---|---|---|
| Reale strikte TypeScript-Kompilation mit Emit | bestanden, keine Diagnosen | `web-backend-emit-final.log` |
| ESLint `src/lib/web.ts` | bestanden, keine Fehler/Warnungen | `web-lint-final.log` |
| Neue Web-/OAuth-Integrationsfälle plus Auth-Regressionsfälle | 16/16 bestanden | `web8-behavior-final.tap` |
| Passwortschreiben, Session- und Proxy-Widerruf vor Änderung | bestanden; fehlender Sicherheitsdienst verhindert Schreiben | `web-password-write-final.log` |
| Bestehende isolierte Sicherheitsgrenzen | 40/40 bestanden | `web-security-boundaries-final.log` |

Die neuen OAuth-Prüfungen führen echte Express-/WebServer-/OAuth-HTTP-Anfragen über Loopback aus: Passwort-Grant, Cookieflags, Refreshrotation, Replay-Abwehr, falsches Passwort, ungebundene Prägung, URL-Token-Abweisung sowie Widerruf nach Passwort-, Aktivierungs- und Gruppenänderung. Die ioBroker-Persistenz wird kontrolliert im Speicher simuliert. Die Web-Methoden laufen aus dem real erzeugten Build; ausschließlich der importseitige js-controller-Bootstrap wird ersetzt.

## Grenzen und Integration

Kein Test auf einer laufenden Kunden-/Hausanlage, kein vollständiger Browser-Login mit installiertem js-controller und kein Serien-/IEC-/CRA-Konformitätsnachweis. Die neuen Proxy-Endpunkte haben zum Prüfzeitpunkt einen Administratorzugang nach tatsächlicher `system.group.administrator`-Mitgliedschaft; ein zukünftiger Zugang anderer EOS-Rollen benötigt explizite Ziel-/Rollenregeln. Controller-Datei-APIs liefern bereits vollständig allozierte Puffer; nachgelagerte Größenprüfung begrenzt nicht ihre interne Allokation. Gesamtrelease-/Frontend-/Paketprüfung wird separat vom Hauptagenten konsolidiert.

Datei-Hashes und genaue Prüfzuordnung: `web-migration-evidence.json`. Zuständigkeit: Web-Migration Unteragent; Schlussfreigabe und Auslieferungsdokumentation beim Hauptagenten.
