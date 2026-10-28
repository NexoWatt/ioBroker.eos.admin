# EOS Admin 7.10.12 – Sicherheitsprüfung und Korrekturen

25.10.2026. Ergebnis: bestätigte lokale Angriffspfade korrigiert und gezielt
nachgeprüft; **Integrationsstand, kein Nachweis vollständiger Lückenfreiheit,
IEC-Zertifizierung oder CRA-Konformität**. Die konkret gemeldete OIDC-
Kontoverknüpfung war im geprüften EOS-Stand bereits vorgeschaltet gesperrt.
Der Admin-7-Zweig bleibt erhalten. Keine Installation, kein Publish und keine
Veränderung einer Kundenanlage erfolgten.

## Verbindlicher Prüfgegenstand

Eingang: `NexoWatt_EOS_Admin_7.10.11_SECURITY_LICENSE_FULL_REPOSITORY.zip`,
1.977 Dateien/Einträge, 50.424.993 Bytes,
SHA-256 `c58a4c03b3f3113455bf1a3492b942307902deabf3fd8f670670ff16955f9a92`.
Der gespeicherte Quellstand wurde erneut gelesen; ältere Berichte wurden nicht
als Beweis einer heutigen Fehlerfreiheit übernommen. Die tatsächlich auf einer
Anlage installierte Version und deren Konfiguration sind nicht bekannt.

Ausgang: vollständiges Repository 7.10.12, Backend gezielt neu emittiert,
Frontend gezielt gepatcht und Runtime-Graph v85. Das Dateimanifest unter
`release-manifests/full-repository-files.json` bindet die endgültigen Dateien;
das Prebuilt-Manifest deckt 1.450 Quell-/Runtime-/Testdateien ab. README.md bleibt
unverändert identisch zu LICENSE.

## Screenshot und Upstream

Die fehlende Autorisierung bei `/sso?method=register` ist im offiziellen
Webserver-Code 3.3.0/3.3.1 bestätigt. Mit eingerichtetem OIDC und erreichbarem
Endpunkt kann eine IdP-Identität mit einem fremden lokalen Konto bis hin zu
`admin` verknüpft werden. Der veröffentlichte Fix in Webserver 3.3.2 fordert
Authentifizierung und Selbstzuordnung oder Administratorrechte. Token in
Weiterleitungs-URLs und die Callbackbildung aus req.protocol/Host bleiben im
untersuchten Fix-Tag bestehen. Ein veröffentlichter GitHub-Release ist nicht
gleichbedeutend mit einer aktualisierten Kundeninstallation.

Unser Lockstand verwendet Webserver 1.4.0. Auch dieser enthält Legacy-SSO.
Entscheidend ist deshalb die EOS-Sperre von `/sso` **und** `/sso-callback` vor
`createOAuth2Server`, in Quelle und ausgeliefertem JavaScript. Sie bleibt in
7.10.12 unverändert aktiv. Die bloße Aussage „wir verwenden Admin 7“ wäre
kein ausreichender Schutzbeleg. OIDC wird mit diesem Fix nicht aktiviert und
es erfolgt keine unkontrollierte Migration auf Admin 8.

Tag-/Commitnachweise und die geprüften MIT-lizenzierten Upstreamquellen liegen
unter `2026-10-25/upstream/`. Diese wurden gelesen, nicht gegen fremde Server
ausgenutzt. Weitere OIDC-Integrationen benötigen eigene Tests für CSRF,
Sitzungsbindung, Einmalcodes, Berechtigungswiderruf und Proxykonfiguration.

## Bestätigte Befunde und Behandlung

Die Einstufung ist eine technische Priorisierung, kein berechneter CVSS-Score.
Vorher-Reproduktionen verwenden harmlose Marker und kontrollierte lokale
Grenzen. Ein erfolgreicher Vorher-Test bestätigt den Fehler, nicht die Sicherheit.

