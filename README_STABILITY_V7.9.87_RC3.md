# NexoWatt EOS Admin 7.9.87-rc.3 – Verkaufsprodukt Release Candidate

Diese Version basiert ausschließlich auf der freigegebenen Stable **7.9.86**. Sie ergänzt das produktive Rollenmodell, die verpflichtende Passwortvergabe bei der ersten Anmeldung und die NexoWatt-EOS-Produktdarstellung. Die Version wird erst nach Labor- und Feldabnahme unverändert als **7.9.87 Stable** freigegeben.

## Rollen und Rechte

### Admin / NexoWatt Service

- vollständige System-, Sicherheits-, Benutzer- und Adapterverwaltung
- vollständige Diagnose- und Servicefunktionen
- Expertenmodus und sicherheitsrelevante Rohzugriffe
- bestehendes, von NexoWatt gesetztes Administratorkonto bleibt unverändert
- keine erzwungene Passwortänderung durch den Erstlogin-Assistenten

### Installateur

- Inbetriebnahme und Fehlersuche
- Adapter- und Instanzkonfiguration
- Geräteintegration, Logs, Datenpunkte und freigegebene Schreibzugriffe
- sichere Basis-Einstellungen über eine eigene gefilterte Oberfläche
- Smart-Home-, Raum- und Funktionszuordnung
- kein Expertenmodus
- keine Benutzer-/Gruppenverwaltung, Zertifikate, Zugangsdaten, Repositoryquellen, Standard-ACL oder globale Sicherheitsverwaltung

### Endkunde

- Zugang zum EOS Admin
- Smart-Home-Konfiguration
- Raum- und Funktionszuordnung
- freigegebene NexoWatt-UI-Bereiche
- nur freigegebene Bedien- und Zuordnungsfunktionen
- kein Expertenmodus und keine technischen Systembereiche

## Erste Anmeldung

Installateur- und Endkundenrollen müssen nach der ersten erfolgreichen Anmeldung ein eigenes Passwort festlegen. Die Einrichtung ist serverseitig geschützt und verlangt:

- mindestens 10 Zeichen
- Groß- und Kleinbuchstaben
- mindestens eine Zahl
- mindestens ein Sonderzeichen
- keine trivialen Standardpasswörter oder Benutzernamenbestandteile

Nach dem erfolgreichen Setzen des Passworts wird die Sitzung beendet. Die nächste Anmeldung erfolgt mit dem neu gewählten Passwort. Admin-/Servicekonten sind von diesem Ablauf ausgenommen.

## Produktsicherheit

- authentifizierter Zugriff ist bei neuen Installationen standardmäßig aktiv
- Expertenmodus wird für Installateur und Endkunde auf UI- und Policy-Ebene fest deaktiviert
- direkte URL-Aufrufe nicht erlaubter Bereiche werden abgefangen
- die Rollenprüfung schlägt bei nicht lesbarem Sicherheitskontext geschlossen fehl
- Systemkonfiguration und Repository-Metadaten sind für die Shell lesbar, aber nur durch Admin/Service direkt beschreibbar
- Zertifikate, Plattformlizenzen und Zugangsdaten bleiben Admin/Service vorbehalten
- Schreibzugriffe werden nicht allein durch ausgeblendete Schaltflächen geschützt

## Produktdarstellung

Kundensichtbare Titel, Beschriftungen, Fehlermeldungen und Loginflächen verwenden **NexoWatt EOS**. Technisch erforderliche Paketnamen, API-Pfade, Kompatibilitätskennungen und Drittanbieter-Lizenzhinweise bleiben intern erhalten, damit der Systemunterbau und ältere Adapter kompatibel bleiben.

## Veröffentlichungskanal

- npm `latest` bleibt bis zur Abnahme auf Stable 7.9.86
- 7.9.87-rc.3 kann für Labor- und Feldtests als ZIP/TGZ oder über den npm-Dist-Tag `rc` verteilt werden
- ein Publish mit dem Dist-Tag `latest` wird durch den Publish-Guard blockiert
- 7.9.86 bleibt jederzeit als Rückfallversion verfügbar

## Pflichtabnahme vor Stable

- Admin-/Serviceanmeldung bleibt unverändert
- Installateur: Erstlogin, Passwortvergabe, Logout und erneute Anmeldung
- Endkunde: Erstlogin, Passwortvergabe, Logout und erneute Anmeldung
- Installateur kann alle Inbetriebnahme- und Diagnosebereiche verwenden
- Endkunde kann Smart Home, Räume, Funktionen und freigegebene UI-Bereiche verwenden
- Installateur und Endkunde können den Expertenmodus nicht aktivieren
- ausgeblendete Bereiche bleiben auch über direkte URLs gesperrt
- Basis-Einstellungen speichern nur die freigegebenen Felder
- Adapter-, Instanz-, Popup-, Datenpunkt- und Updatefunktionen bleiben stabil
- Neustart des Controllers und vollständiger Systemneustart
- Update von 7.9.86 auf RC3
- Rückkehr von RC3 auf 7.9.86


## npm RC-Veröffentlichung

Die Release-Candidate-Version kann mit `npm publish` oder `npm publish --tag rc` veröffentlicht werden. Die Projektdatei `.npmrc` setzt `tag=rc`; zusätzlich erzwingen `publishConfig.tag=rc` und der Publish-Guard den RC-Kanal. Dadurch bleibt der npm-Dist-Tag `latest` unverändert auf der freigegebenen Stable-Version. Ein Publish mit `--tag latest` wird weiterhin technisch blockiert.


## Standardport 8081

Neue EOS-Admin-Instanzen verwenden standardmäßig Port `8081`. Vor der Aktivierung muss der interne Legacy-Admin durch den EOS-Installer bzw. die Sicherheitsroutine auf `127.0.0.1:18081` verschoben und deaktiviert werden, damit kein Portkonflikt entsteht.
