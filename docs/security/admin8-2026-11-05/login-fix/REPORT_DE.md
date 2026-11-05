# EOS Admin 8.0.1 – Anmeldekorrektur

Stand: 05.11.2026. Ausgangslieferung: EOS Admin 8.0.0, Repository-ZIP Version 9, SHA-256 `6dce6d2b31ec3f8a0bfe94d45ca8689f39678911978417339c1b7ea20c85b23a`. Ziel: EOS Admin 8.0.1 auf unveränderter Admin-8.3.5-Basis, Node 22 >=22.23.4 oder Node 24 >=24.22.1 und js-controller >=7.2.5.

## Befund EOS-A8-LOGIN-001

Vom Nutzer gemeldet: Nach dem Update auf 8.0.0 erscheint im EOS Admin „Passwort falsch“. Das über PuTTY erneuerte Passwort wird im normalen Admin akzeptiert, im EOS Admin weiterhin abgelehnt. Dies ist eine Nutzerrückmeldung; ein Fernzugriff auf die Anlage fand nicht statt.

Reproduzierte Ursache: Die zusätzliche EOS-Sitzungsprüfung behandelte `row.id` aus der ioBroker-Gruppenansicht als technische Gruppen-ID. Die offiziellen Controller-/Objektdatenbankimplementierungen liefern dort jedoch den Anzeigenamen bzw. dessen Übersetzung. Das vollständige Gruppenobjekt enthält seine technische ID unter `row.value._id`. Die bisherige Prüfung wies normale Gruppen schon vor der Passwortprüfung zurück. Die Loginoberfläche verwendete für diese Ablehnung dieselbe allgemeine Fehlermeldung wie bei ungültigen Zugangsdaten.

Auswirkung: Verfügbarkeitsfehler der EOS-Anmeldung; kein hier nachgewiesener Anmeldebypass. Priorität hoch wegen Aussperrung legitimer Benutzer. Kein CVE zugewiesen. Verantwortlich für Produktentscheidung/Anlagenabnahme: NexoWatt/Dominique Manteufel.

## Änderung und Sicherheitswirkung

Die Prüfung verwendet ausschließlich die validierte kanonische ID aus dem Gruppenobjekt. Fehlende, leere, fremde, zu lange oder doppelte IDs bleiben abgewiesen. Anzeigenamen, Übersetzungen und Reihenfolge sind nicht Bestandteil der sicherheitsrelevanten Gruppenidentität. Kennwortprüfung, Kontosperre, Gruppenmitgliedschaft, ACL-Bindung, Sitzungswiderruf, Tokenlebensdauer und Ressourcenbegrenzungen bleiben aktiv.

Keine Änderung bestehender Benutzerkennwörter, keine automatische Rechteerweiterung, kein neuer Recovery-Zugang, keine Deaktivierung der Authentifizierung. Home/Pro, UUID-Bindung und Lizenzspeicherung bleiben unverändert.

## Prüfung und Grenzen

Die Tests verwenden die nachweisbar aus den offiziellen Controllerquellen abgeleitete Gruppenansicht. Sie prüfen normale und übersetzte Anzeigenamen, Reihenfolgestabilität, ungültige/doppelte Objekt-IDs, falsche Kennwörter, Passwort-/Mitgliedschafts-/ACL-Änderungen, Refresh-Token und konkurrierende Sicherheitsänderungen. Befehle und tatsächliche Ergebnisse werden in `validation.json` sowie den beigefügten Logs festgehalten.

Die gesonderte KI-Codeprüfung ist ein zusätzlicher Review, keine unabhängige Zertifizierung. Eine tatsächliche Anmeldung auf der Hausanlage, Windows-Ausführung, Gerätefunktionen und allgemeine Produktionsfreigabe sind hier nicht nachgewiesen. Die Prüfanleitung steht in `START_HERE_8.0.1.md` im Repositorywurzelverzeichnis. Kein Fernzugriff, npm-Publish oder Git-Push durch die Assistenz.

## Rückfall und Betrieb

