# NexoWatt EOS Admin 7.9.87-rc.2 – Freigabe- und Feldabnahme

## Freigabestatus

Diese Version ist der vollständige Release Candidate für die Produktlinie auf Basis von EOS Admin 7.
Die unveränderte Version 7.9.86 bleibt bis zur bestandenen Anlagen- und Feldabnahme die offizielle
Stable- und Rückfallversion. Nach erfolgreicher Abnahme wird derselbe Funktionsstand ausschließlich
mit finalen Versions- und Release-Metadaten als 7.9.87 Stable veröffentlicht.

## Vorbereitung

- vollständiges Systembackup erstellen
- aktuelle Stable-Version und Controllerzustand dokumentieren
- je ein separates Konto für Admin/Service, Installateur und Endkunde verwenden
- Browsercache nach dem Update vollständig neu laden
- Test nicht auf der einzigen produktiven Kundenanlage beginnen

## Installation und Rückfall

Die Installations- und Rückfallbefehle stehen in `INSTALL_TEST_V7.9.87_RC2.md`.

## Abnahme Admin / NexoWatt Service

- [ ] bestehendes festgelegtes Admin-Kennwort bleibt gültig
- [ ] keine erzwungene Passwort-Neuvergabe
- [ ] sämtliche Verwaltungsbereiche sind sichtbar
- [ ] Expertenmodus lässt sich ein- und ausschalten
- [ ] Benutzer, Gruppen, Sicherheit, Zertifikate, Zugangsdaten und Repositories sind erreichbar
- [ ] geschützte EOS-Systemmodule bleiben updatefähig, aber gegen unbeabsichtigtes Löschen geschützt
- [ ] zusätzlicher NexoWatt-Servicebenutzer funktioniert auch mit älteren Adapter-Konfigurationen

## Abnahme Installateur

- [ ] Anmeldung mit Startkennwort öffnet ausschließlich die Passwort-Ersteinrichtung
- [ ] eigenes Kennwort erfüllt Mindestlänge und Komplexitätsregeln
- [ ] nach erfolgreicher Vergabe wird die alte Sitzung serverseitig beendet
- [ ] erneute Anmeldung funktioniert nur mit dem neuen Kennwort
- [ ] Inbetriebnahme, Adapter, Instanzen, Logs, Datenpunkte und Geräte-Konfigurationen sind erreichbar
- [ ] sichere Basis-Einstellungen lassen sich speichern
- [ ] Smart-Home-Räume und Funktionen lassen sich zuordnen
- [ ] Expertenmodus ist unsichtbar und über LocalStorage oder Direktaufruf nicht aktivierbar
- [ ] Benutzer, Gruppen, Zertifikate, Zugangsdaten, Repositories, Standard-ACL und globale Sicherheit bleiben verborgen
- [ ] beliebige Shell-Kommandos werden abgelehnt
- [ ] nur erlaubte Inbetriebnahme-Kommandos funktionieren
- [ ] geschützte EOS-Kernmodule können nicht gelöscht oder unkontrolliert ersetzt werden

## Abnahme Endkunde

- [ ] Anmeldung mit Startkennwort erzwingt die persönliche Passwortvergabe
- [ ] nach Passwortvergabe wird die alte Sitzung beendet
- [ ] EOS Cockpit und freigegebene NexoWatt-UI-Bereiche sind erreichbar
- [ ] Smart-Home-Räume und Funktionen lassen sich im freigegebenen Umfang zuordnen
- [ ] nur durch ACL/Freigabe erlaubte Bedienwerte lassen sich schreiben
- [ ] keine Adapter-, Instanz-, Log-, Benutzer-, Repository- oder Systemverwaltung ist sichtbar
- [ ] Expertenmodus bleibt auch bei manipuliertem Browser-LocalStorage deaktiviert
- [ ] direkte URL-Aufrufe gesperrter Bereiche werden auf eine erlaubte Seite zurückgeführt

## Funktions- und Regressionstest

- [ ] Adapter-Suche und Installationsdialog funktionieren
- [ ] alle Dialoge und Schließen-Schaltflächen reagieren
- [ ] Instanz-Konfigurationen alter und neuer Adapter öffnen
- [ ] klassische `index.html`/`index_m.html`-Konfigurationen funktionieren
- [ ] JSON-Config-Konfigurationen funktionieren
- [ ] beschreibbare Boolean-, Number-, String-, Enum-, JSON- und Button-Datenpunkte funktionieren
- [ ] Wertespalte und Bedienelemente sind korrekt ausgerichtet
- [ ] Logs werden für Admin und Installateur aktualisiert
- [ ] Benutzer erhalten keine `permissionError`-Leerseite
- [ ] EOS Assist öffnet ohne das entfernte Fremd-Chatpanel
- [ ] Login, Logout und erneute Anmeldung funktionieren
- [ ] Neustart von `eos-admin.0` funktioniert
- [ ] vollständiger Controller-Neustart funktioniert
- [ ] Update von 7.9.86 auf 7.9.87-rc.2 erhält Einstellungen und Rollen
- [ ] Rückfall auf 7.9.86 funktioniert
- [ ] mindestens 24 Stunden Dauerbetrieb ohne wachsenden Fehler- oder Speichertrend

## Produkt- und Brandingprüfung

- [ ] Login, Seitentitel, Navigation, Meldungen und Hilfetexte zeigen NexoWatt EOS
- [ ] in der normalen Kundenoberfläche erscheint keine fremde Plattformmarke
- [ ] technische Paketnamen, Protokollpfade und Drittanbieter-Lizenzhinweise bleiben intern unverändert,
      damit Adapter- und Controller-Kompatibilität erhalten bleibt

## Freigabeblocker

Die Version darf nicht als Stable veröffentlicht werden, wenn einer der folgenden Punkte auftritt:

- Rollen- oder Passwortschutz lässt sich umgehen
- Installateur oder Endkunde erreicht Experten-, Benutzer-, ACL-, Zertifikats- oder Zugangsdatenbereiche
- ein nicht freigegebener Schreibzugriff ist möglich
- bestehende Adapter-Konfigurationen öffnen nicht mehr
- Update oder Rückfall ist nicht reproduzierbar
- EOS Admin startet nach Controller-Neustart nicht zuverlässig
- sichtbare Kundenoberflächen enthalten falsches Branding

## Stable-Promotion

Erst nach vollständig dokumentierter Abnahme werden Versionsnummer, News, Repository-Eintrag und
Releasekanal auf `7.9.87` gesetzt. Die getestete Programmlogik bleibt dabei unverändert.
