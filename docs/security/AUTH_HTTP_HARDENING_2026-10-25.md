# HTTP- und Kontenhärtung vom 25.10.2026

Änderungsstand 7.10.12, ausgehend vom geprüften Admin 7.10.11. Der frühere
Eingangsauditbericht beschreibt den Zustand **vor** diesen Korrekturen; seine
Befundreproduktionen bleiben als Ausgangsnachweis erhalten. Die neuen Tests prüfen
die korrigierten ausgelieferten JavaScript-Methoden. Vollständiger Controller-,
Express-, Browser- und Reverseproxy-Nachweis bleibt separat erforderlich.

## Korrigierte Grenzen

| Eingangsbefund | Änderung | Nachweis |
|---|---|---|
| AUTH-OCT-01: fremde Loginweiterleitung | Nur ausdrücklich lokale Pfadpräfixe, keine absoluten/protokollrelativen URLs, Backslashes, Kontrollzeichen, Traversal oder weitere Prozentdekodierung | Negativvarianten und gültiger lokaler Proxypräfix in `test/eos-auth-regressions.test.cjs` |
| AUTH-OCT-02: anonymer Claim für Altbestandskonto | Alle drei alten kennwortlosen Endpunkte geben unveränderlich 410 zurück; kein Claimzustand und kein Code zur anonymen Kennwortvergabe vorhanden. Alte Flags/Cookies sind wirkungslos. Kontenstatus meldet die Funktion deaktiviert. | Originale ausgelieferte Handler mit alten Flags/Cookie; keine Controllerfunktion erreichbar |
| AUTH-OCT-03: fehlendes Origin-Schema | Produktiver Origin-Aufrufer übergibt das tatsächliche TLS-Profil. Beliebige Forwarded-Header ändern es nicht. | HTTP-/HTTPS-Wechsel, falscher Host, Forwarded-Header und Cookie/Bearer-Fälle |
| AUTH-OCT-04: HTTP-Zugangsdaten in URL | Frühe Express-Middleware lehnt `token`, `access_token`, `refresh_token`, `pass`, `password`, `ssoLoginResponse` ab, bevor Upstream-OAuth eine Identität setzen kann. HTTP-Tokenleser akzeptieren keine Queryalternative mehr. | Queryformen einschließlich Arrays/Objekte und leere Werte; POST-Login/Code/State bleiben davon getrennt |
| SURFACE-01: DB-Dateien ohne unabhängige Anmeldung/Benutzer-ACL | `/files/` und `/adapter/` erhalten einen eigenen Identitäts-/Pflichtkennwort-Gate. Öffentliche `.ico`-/`manifest.json`-Suffixausnahmen im allgemeinen Gate entfernt. DB-Dateizugriffe erhalten die normalisierte Benutzer-ID. | Anonyme/Pflichtwechsel-Negativfälle, Dateitransfer-Helper-Tests und Quell-/Runtimeverdrahtung |
| SURFACE-03: Adapterantwort als aktives HTML | OAuth-Rückmeldungen werden begrenzt und als HTML-Text escaped, einschließlich sicherer `replace`-Callbackform. Sprache aus fester Liste; Skripte per CSP gesperrt; keine Cache-/Referrerweitergabe. Callbackziel muss Adapterinstanz sein, Wartebudget höchstens 5 s. | Tatsächlich ausgelieferter Ersetzungsausdruck mit HTML- und `$&`-Metazeichen |
| SURFACE-04: unbegrenzter Verzeichnisexport | Rekursive DB-Lese-/ZIP-Sammlung entfernt. Einzeldateien verwenden neuen kontrollierten Helper; Verzeichnisexport bleibt gesperrt. | `test/eos-file-transfer-security.test.cjs`, Details in `FILE_DELIVERY_2026-10-25.md` |

Die frühe 403-Sperre von `/sso` und `/sso-callback` bleibt vor
`createOAuth2Server` erhalten. Auch Webserver 1.4.0 besitzt Legacy-SSO; deshalb
begründet allein die Versionsnummer 7 keine Entwarnung. Der spätere 8er-Zweig
braucht eine gesonderte Prüfung des tatsächlich installierten Webservers und der
OIDC-Konfiguration.

## Absichtliche Änderungen für Anwender und Integrationen