Vor Anlagenupdate Backup erstellen. 8.0.0 bleibt als bekannter fehlerhafter Vergleichsstand dokumentiert und ist kein verlässlicher Rückfall für die EOS-Anmeldung. Der beim Nutzer funktionierende normale Admin dient während der Reparatur als vorhandener Verwaltungszugang; dessen Schutzmaßnahmen nicht abschalten. Datenbankobjekte und Passworthashes nicht manuell bearbeiten. Bei weiterhin fehlgeschlagener Anmeldung nur bereinigte Diagnoseausgaben mitteilen, keine Passwörter oder Tokens.

## Befund EOS-A8-LOGIN-002 – npm-Laufzeitauflösung

Bei der ergänzenden Installationsprüfung wurde festgestellt, dass Root-`overrides` eines Adapter-Repositorys bei der Installation als Abhängigkeit nicht die gleiche Bindung garantieren. Ein isolierter Consumer mit dem ursprünglichen WebServer-Manifest löste `oauth2-server@3.1.1` auf; der Entwicklungsbaum verwendete den gepflegten Fork `@node-oauth/oauth2-server@5.3.1`. Dies war nicht die Ursache der hier reproduzierten Gruppen-ID-Ablehnung, ist aber ein relevanter Lieferkettenbefund im selben Anmeldepfad.

Ein zunächst untersuchter eingebetteter Tarball mit relativer `file:`-Abhängigkeit wurde verworfen: Die vollständige EOS-Consumerinstallation scheiterte mit ENOENT. Die vorherigen kleinen Fixture-Installationen griffen noch auf den benachbarten Producerpfad zu und belegten deshalb keine autarke Paketinstallation. Sie dürfen nicht als Freigabenachweis für den finalen Stand verwendet werden.

Die endgültige Lösung liefert die unveränderten WebServer-3.4.0-Dateien direkt als geprüften Bestandteil des Adapters aus. Die gepflegte OAuth-Bibliothek ist eine direkte, exakt benannte Adapterabhängigkeit. Damit ist ihre Auswahl unabhängig von Root-Overrides und relativen Tarballpfaden. Herkunft, Lizenz und Bytehashes werden geprüft; die Produktionsinstallation und der vollständige HTTP-Anmeldeablauf werden am fertigen Adapterpaket nachgewiesen.

Details zu verworfener Variante und endgültiger Lösung: `dependency/`. Aktuelle vollständige EOS-Consumerergebnisse stehen in `validation.json` und den zugehörigen Logs. Diese Prüfungen ersetzen keine Installation auf der konkreten Anlage.

## Kopierablauf und Build

Die 22 durch den neuen Frontendbuild entfallenen, unveränderten Originaldateien aus 8.0.0 sind mit ihren exakten Hashes im Übernahmekatalog hinterlegt. Beim ZIP-Überkopieren werden ausschließlich solche bekannten Restdateien gesichert und ausgelagert. Der Frontendbuild leert vor dem Neubau nur sein Staging-Verzeichnis; die bisherige ausgelieferte Oberfläche bleibt bis zu einem vollständigen Neubau erhalten. Dadurch werden alte Hash-Chunks nicht erneut in die Ausgabe kopiert.

## Abschlussergebnis

74 Pakettests und 242 EOS-Tests bestanden; alle acht Entwicklungsprüfgruppen erfolgreich. Die vollständige Installation des gepackten Adapters in einer frischen Node-22.23.4-/npm-10.9.9-Umgebung (isolierter Paketordner, frischer Cache, Installationsskripte aktiv) bestand. HTTP-Anmeldung, Access/Refresh und Passwortwiderruf mit ausschließlich installierten Paketdateien bestanden unter Node 22.23.4 und Node 24.22.1. Das Audit des installierten Produktionsbaums meldete 0 Befunde.

Die echte Übernahme aus dem vollständigen 8.0.0-ZIP mit anschließendem normalen `npm publish --dry-run` unter Node 22 bestand. 22 bekannte alte Dateien wurden mit geprüfter Sicherung ausgelagert; aktuelle versiegelte Dateien blieben unverändert. Eigene Notizen und der vorhandene Abhängigkeitsmarker blieben erhalten. Keine echte Veröffentlichung. Rohbelege: `release/`; maschinenlesbare Zusammenfassung: `validation.json`.
