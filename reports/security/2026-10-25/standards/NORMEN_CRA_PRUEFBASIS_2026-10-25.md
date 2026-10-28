# Normen- und CRA-Basis für den Admin-Sicherheitsaudit

Prüfdatum: 2026-10-25 UTC. Recherche: öffentlich zugängliche Primärquellen von IEC, OWASP, NIST und EU-Kommission/EUR-Lex. Dieser Teilbericht enthält den Prüfmaßstab, keine Aussage darüber, welche Anforderungen der konkrete Quellstand bereits erfüllt. Die Feststellung der Umsetzung gehört in den technischen Hauptbericht.

## Aktuell verifizierter Maßstab

| Grundlage | Verifizierter Stand | Bedeutung für NexoWatt EOS |
| --- | --- | --- |
| IEC 62443-4-1 | 2018, Edition 1.0; IEC-Katalog führt die Ausgabe als gültig. Eine Edition 2 wird als Entwicklungsvorhaben geführt. [S1] | Entwicklungsprozess: Sicherheitsanforderungen, Entwurf, Implementierung, Prüfung, Fehler- und Patchbehandlung sowie Produktende nachweisen. Ein Code-Review ersetzt diesen Prozessnachweis nicht. |
| IEC 62443-4-2 | 2019, Edition 1.0, einschließlich COR1:2022. [S2] | Technische Anforderungen an IACS-Komponenten. Die sieben Grundbereiche sind Authentisierung, Nutzungskontrolle, Integrität, Vertraulichkeit, begrenzte Datenflüsse, Ereignisreaktion und Verfügbarkeit. Die konkrete Komponentenrolle und anwendbare Anforderungen sind festzulegen. |
| IEC 62443-3-3 | 2013, Edition 1.0, einschließlich COR1:2014. [S3] | Systemanforderungen unter Berücksichtigung von Zonen und Kommunikationsverbindungen. Für die gesamte Installation sind zusätzlich Host, Controller, Netzwerk, Adapter und Betriebsprozesse zu betrachten. |
| OWASP ASVS | 5.0.0, stabil seit 30.05.2025. [S4] | Für den Web-Admin die aktuelle ASVS-5.0.0-Prüfliste verwenden. Level 2 bleibt das gesetzte Entwicklungsziel, ist aber erst nach Prüfung aller anwendbaren Anforderungen nachgewiesen. Alte ASVS-4.x-IDs dürfen nicht unverändert als 5.0-IDs übernommen werden. |
| NIST SSDF | SP 800-218 / Version 1.1 ist die Final-Veröffentlichung vom Februar 2022. [S5] SP 800-218r1 / Version 1.2 wird bei NIST am Prüftag weiterhin als Initial Public Draft vom 17.12.2025 geführt. [S6] | Verbindliche interne Basis auf den finalen Stand 1.1 beziehen; 1.2 als zusätzliche Entwurfsbeobachtung behandeln und nicht als bereits final bezeichnen. |
| CRA | Verordnung (EU) 2024/2847. Art. 14 gilt seit 11.09.2026; die Hauptpflichten gelten ab 11.12.2027. [S7, S8] | Meldebereitschaft ist bereits heute erforderlich, soweit Produkt und Hersteller in den Anwendungsbereich fallen. Produktabgrenzung, Herstellerrolle und Einstufung müssen nachvollziehbar festgelegt werden. |

Die IEC-Webstore-Seiten belegen Ausgabe, Gegenstand und Katalogstatus; sie ersetzen nicht die vollständigen Normtexte. Diese Recherche ist daher keine vollständige Prüfung einzelner IEC-CR/SR-Klauseln. Ein bestimmter Security Level, IEC-Zertifizierung, ASVS-Level oder CRA-Konformität wird hier nicht bestätigt. Auch aus der Verwendung von IEC 62443 folgt keine automatische CRA-Konformitätsvermutung.

## Daraus abgeleiteter technischer Prüfplan

Die folgenden Kontrollen sind eine eigene, auf den EOS-Admin zugeschnittene Umsetzungsempfehlung. Sie sind kein wörtlicher Normenkatalog. Für die endgültige Traceability ist jede Kontrolle der anwendbaren, vollständig eingesehenen Normanforderung zuzuordnen.