| Befund | Risiko und Voraussetzung | Korrektur in 7.10.12 | Nachweisgrenze |
| --- | --- | --- | --- |
| EOS-NEWS-001 / SURFACE-02 | Hoch: manipulierte Newsdaten konnten im Backend und im Browser JavaScript ausführen; Kontrolle über Feed oder gespeicherte Daten erforderlich | `eval` entfernt, begrenzter Vergleichsparser; vorhandene ungültige Werte abgewiesen; Objektzahl nur einmal pro Nachrichtenlauf gelesen | Echte ausgelieferte Methode und Browserexpression isoliert getestet; keine Übernahme eines Newsservers |
| SURFACE-01 | Hoch: öffentliche Dateiendungs-Ausnahmen plus Dekodierung; fehlende Benutzer-ACL bei DB-Dateizugriff | Suffixausnahmen entfernt, eigene Anmeldung/Pflichtkennwortprüfung für `/files/` und `/adapter/`, normalisierte Benutzer-ID an DB-API, strikter Dateiparser | Alte Handler reproduziert, neue Originalmethoden/Helper getestet; echter Controller-/Express-Aufruf offen |
| AUTH-OCT-02 | Hoch, bedingt: aktiviertes Altkonto mit kennwortlosem Erstloginflag konnte aus privatem Netz übernommen werden | Anonyme Aktivierungs-/Claim-Endpunkte dauerhaft 410; Altflags/Cookies ohne Wirkung; persönlicher Kennwort- und Adminresetpfad bleibt | Alte und neue Handler isoliert, keine Livekonten verändert |
| AUTH-OCT-01 | Mittel: protokollrelative und mehrdeutige Loginweiterleitungen | Nur geprüfte lokale Pfadpräfixe | Geprüftes ausgeliefertes Redirectverfahren |
| AUTH-OCT-03 | Mittel: Same-Origin-Prüfung ignorierte HTTP/HTTPS-Unterschied | Tatsächliches TLS-Profil einbezogen, ungeprüfte Forwarded-Header schaffen kein Vertrauen | HTTP-/HTTPS-/Host-/Cookie-/Bearer-Negativfälle |
| AUTH-OCT-04 | Vertraulichkeit: HTTP-Zugangsdaten in URLs | Frühe Querysperre vor OAuth; Tokenleser verwenden Cookie/Authorization | Betrifft Express-HTTP; separates WebSocket-Upgrade nicht vollständig umgestellt |
| SURFACE-03 | Mittel bis hoch, bedingt: Adapter-OAuth-Antwort wurde als HTML ausgegeben | Escape als Text, sichere Ersetzungsfunktion, Ausgabelimit, passive CSP, Instanzprüfung, 5-s-Antwortbudget | Tatsächlicher HTML-Ausdruck mit Markup und Ersetzungsmetazeichen geprüft |
| SURFACE-04 | Mittel: unbeschränkter Verzeichnisexport und langsame Dateiübertragungen | Rekursiven ZIP-Export gesperrt; Einzeldateien mit ACL, 16 MiB, zwei Plätzen, 5 s, Halten von Plätzen bei hängender DB/langsamer Ausgabe | DB liefert vollständige Buffer; harte Vorallokationsgrenze bleibt Controller-/OS-Aufgabe |
| SURFACE-05 | Mittel: Node-Versionsabruf umging das Netzwerkprofil | Festes HTTPS-Ziel, maximal 2 MiB, 5 s Gesamt-Netzbudget, kein Redirect/Retry, begrenztes Antwortschema | Bestehende Transport-Negativtests plus tatsächliche Verdrahtung; keine Liveprovider-Abfrage |
| EOS-CACHE-001 | Korrigierter Browsercode konnte bei aktivem Cache unter alter URL bleiben | 21 Runtime-Module und Import-/Preload-/Einstiegsverweise auf v85 umgestellt | Graph-/Syntax-/Imports geprüft; kein Browser-End-to-End-Test mit vorgewärmtem Cache |
| EOS-RELEASE-001 | Lokaler Publishweg prüfte nur den Prüfer, nicht die tatsächliche Lock-Provenienz | Echter Aufnahmecheck in prepublishOnly und check:eos-release; Integrationspaketierung separat | Negativ-/Positiv-Fixtures und aktueller echter BLOCKED-Check; kein Publishversuch |

