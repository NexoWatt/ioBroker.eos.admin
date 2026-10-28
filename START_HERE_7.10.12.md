# EOS Admin 7.10.12 – Sicherheitskorrektur vom 25.10.2026

Ausgangsstand ist das vollständige EOS-Admin-7.10.11-Repository vom 30.09.2026.
Dies bleibt der Admin-7-Zweig. Die aktuell auf einer Anlage installierte Fassung
wurde nicht ausgelesen und es wurde kein Gerät verändert.

## Gemeldete OIDC-Lücke

Die Meldung beschreibt eine unberechtigte Verknüpfung eines IdP-Kontos mit einem
lokalen ioBroker-Konto bis hin zum Administrator. Im untersuchten EOS 7.10.11
werden `/sso` und `/sso-callback` bereits vor dem Upstream-OAuth-Setup mit HTTP 403
gesperrt. Diese Sperre bleibt in 7.10.12 erhalten und ist durch Regressionen
abgesichert. Auch die alte Webserver-Abhängigkeit 1.4.0 enthält SSO-Code;
die Versionsnummer 7 allein wäre deshalb keine Entwarnung.

Die allgemeine Prüfung hat weitere konkrete Schwachstellen gezeigt. 7.10.12
entfernt die Codeauswertung von Newsbedingungen in Backend und Browser, schließt
den anonymen Dateipfad-/ACL-Umweg, deaktiviert alte anonyme Kontoaktivierungen,
begrenzt Weiterleitungsziele auf lokale Pfade und bindet Schreibschutzprüfungen
an das tatsächliche HTTP-Schema. HTTP-Zugangsdaten in URLs werden abgewiesen;
OAuth-Rückmeldungen werden als Text ausgegeben. Der Node-Versionsabruf nutzt
den begrenzten HTTPS-Client. Lokale Produktionsveröffentlichungen prüfen nun
die tatsächliche Lock-Provenienz. Neue Asset-URLs verhindern die Wiederverwendung
des alten News-Codes aus einem frischen Browsercache nach erneutem Seitenaufruf.

## Geändertes Verhalten

- Anmeldung mit persönlichem Kennwort bleibt erforderlich. Alte anonyme
  Erstaktivierungsendpunkte liefern 410; die Kennwortänderung nach verifizierter
  Anmeldung und der administrative Reset bleiben bestehen.
- HTTP-Links mit Passwort oder Zugriffstoken in der Query werden nicht mehr
  akzeptiert. Unterstützt bleiben Cookie bzw. Authorization-Header. Der separate
  WebSocket-Transport muss auf der Zielanlage zusätzlich geprüft werden.
- Dateien erfordern Anmeldung und die Datei-ACL des tatsächlichen Benutzers.
  Einzeldateien sind auf 16 MiB, zwei gleichzeitige Übertragungen und fünf Sekunden
  begrenzt. Verzeichnis-ZIP-Downloads sind vorerst gesperrt. HTML/SVG und andere
  aktive Dateitypen werden nicht im Admin-Ursprung ausgeführt.
- Komplexe JavaScript-Ausdrücke im Newsfeld `number-of-objects` sind ungültig.
  Zulässig ist ein einzelner Vergleich mit einer nichtnegativen ganzen Zahl.
- NWL2-Lizenzformat, Home/Pro, UUID-Bindung und vorhandene Herstelleranker werden
  durch diese Korrektur nicht gewechselt. Die systemweite Mengenaggregation über
  mehrere Verbraucheradapter ist weiterhin offen.

## Prüfung vor Einsatz

Zuerst `reports/security/SECURITY_REVIEW_7.10.12_2026-10-25.md` lesen. Dort stehen
Quellstand, Befunde, Korrekturen, echte Testprotokolle und verbleibende Grenzen.
Dies ist ein nachvollziehbarer Integrationsstand, keine Zusicherung von
Lückenfreiheit oder IEC-/CRA-Konformität.

Der reguläre vollständige Abhängigkeits-/TypeScript-/Frontend-Build konnte nicht
belegt werden: 563 Backend-Lockeinträge besitzen weiterhin keine vollständigen
Herkunfts-/Integritätsangaben. Ein lokaler Produktions-Publish bricht deshalb
ab. Die mitgelieferte Backendfassung wurde gezielt erzeugt und geprüft, die
bestehende Browserfassung gezielt korrigiert. Das Verfahren steht in den
Buildnachweisen und ersetzt keinen normalen Build.

Vor dem Einsatz auf einer Anlage ein wiederherstellbares Backup erstellen und
den Stand zuerst auf einem Testsystem mit demselben Controller, Node, Datenbank-
Backend und TLS-/Proxyprofil prüfen. Anmeldung, Kennwortwechsel, Sitzungswiderruf,
WebSocket-Neuverbindung, erlaubte/verbotene Datei-ACLs, Lizenzwechsel und die
gerätespezifischen sicheren Zustände müssen dort nachgewiesen werden. Alle
offenen Browserfenster schließen und den Admin neu öffnen. Diese ZIP führt
keine Installation aus und enthält keine privaten Herstellerschlüssel.
