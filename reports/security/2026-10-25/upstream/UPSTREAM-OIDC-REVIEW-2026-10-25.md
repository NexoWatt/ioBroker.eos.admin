# Upstream-OIDC-Prüfung – 25.10.2026

## Umfang und Methode
Read-only-Quellcodeabgleich über die offizielle GitHub-API. Keine Abfragen gegen produktive ioBroker-Systeme, keine Laufzeitausnutzung, keine Ausführung der Upstream-Tests. GitHub-Release und ioBroker-Stable-Index werden getrennt bewertet. npm-Veröffentlichung und tatsächlich installierter Abhängigkeitsbaum wurden nicht geprüft. Eine Suchmaschinenkopie der README war veraltet; für Tagesstand und Fix wurden direkte GitHub-Antworten verwendet.

## Bestätigter Befund
Die beanstandete fehlende Autorisierung der Benutzerverknüpfung ist in @iobroker/webserver v3.3.0 und v3.3.1 im Quellcode nachweisbar. Beide oauth2.ts-Dateien wurden abgerufen und sind textidentisch. In v3.3.1 prüfen Zeilen 421–426 nur das Vorhandensein des Zielbenutzers. Zeilen 531–540 verknüpfen die verifizierte IdP-Identität mit dem vorhandenen lokalen Benutzer. Die beiden SSO-Routen werden in 547–548 ohne vorgeschaltetes model.authorize registriert; das allgemeine authorize folgt erst später (656).

Voraussetzungen dieses konkreten 3.3.x-Pfads: erreichbarer SSO-Endpunkt; konfigurierter issuer und clientId; funktionierender IdP-Login des Angreifers; vorhandenes Zielkonto. Bei Upstream Admin v8.1.0 erfordert die Übergabe der OIDC-Konfiguration ssoActive sowie issuer/clientId; createOAuth2Server wird im auth-Zweig ausgeführt. Ohne vollständige OIDC-Konfiguration registriert webserver 3.3.x die SSO-Routen nicht. Daher nicht pauschal jede Admin-8-Installation als betroffen einstufen. Auswirkung bei erfüllten Voraussetzungen: unerlaubte Verknüpfung bis zum lokalen Administratorzugriff, nicht lediglich ein kosmetischer Fehler.

## Verifizierter Fix und Veröffentlichungsstand
Fix-Commit a583a8325ffd4836c31a6097a6436f6b81a0074b, 25.10.2026 09:59:22 UTC:
- /sso führt model.authorize als eigene Middleware aus.
- register verweigert Anfragen ohne aufgelösten Benutzer mit 401.
- Verknüpfen eines fremden Benutzers erfordert admin bzw. Mitgliedschaft in system.group.administrator; sonst 403.
- Das Präfix system.user. wird normalisiert.
- Neue Upstream-Tests enthalten Negativfälle anonym, fremder Nicht-Admin und ungültiges Cookie sowie positive Selbstverknüpfung und Administrator-Verknüpfung. Diese Tests wurden hier nur gelesen.

GitHub-Release v3.3.2 erschien am 25.10.2026 10:01:16 UTC. Tag verweist auf Commit ae055b9480321076903912ad2778ea18672c8928. Der Fix ist damit über ein konkretes veröffentlichtes GitHub-Tag belegt und nicht lediglich über die Zusage im Screenshot.

Admin v8.3.4 erschien als GitHub-Release am 25.10.2026 11:25:18 UTC, Tag-Commit d1d86b8d9a83ad10e7d803d20bd77fd2278cc065; package.json verlangt ^3.3.2. Der am Prüfungstag abgerufene offizielle Stable-Index (Commit 18a3a08fb86e7f22e077e69741fd34846342121d, 24.10.2026 21:53:10 UTC) nennt jedoch weiterhin Admin 8.2.0. Dessen Paket verlangt ^3.3.1; Admin 8.1.0 verlangt ^3.3.0. Die Versionsbereiche erlauben spätere Patchstände. Aus der Admin-Versionsnummer allein folgt daher nicht die tatsächlich installierte Webserver-Version. Die Behauptung, der Fix sei bereits im ioBroker-Stable-Kanal ausgerollt, ist durch diesen Index nicht belegt.