Die Frontend-Peerprüfung fand zusätzlich eine falsche Behandlung vorhandener
leerer Newsbedingungen und eine fehlende Erfolgsnachbedingung des Patchwerkzeugs.
Beide sind im finalen Stand korrigiert. Der vorherige Bericht bleibt als
zeitlich eingeordnete Prüfhistorie erhalten.

## Abschließende Prüfungen

Umgebung: Linux, Node 24.22.1, npm 11.9.0. Keine neu installierten npm-Abhängigkeiten.
Kommandos, UTC-Zeiten und Exitcodes stehen unter `2026-10-25/fixed-raw/`.

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Vollständige vorhandene Paket-/Stabilitätskette | Bestanden; siehe `stability-final.log` und `stability-final-result.json` |
| Sammellauf `test:eos-security-audit` | 142 Fälle bestanden: 79 Lizenz, 15 Session, 18 Webressourcen, 13 Dateiübertragung, 8 Auth, 4 News, 5 Releaseaufnahme |
| Backend-Berechtigungsgrenzen | 40 Fälle bestanden, tatsächlicher ausgelieferter Code mit simuliertem Controller |
| Automatische Updates / Lockprüfer | 25 bzw. 11 bestehende Fälle bestanden; im Stabilitätslauf enthalten |
| Datei-/Ressourcenhelper aus build | 31 Fälle bestanden; Wiederholung derselben 13+18 Fälle, nicht zusätzliche unabhängige Nachweise |
| Runtime-Closure, Parser-/Import-/Frontend-Graph, Versionen, Prebuilt-Siegel | Bestanden; kein Ersatz für volle Typprüfung oder Controllerintegration |
| npm-Pack-Dry-Run ohne Lifecycle | Bestanden; alle neuen Runtimehelper, v85-Einstieg, Lizenzclient und Aufnahmeprüfer enthalten |
| Tatsächlicher Produktions-Aufnahmecheck | Erwartet BLOCKED: 563 unvollständige Backend-Lockeinträge, davon 216 nicht-dev |

Frühe Prüfungen schlugen wegen noch nicht synchronisierter Versionsmetadaten bzw.
der fest auf 7.10.11 gesetzten Test-Versionsanforderung fehl. Die explizite
Versionsanforderung wurde auf 7.10.12 fortgeschrieben; Schutzprüfungen wurden
nicht gestrichen. Frühere Logs bleiben neben dem erfolgreichen Endlauf erhalten.
Die 142 Fälle und die darunter erneut ausgeführten Untergruppen werden nicht
mehrfach als unterschiedliche Tests gezählt.

## Build, Abhängigkeiten und offene Produktgrenzen

Es gibt **keinen belegten vollständigen normalen TypeScript-/Frontend-Build**
und keinen aktuellen vollständigen Online-Advisoryscan. Der Lockstand hat 788
Backend- und 768 Frontend-Komponenten. Fehlende Herkunfts-/Integritätsangaben
bei 563 Backend-Einträgen sind keine 563 behaupteten CVEs. Sie wurden nicht
erfunden. Die CycloneDX-Dateien sind Lock-Referenzinventare, keine Live-SBOM.

`fallback-build-provenance.json` dokumentiert die gezielte Backend-Erzeugung
aus 13 Eingabe-/Ausgabepaaren, mit Hashes und Grenzen. Node-TypeScript-Transformation
und lokaler CommonJS-Emitter ersetzen keine semantische TypeScript-Prüfung.
Die vorhandene große React-Basis wurde nur an der Newsstelle korrigiert und
mit einem neuen Assetgraph versehen. Die tatsächlich installierten Drittmodule
und das Verhalten am Zielcontroller bleiben separat zu prüfen.