- Login erfolgt regulär mit Kennwort über POST; anschließende HTTP-Anfragen nutzen
  das geschützte Cookie oder einen expliziten `Authorization: Bearer …`-Header.
  Bisherige HTTP-Links mit Geheimnissen in Queryparametern erhalten 400 und müssen
  umgestellt werden. Der Accountselektor `user` allein bleibt erlaubt. OAuth-
  Authorization-Code und State werden nicht als Geheimnis-Loginmechanismus gesperrt.
- Das betrifft die Express-HTTP-Oberfläche. Der separate WebSocket-Handshake des
  eingebundenen Clients kann weiterhin seinen Token in der Upgrade-URL transportieren.
  Dafür sind Proxy-Logredaktion, kurze/revokierbare Sitzungen und eine gesonderte
  Transportmigration zu prüfen. **Es wird nicht behauptet, alle Token-URLs des
  Gesamtsystems entfernt zu haben.**
- Kein kennwortloses Erstübernehmen eines Kontos aus dem LAN. Admin/Service vergibt
  weiterhin ein individuelles temporäres Kennwort über die autorisierte
  Kontenverwaltung. Die normale Erstkennwortänderung verlangt dieses aktuelle
  Kennwort. Ein altes `passwordlessFirstLoginAllowed:true` aktiviert nichts mehr.
- Lokale relative Loginpfade bleiben möglich; externe und mehrdeutige Redirectziele
  werden durch die feste Loginseite ersetzt.
- Unter `/files/` werden aktive DB-Dateiformate wie HTML, JavaScript und SVG als
  Download behandelt. Eine Visualisierung mit aktiven Inhalten gehört in den
  ausdrücklich dafür konfigurierten Webdienst, nicht in die Admin-Origin.
- Directory-ZIP-Export ist gesperrt. Individuelle berechtigte Dateidownloads bleiben
  verfügbar. Ein GET löscht keine Einmal-ZIP-Datei mehr automatisch; bestehende
  temporäre Dateien benötigen eine autorisierte gesonderte Bereinigung.
- `/adapter/` bleibt für berechtigte angemeldete Benutzer als Konfigurationsoberfläche
  verfügbar; DB-Lesen erfolgt mit deren Identität. OAuth-Rückmeldungen erfordern
  technische Installateur-/Adminberechtigung und geben ausschließlich passive Texte aus.
- Im gehärteten Profil wird TLS im Admin selbst terminiert. Reverseproxies müssen
  dieses Profil und den Host bewahren; beliebige `X-Forwarded-*`-Header werden nicht
  als Sicherheitsnachweis akzeptiert. Ein davon abweichendes TLS-Offloading-Profil
  benötigt eine ausdrückliche Vertrauenskonfiguration und Prüfung.

## Prüfstatus und Grenzen

Die neuen acht Auth-Regressionsfälle und die unveränderten 40 vorhandenen
Backend-Boundary-Fälle bestanden am lokal erzeugten JavaScript. Die danach
abgeschlossenen Gesamtprüfungen und Hashes sind im Releasebericht maßgeblich.
Die neuen Tests verwenden originale ausgelieferte Methoden mit simulierten
Controller-/Requestgrenzen. Sie belegen keine gestartete Live-Anlage.

Die Dateischnittstelle von ioBroker liefert vollständige Buffer. Größenprüfung
vor/nach dem Lesen, begrenzte Parallelität, gehaltene Plätze bei hängenden
DB-Aufrufen und Deadlines beseitigen nicht jede mögliche Allokation im
Controller zwischen Metadatenprüfung und eigentlichem Lesen. Ein echtes
Streaming-Backend und Betriebssystem-Ressourcenlimits bleiben erforderlich,
wenn auch eine manipulierte DBdatei diese Vertrauensgrenze angreifen kann.

Weitere offene Systempunkte: reale Session-/Socket-Reconnect-Prüfung, Socket-
Nachrichten an privilegierte Adapter, Host-/Skript-/DB-Rechte, Lieferkettenprovenienz,
Produktupdates und unabhängige Prüfung. Das sind keine bestätigten IEC-/CRA-
Konformitätsnachweise und keine Zusicherung vollständiger Lückenfreiheit.