## Zwei beanstandete Punkte bleiben im Fix-Tag erhalten
1. v3.3.2 oauth2.ts 542–550 erzeugt weiterhin lokale OAuth-Token und setzt die JSON-Antwort als ssoLoginResponse in die Weiterleitungs-URL. Beim Verknüpfen wird außerdem id_token als URL-Parameter zurückgegeben (578–580). Browserhistorie und URL-Logs sind daher weiterhin ein Vertraulichkeitsrisiko. Ob/wie ein konkreter Proxy URLs protokolliert, wurde nicht geprüft.
2. v3.3.2 oauth2.ts 423 und 471 bildet Origin und Callback weiterhin aus req.protocol und Host. Die vorhandene baseUrl-Option wird in diesem Pfad nicht benutzt. In den untersuchten Admin-web.ts-Dateien v8.1.0/v8.3.4 wurde kein trust-proxy-Setup gefunden. Hinter HTTPS-Terminierung mit internem HTTP kann deshalb ein HTTP-Callback entstehen; die tatsächliche Wirkung hängt von Proxy, Express-Konfiguration und IdP-Redirect-Policy ab. Das ist kein Nachweis eines TLS-Angriffs auf jede Installation.

Zusätzliche klar begrenzte Beobachtung: Der SSO-Zweig setzt access_token per res.cookie ohne explizite Sicherheitsoptionen (v3.3.2, 550). Dies sollte bei einer späteren SSO-Integration separat geprüft und gehärtet werden. Auch Browser-/Sitzungsbindung des Verknüpfungsvorgangs, CSRF-Schutz, Wiederholung und Berechtigungsänderungen während eines ausstehenden Vorgangs brauchen eigene Tests. Der vorliegende Fix ist keine Vollfreigabe des SSO-Designs.

## Bedeutung für den NexoWatt-Admin-7-Zweig
Auch webserver v1.4.0 enthält bereits /sso und /sso-callback (unbedingte Registrierung) mit einem hart codierten Keycloak-Issuer. Das entspricht nicht dem frei konfigurierbaren 3.3.x-Provider, ist aber keine Begründung, Admin 7 automatisch als frei von SSO-Angriffsflächen anzusehen. Eine frühe serverseitige Sperre beider Pfade muss im tatsächlichen NexoWatt-Paket und im Laufzeitverhalten nachgewiesen werden. Kein Wechsel auf Admin 8 wurde vorgenommen oder empfohlen.

## Primärquellen
- Fix: https://github.com/ioBroker/webserver/commit/a583a8325ffd4836c31a6097a6436f6b81a0074b
- Release: https://github.com/ioBroker/webserver/releases/tag/v3.3.2
- Vorher: https://github.com/ioBroker/webserver/blob/v3.3.1/src/lib/oauth2.ts
- Nachher: https://github.com/ioBroker/webserver/blob/v3.3.2/src/lib/oauth2.ts
- Tests: https://github.com/ioBroker/webserver/blob/v3.3.2/test/oidc.test.js
- Legacy: https://github.com/ioBroker/webserver/blob/v1.4.0/src/lib/oauth2.ts
- Admin 8.1.0: https://github.com/ioBroker/ioBroker.admin/blob/v8.1.0/src/lib/web.ts
- Admin 8.3.4: https://github.com/ioBroker/ioBroker.admin/blob/v8.3.4/package.json
- Admin-Release: https://github.com/ioBroker/ioBroker.admin/releases/tag/v8.3.4
- Stable-Index: https://github.com/ioBroker/ioBroker.repositories/blob/18a3a08fb86e7f22e077e69741fd34846342121d/sources-dist-stable.json

Die gespeicherten Quellcodekopien stammen aus dem MIT-lizenzierten ioBroker/webserver; Lizenztext liegt bei. Versions-/Abrufmetadaten stehen in upstream-provenance.json.