Offen bleiben insbesondere:

1. Saubere Herkunft aller Abhängigkeiten, Normalbuild, Lint/Typprüfung, aktuelle
   Advisories, tatsächliche Build-SBOM sowie kontrollierte Update-/Rollbackkette.
2. Liveprüfung von Login/Refresh/WebSocket/Widerruf, TLS/Proxy, echter Multipart-
   und Datei-ACL-Integration, Backup/Restore und sicheren Gerätezuständen.
3. WebSocket-Transport: Der eingebundene Client besitzt einen optionalen Token-
   Querytransport. Die HTTP-Korrektur ist keine vollständige Transportmigration;
   tatsächliche Nutzung, Proxylogs und ein sicherer Ersatz müssen geprüft werden.
4. OS-/Host-/Skript-/DB-Grenzen und privilegierte Adapter-Messageboxen. Prozesse
   unter derselben ioBroker-UID sind keine voneinander isolierten Mandanten.
5. Systemweite Lizenzmengen: Zwei Verbraucher können jeweils innerhalb der
   signierten Home-Grenze anfragen und zusammen darüber liegen. Ressourcen-IDs,
   eindeutige Zuordnung und die übrigen Verbraucherrepositories sind für die
   korrekte Aggregation erforderlich; kein inkompatibler Lizenzwechsel wurde
   stillschweigend eingeführt.

Die verschlüsselte Lizenzdatei schützt eine isolierte Dateikopie. Mit Zugriff
auf lokalen AES-Schlüssel, dieselbe Prozess-UID oder root ist keine absolute
Auslese- oder Manipulationssicherheit zugesichert. Hersteller-Signaturschlüssel
bleiben außerhalb des Admins. Home/Pro/UUID-Verifikation wurde erneut geprüft;
fremde Adapter wurden nicht pauschal als bereits integriert ausgegeben.

## IEC, ASVS, SSDF und CRA

Prüfrahmen: IEC 62443-4-1:2018 (Entwicklungsprozess), 62443-4-2:2019 einschließlich
COR1:2022 (Komponente), 62443-3-3:2013 einschließlich COR1:2014 (System), OWASP
ASVS 5.0.0 mit Level 2 als Zielprofil sowie NIST SSDF 1.1 Final. NIST SSDF 1.2
war in der eingesehenen Primärquelle weiterhin Entwurf. Die Normenmatrix und
Primärquellen stehen unter `2026-10-25/standards/`.

Die Korrekturen tragen zu Identitätsprüfung, Berechtigungsdurchsetzung,
Eingabeprüfung, Datenvertraulichkeit, begrenztem Ressourcenverbrauch und
nachvollziehbarer Fehlerbehandlung bei. Vollständige kostenpflichtige IEC-Texte,
eine vollständige ASVS-L2-Matrix, Systemabgrenzung und unabhängige Prüfung wurden
damit nicht ersetzt. Es wird kein Security Level verliehen.

CRA-Meldepflichten nach Art. 14 gelten seit 11.09.2026; die allgemeinen
Hauptpflichten ab 11.12.2027. Ein Screenshot oder ein lokaler Markerbeweis ist
für sich kein Beleg einer aktiv ausgenutzten Schwachstelle. Herstellertriage,
Supportzeitraum, Produktklassifikation, PSIRT/Meldeverfahren, technische
Unterlagen und das zutreffende Konformitätsverfahren bleiben erforderlich.
Es wurden keine Meldungen oder Nachrichten an Dritte versendet.

## Anwendung

`START_HERE_7.10.12.md` beschreibt die absichtlichen Verhaltensänderungen.
Bestehende Anlagen benötigen einen Test gegen ihren tatsächlichen Softwarestand;
die hier geprüfte ZIP kann diesen Stand nicht aus der Ferne attestieren.
Nach einem kontrollierten Testupdate alle Admin-Tabs schließen und neu öffnen.
Der sichere Produktions-Publish bleibt bis zur belegten Aufnahme gesperrt.
