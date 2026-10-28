# Authentifizierung, Sitzungen und OIDC – Prüfung 25.10.2026

Prüfgegenstand: unveränderter EOS Admin 7.10.11 aus dem vollständigen Repository-ZIP
mit SHA-256 `c58a4c03b3f3113455bf1a3492b942307902deabf3fd8f670670ff16955f9a92`.
Node.js 24.22.1, isolierte lokale Ausführung. Keine Live-Anlage, kein installierter
ioBroker-Controller, kein normaler npm-Build, kein vollständiger Express-/Socket-Test.
Keine Produktionsdatei geändert. Dieser Teilbericht ersetzt keine Konformitätsbewertung.

## Gemeldeter OIDC-Angriff

Der Screenshot betrifft neuere Upstream-SSO-Kontoverknüpfungen. Der untersuchte
7.10.11-Lock enthält `@iobroker/webserver` 1.4.0 (`package-lock.json:1352`).
Auch dieser Legacy-Webserver enthält eigene SSO-Routen mit festem Keycloak-Issuer;
Version 7 allein begründet daher keine Entwarnung. Der separat abgerufene
Originalquellcode liegt in `../upstream/webserver-v1.4.0-oauth2.ts`.
Zusätzlich registrieren `src/lib/web.ts:1911` und `build/lib/web.js:1747` die festen
Antworten 403 für `/sso` und `/sso-callback` **vor** `createOAuth2Server`.
Diese Reihenfolge wurde in Quelle und ausgeliefertem JavaScript geprüft.
Es wurde in diesem Arbeitsstand kein ausführbarer SSO-Kontoverknüpfungsweg wie im
Screenshot gefunden. Das ist keine Aussage über die tatsächlich installierten
Pakete auf Kundensystemen oder über den vorbereiteten 8er-Zweig.

Der Routenblock ist eine zusätzliche Schutzschicht, kein Ersatz für einen reparierten
Upstream beim späteren 8er-Wechsel. Case-/Trailing-Slash-/Encoding-Varianten wurden
ohne installierten Express-Router nicht als HTTP-Test ausgeführt. Aus einer statischen
Routenprüfung darf kein bestandener Netz-Penetrationstest abgeleitet werden.

## Neu reproduzierte Befunde

### AUTH-OCT-01 – Offene Weiterleitung, mittel

`src/lib/web.ts:1748–1792`, Nutzung `:1923–1929` und `:2008–2022`;
ausgeliefert `build/lib/web.js:1584`, `:1761`, `:1848`.

`getSafeLoginOrigin` erlaubt protokollrelative Pfade und Backslashes. Der Aufruf mit
`origin=//attacker.invalid/x/index.html` ergibt `//attacker.invalid/x`. Zusammen mit
der Login-Seite entsteht ein externes Redirectziel. Auch `/\\attacker.invalid/...`
wird akzeptiert; Browser können den Backslash als Slash behandeln.

Ein Angreifer kann damit einen vertrauenswürdig aussehenden Admin-Link zu einem
fremden Login/Phishing-Ziel umleiten. Die Prüfung beweist die Rückgabe des unsicheren
Redirectpräfixes durch die originale ausgelieferte Methode; kein Credential-Diebstahl
und kein echter Browserdurchlauf wurden ausgeführt.

Korrektur: feste lokale Loginroute bevorzugen. Falls Pfadpräfixe erforderlich sind,
Kontrollzeichen, Backslashes und führendes `//` ablehnen; mit festem vertrauenswürdigem
Basisorigin parsen, gleiche Origin erzwingen und nur normalisierte lokale Pfade
zurückgeben. Doppelte Dekodierung vermeiden. Negativtests müssen die aufrufende
Produktmethode sowie die tatsächliche `Location`-Antwort prüfen.

### AUTH-OCT-02 – Alte kennwortlose Kontenübernahme bleibt bedingt möglich, hoch

`src/lib/web.ts:1045`, `:1138–1152`, `:1199–1252`, `:1255–1307`, Registrierung
`:2032–2044`; ausgeliefert `build/lib/web.js:866`, `:949`, `:1004`, `:1063`.

Der kennwortlose Erstaktivierungsweg ist grundsätzlich aktiv, solange
`eosPasswordlessFirstLogin` nicht ausdrücklich `false` ist. Bei einem aktivierten
Nichtadmin-Konto mit `native.nexowattEosAccount.passwordlessFirstLoginAllowed:true`
und notwendiger Kennwortvergabe reichen Benutzername und zulässige private
Netzwerkadresse zur Claim-Ausstellung und anschließenden Kennwortänderung.
Es wird weder das bisherige Kennwort noch ein vorher außerhalb dieses Endpunkts
ausgegebenes Geheimnis verlangt. Origin und selbst gesetzte `x-nexowatt-*`-Header
authentifizieren einen eigenständigen HTTP-Client nicht.