| Prüfbereich | Konkrete Prüfung | Belastbarer Nachweis |
| --- | --- | --- |
| Authentisierung und SSO | Nicht angemeldete Aufrufe müssen vor jeder Konto-Verknüpfung abgewiesen werden. Angemeldete Benutzer dürfen keine fremde Identität übernehmen. Nicht verwendete SSO-Routen müssen auch bei alternativen HTTP-Methoden und Pfadvarianten geschlossen sein. | Negativtests gegen tatsächlich ausgeführte Routen; genaue Admin- und Webserver-Version; Middleware-Reihenfolge. |
| Konten, Rollen, Sitzungen | Jede HTTP-, Socket- und Nachrichten-Aktion muss Berechtigungen serverseitig prüfen. Passwort-, Rollen- und Kontosperränderungen müssen aktive Sitzungen und offene Verbindungen entziehen. | Tests für unberechtigt, falsche Rolle, abgelaufene Sitzung, gesperrten Benutzer und Widerruf während bestehender Verbindung. |
| Browser und Transport | Keine Zugangs- oder Refresh-Tokens in URLs/Logs. HTTPS, sichere Cookies, passende CSP, CSRF-Schutz und eng begrenzte Origins prüfen. Proxy-Header nur von explizit vertrauten Proxys übernehmen; externe Callback-Adresse gegen feste Konfiguration prüfen. | Browser-/HTTP-Tests der realen Auslieferung und Proxy-Konfiguration; Log-Stichproben ohne Geheimnisse im Bericht. |
| Eingaben, Dateien und Upload | Schema-, Größen- und Zeitgrenzen; Pfadnormalisierung; Schutz gegen Traversal, Symlinks, Archive-Bombs und parallele Ressourcenerschöpfung. Authentisierung vor kostenintensivem Parsing. | Testdateien mit erwarteter Ablehnung; Speicher-/Zeitgrenzen und atomare Dateibehandlung prüfen. |
| Externe Kommunikation | Erlaubte Ziele, TLS-Prüfung, DNS/IP-/Redirect-Verhalten, gemeinsames Zeitbudget und Antwortgrößen prüfen. SSRF und Credential-Weitergabe ausschließen. | Lokaler kontrollierter Testserver, DNS-/Timeoutfälle, dokumentierte Ziel- und Portliste. |
| Lizenzsystem | Signatur und Verschlüsselung getrennt prüfen. UUID, Edition, Adapterrechte, Zeitgrenzen und Wiederholungen validieren. Signierprivatschlüssel darf nicht beim Kunden liegen. Keine Klartext-Lizenz oder Schlüssel in States/Logs. | Manipulations-, Falsche-UUID-, Home/Pro-, Ablauf-, Neustart-, Uhrsprung- und Replaytests; Dateirechte und Schlüsselspeicherung. |
| Host- und Adaptergrenzen | Gleiche OS-Identität, gemeinsame ioBroker-Datenbank und beliebige Drittadapter als Vertrauensgrenzen erfassen. Verschlüsselung allein verhindert keinen Zugriff durch root oder kompromittierte Prozesse mit denselben Rechten. | Architektur-/Berechtigungsmatrix und Tests auf dem Zielsystem, einschließlich direkter Controller-/DB-Zugänge. |
| Build und Lieferkette | Tatsächliche installierte Abhängigkeiten ermitteln; Lockfile-Auflösung und Hashintegrität, advisories, unterstützte Laufzeit, reproduzierbaren sauberen Build und aus dem Build abgeleitete SBOM prüfen. | Unveränderte Rohprotokolle, UTC-Zeit, Werkzeugversionen, Quell-/Artefakthashes; Lockfile-Inventar klar von realer Build-SBOM und Geräteinventar unterscheiden. |
| Updates und Wiederherstellung | Herkunft und Integrität von Updateartefakten; Freigabe, Unterbrechung, Rückfall und Wiederherstellung testen. Nicht verifizierbare automatische Updates dürfen keinen administrativen Installationspfad eröffnen. | Signatur-/Manipulationstests, Strom-/Netzausfalltest in Testumgebung, dokumentierter Wiederanlauf und Rollback. |
| Ereignisse und Verfügbarkeit | Sicherheitsereignisse ohne Geheimnisse protokollieren; Brute Force, Volumen, langsame Verbindungen und erschöpfte Ressourcen behandeln. Ausfall des Lizenz-/Admin-Dienstes darf keine unsichere physische Reaktion erzeugen. | Zeitlich begrenzte Lasttests im Labor und komponentenspezifischer sicherer Anlagenzustand; Hardwaretests separat kennzeichnen. |
| Wartung und Fehlerbehandlung | Zuständigkeit, Security-Kontakt, Schwachstellen-Triage, betroffene Produktversionen, Supportende, Kundeninformation und aktualisierbare Dokumentation festlegen. | Incident-/PSIRT-Prozess, Verantwortliche und eine dokumentierte Ablaufprobe. |