Im Harness lief die originale Claim-Methode mit einem solchen Altbestand auf 200;
der anschließende originale Kennwort-Handler erreichte die Kennwortschreibfunktion
und antwortete 200. Die Controller-Schreibfunktion war ein Spy; keine realen
Kontodaten wurden geändert. Private Adresse und Kontoflags waren simuliert.

**Geltungsgrenze:** Aktuelle Standardkonten-Provisionierung deaktiviert die bekannten
gemeinsamen Startkonten; regulärer Reset setzt `passwordlessFirstLoginAllowed:false`.
Es ist keine Aussage, dass ein ausgeliefertes System heute ein solches Konto hat.
Das Restrisiko besteht bei erhaltenen Altflags, extern angelegten Konten oder
späterer Reaktivierung. Admin-Konten sind explizit ausgeschlossen; Installateur-
Konten besitzen dennoch weitreichende Rechte.

Korrektur: alle drei alten kennwortlosen Endpunkte deaktivieren und verbliebene
Aktivierungsflags kontrolliert migrieren. Neue Erstvergabe nur mit individuell
ausgegebenem zufälligem Einmalgeheimnis oder authentifiziertem berechtigtem Admin.
Geheimnis gehasht, kurzlebig und atomar einmalig konsumieren; LAN-Zugehörigkeit
darf nicht als Identitätsnachweis gelten. Auch ein bereits ausgegebener Claim muss
bei zentraler Abschaltung ungültig werden; der jetzige Passwort-Endpunkt prüft das
globale Enable-Flag nicht selbst.

### AUTH-OCT-03 – Origin-Prüfung verwendet das Transportschema nicht, mittel als Härtungslücke

`src/lib/web.ts:1538–1539`, `src/lib/eosRequestSecurity.ts:2–22`;
ausgeliefert `build/lib/web.js:1370` und `build/lib/eosRequestSecurity.js`.

Die Hilfsfunktion kann das Schema prüfen, der produktive Aufrufer übergibt aber
nur Header. Die originale Produktmethode akzeptiert somit beispielsweise
`Origin: http://eos.local:8188` bei HTTPS, gleichem Host/Port und fehlendem
`Sec-Fetch-Site`. Der bestehende Selbsttest übergibt das Schema ausdrücklich und
deckt diese Verdrahtungslücke nicht ab.

Das ist eine reproduzierte unvollständige Same-Origin-Prüfung. Ein vollständiger
CSRF-Angriff ist damit nicht bewiesen: moderne Browser-Fetch-Metadata,
SameSite-Cookies und bei vielen Routen zusätzliche benutzerdefinierte Header
begrenzen die Ausnutzbarkeit. Nicht als bereits bestätigte Kontoübernahme bewerten.

Korrektur: erwartetes Schema aus der tatsächlich sicheren, ausdrücklich konfigurierten
Transportgrenze übergeben. Reverseproxy-Header ausschließlich von ausdrücklich
vertrauenswürdigen Peers akzeptieren; vorzugsweise feste erlaubte externe Origins.
End-to-End-Tests sollen HTTP→HTTPS, Host/Port, fehlende Fetch-Metadata und echte
Browser-Cookies abdecken.

### AUTH-OCT-04 – Zugangsdaten in Query-Strings weiter akzeptiert, mittel/Expositionsrisiko

`src/lib/web.ts:565–598`, `:1675–1681`, `:1939–1943`;
ausgeliefert `build/lib/web.js:418`; Original-Upstream-Fixture
`test/fixtures/oauth2-model-v1.4.0.ts:98–161`.

Der EOS-Leser akzeptiert `?token=...`. Das originale OAuth-Modell akzeptiert
zusätzlich `?user=...&pass=...`, selbst wenn `noBasicAuth:true` gesetzt ist.
Der produktive EosSessionSecurity-Wrapper verhindert diese Alternative nicht.
Beides wurde isoliert ausgeführt: Token authentifiziert am simulierten
Sessionbackend; Benutzer/Kennwort-Query authentifiziert am simulierten
Passwortbackend unter dem realen Original-OAuth-Modell.

Damit können Anwender/Integrationen gültige Zugangsdaten in Browserhistorie,
Proxy-/Access-Logs oder weitergereichte Links bringen. Das ist kein Beleg, dass
unser Admin automatisch solche URLs erzeugt oder bereits Geheimnisse abgeflossen sind.
Auch bei abgeschaltetem OIDC sollte dieser allgemeine URL-Zugangspfad geschlossen
werden. Die SSO-spezifische `ssoLoginResponse`-Frage ist separat upstream zu bewerten.

Korrektur: vor der gesamten OAuth-Verarbeitung sicherheitsrelevante Queryparameter
(`token`, `user`/`pass` als Loginmechanismus) ablehnen; reguläres Login über POST,
danach geschützte Cookies oder expliziten Authorization-Header nutzen. Bestehende
Integrationen gezielt umstellen. Nur den EOS-Tokenleser zu ändern reicht nicht,
da das Upstream-Modell die Identität vorher setzen kann.