Eine deaktivierte Funktion kann ein wirksamer Schutz sein. Sie ist aber keine Behebung einer enthaltenen verwundbaren Abhängigkeit und muss gegen spätere Aktivierung oder Upgrades abgesichert werden. Umgekehrt ist ein fehlender Nachweis nicht automatisch eine bestätigte ausnutzbare Schwachstelle. Im Hauptbericht getrennt ausweisen: bestätigter Befund, wirksame Mitigation, offene Prüfung und nicht anwendbar mit Begründung.

## CRA: aktuell relevante Handlung

Für meldepflichtige aktiv ausgenutzte Schwachstellen und schwerwiegende Sicherheitsvorfälle sieht die EU-Kommission eine Frühwarnung innerhalb von 24 Stunden und die Hauptmeldung innerhalb von 72 Stunden vor. Der Abschlussbericht folgt bei aktiv ausgenutzten Schwachstellen spätestens 14 Tage nach Verfügbarkeit einer Korrektur-/Minderungsmaßnahme, bei schwerwiegenden Vorfällen innerhalb eines Monats nach der 72-Stunden-Meldung. Der Meldeweg läuft über die CRA Single Reporting Platform an CSIRT und ENISA; die Pflichten können auch bereits vermarktete Produkte erfassen. [S7]

Für die konkrete SSO-Meldung müssen Betroffenheit und Hinweise auf tatsächliche Ausnutzung getrennt ermittelt werden. Eine reproduzierbare Schwachstelle oder ein Screenshot allein belegt keine aktive Ausnutzung. Der Audit löst deshalb nicht automatisch eine Meldung aus und ersetzt die dokumentierte Meldeentscheidung des Verantwortlichen nicht. Es wurde keine externe Meldung versendet.

## Quellen und Abrufgrenzen

- S1 — IEC 62443-4-1:2018: https://webstore.iec.ch/en/publication/33615 — Webstore-Katalog/Abstract, abgerufen 2026-10-25; Suchansicht enthält den Lifecycle-Status.
- S2 — IEC 62443-4-2:2019: https://webstore.iec.ch/en/publication/34421 — Katalog/Abstract und Corrigendum-Hinweis, abgerufen 2026-10-25.
- S3 — IEC 62443-3-3:2013: https://webstore.iec.ch/en/publication/7033 — Katalog/Abstract und Corrigendum-Hinweis, abgerufen 2026-10-25.
- S4 — OWASP ASVS: https://asvs.owasp.org/ — aktuelle stabile Version, Veröffentlichungsdatum und versionsgebundene Anforderungskennungen, abgerufen 2026-10-25.
- S5 — NIST SP 800-218 Final: https://csrc.nist.gov/pubs/sp/800/218/final — Version 1.1, Februar 2022, abgerufen 2026-10-25.
- S6 — NIST SP 800-218r1 Initial Public Draft: https://csrc.nist.gov/pubs/sp/800/218/r1/ipd — Version 1.2, 17.12.2025, abgerufen 2026-10-25.
- S7 — Europäische Kommission, CRA-Zusammenfassung: https://digital-strategy.ec.europa.eu/en/policies/cra-summary — Abschnitte zu Art. 14, Übergang und Konformität, abgerufen 2026-10-25. Die Kommission kennzeichnet diese Seite selbst als Zusammenfassung und verweist für Rechtsfragen auf den Verordnungstext.
- S8 — Europäische Kommission, Nachricht vom 11.09.2026: https://commission.europa.eu/news-and-media/news/safer-and-more-secure-digital-products-2026-09-11_en — bestätigt bereits anwendbare Meldepflichten und Stichtag 11.12.2027, abgerufen 2026-10-25.
- S9 — Amtlicher Verordnungstext: https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng — offizieller Fundort über EUR-Lex-Suche bestätigt; Volltextabruf in dieser Recherche durch JavaScript-/Bot-Prüfung blockiert. Kein vollständiger aktueller Rechts- oder Anhang-Abgleich behauptet.

Abrufhinweis: Der direkte Download der ASVS-CSV über den Web-Reader war blockiert. Es wurde daher keine vollständige ASVS-5.0.0-L2-Erfüllungsmatrix aus dieser Recherche erzeugt. Katalog-/Versionsbelege und ein technischer Prüfplan ersetzen diese Matrix nicht.