## Bestätigte Schutzmaßnahmen und verbleibende Integrationsrisiken

- Quelle und Runtime erzwingen `auth:true`; HTTP ist auf lokale Peers/Hosts begrenzt.
- `eosSessionSecurity.js` ist in Quelle und ausgeliefertem Build bytegleich.
  Passwort-/Enabled-/Gruppenänderungen invalidieren Tokens; eine neue Epoche
  verhindert Wiederverwendung nach Neustart. Ungebundene Tokenausstellung ist gesperrt.
- Socket-Widerruf wird unmittelbar vor relevanten Kontoänderungen ausgelöst.
  Ausfälle und Authentifizierungsrennen werden geschlossen behandelt; ein zusätzlicher
  5-s-Wächter erkennt verpasste Objektänderungen. 15 vorhandene Tests bestanden erneut.
- 40 bestehende Boundary-Tests des ausgelieferten Codes bestanden erneut, einschließlich
  gesperrter Host-Kommandos für Nichtadmins und der Rollen-/Kontenprüfungen.
- Die Tests simulieren DB, Controller und Sockettransport. Tatsächliche Middleware-
  Reihenfolge, Session-/Socket-Reconnect und vollständige Origin-/Cookie-Grenzen
  auf der installierten Versionskombination bleiben offen.
- `sendTo`, Dateibefehle und schreibbare Adapter-/Skriptobjekte benötigen eine separate
  vollständige Rollenmatrix. Installateur-Gruppen erhalten generell Datei-/Objekt-
  Schreibrechte und `other.sendto`; der EOS-Guard verbietet nicht pauschal jedes
  privilegierte Adapterziel (`src/main.ts:1156–1183`, `:1481–1558`). Das ist ohne
  die realen Zieladapter-/Objekt-ACLs noch kein nachgewiesener Eskalationspfad.
- Der allgemeine EOS-Login-Gate hat Dateiendungs-Ausnahmen. Eine separate
  Oberflächenprüfung untersucht deren Zusammenspiel mit `/files/`; diesen Befund
  im Gesamtbericht berücksichtigen. Das originale OAuth-Modell ruft bei vollständig
  fehlenden Zugangsdaten lediglich `next()` auf, ohne den Request selbst zu sperren.
  Der inzwischen geprüfte Originalquellcode `webserver-v1.4.0-oauth2.ts:117–378`
  registriert davor nur SSO-, Token- und Logout-Routen und abschließend
  `options.app.use(model.authorize)`. Er enthält keine weitere allgemeine Sperre
  für anonyme `/files/`-Anfragen. Damit ist die von der Oberflächenprüfung
  angenommene Middleware-Reihenfolge auch am Upstream-Quellcode nachvollziehbar;
  der echte installierte Express-/Controller-Test bleibt trotzdem ausstehend.
- Upstream-Logout löscht Access- und zugehörigen Refresh-Token bereits vor der
  späteren EOS-Logoutroute (`webserver-v1.4.0-oauth2.ts:331–374`). Aus der nur
  cookiesäubernden zweiten EOS-Route allein darf daher **kein** Befund fehlender
  serverseitiger Tokenlöschung abgeleitet werden. Logout bestehender WebSockets
  ist weiterhin Bestandteil des noch offenen echten Integrationstests.

## Prüfbelege

`results.json` enthält genaue Kommandos, UTC-Start/Ende, Exitcodes und Loghashes.

| Beleg | Ergebnis | Grenze |
|---|---|---|
| `01-eos-session-security.test.cjs.log` | 15/15 bestanden | Originalmodell, DB-/Socket-Doubles, echte Timer |
| `02-nexowatt-security-boundaries-selftest.cjs.log` | 40/40 bestanden | Originale ausgelieferte Methoden isoliert |
| `03-targeted.cjs.log` | Neue Befunde reproduziert, Exit 0 | Produktmethoden, keine echten Kontenschreibzugriffe |
| `04-oauth-query.cjs.log` | Query-Login und unauthentifiziertes `next()` bestätigt | Originalmodell + shipped Sessionwrapper, simulierte DB |

Exit 0 der Befundreproduktionen bedeutet, dass das erwartete problematische
Verhalten bestätigt wurde, **nicht**, dass diese Sicherheitsanforderungen bestanden sind.
Die neuen Harnessdateien liegen außerhalb des versiegelten Produktrepositorys.
Die Originaltestdateien und der Produktcode wurden nicht angepasst.

IEC-Bezug als Arbeitszuordnung: Identitätsprüfung/Zugriffskontrolle, eingeschränkte
Nutzung/Kommunikationsflüsse, Schutz von Zugangsdaten und prüfbare Sicherheits-
Verifikation. Für eine formale IEC-62443-Anforderungserfüllung sind festgelegter
Geltungsbereich, Bedrohungsmodell, Zielniveau und passende Systemnachweise nötig.
