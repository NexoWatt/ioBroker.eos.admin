# Release-Abnahme – NexoWatt EOS Admin 7.9.98

Diese Checkliste ist vor der Verkaufsfreigabe einmal vollständig auf einem realen EOS-Testcontroller abzuarbeiten.

## Installation und Versionsstand

- [ ] `iobroker.eos-admin` zeigt Version `7.9.98`.
- [ ] `eos-admin.0` startet ohne Fehler und ist auf Port `8081` erreichbar.
- [ ] Nach `Strg + F5` werden ausschließlich die v98-Laufzeitdateien geladen.
- [ ] Ein kompletter Neustart des EOS-Controllers führt wieder zu einer erreichbaren Oberfläche.

## Anmeldung

- [ ] Loginname und Passwort überlappen weder Rahmen noch Beschriftungen.
- [ ] Die Anmeldekarte besitzt keine innere horizontale oder vertikale Scrollleiste.
- [ ] Eine absichtlich falsche Anmeldung zeigt die vollständige Fehlermeldung innerhalb der Karte.
- [ ] Die Karte bleibt bei 1920 × 1080 und 1366 × 768 vollständig bedienbar.

## Übersicht und EMS

- [ ] Header und Navigation bleiben stehen.
- [ ] Der Cockpit-Inhalt lässt sich bis zur letzten Karte vertikal scrollen.
- [ ] EMS-Budget, Ladeleistung, Speicher, Regelentscheidungen und Ereignisse werden angezeigt.
- [ ] Die Kachel aktualisiert sich mit realen Werten aus `nexowatt-ui.*.info.adminOverview.*`.
- [ ] Die EMS-Kachel besitzt keine Schreibfunktion und verändert keine Sollwerte.

## Rollen und Passwort-Reset

- [ ] Admin/Service kann `guest`, `user` und `installer` zurücksetzen, sofern diese Konten ausdrücklich einer verwalteten EOS-Rolle zugeordnet sind.
- [ ] Installateur kann ausschließlich ausdrücklich zugeordnete Endkundenkonten zurücksetzen.
- [ ] Admin-Konto, eigenes Konto, deaktivierte und nicht verwaltete Konten werden abgewiesen.
- [ ] Nach dem Reset funktioniert die Anmeldung mit dem Startpasswort `nexowatt`.
- [ ] Das bisherige persönliche Kennwort ist nach dem Reset nicht mehr gültig.

## Persönliches Passwort

- [ ] Die Anmeldung mit `nexowatt` öffnet unmittelbar die Seite „Persönliches Passwort festlegen“.
- [ ] Zu kurze, nicht übereinstimmende oder zu einfache Kennwörter werden verständlich abgewiesen.
- [ ] Ein gültiges neues Kennwort wird gespeichert.
- [ ] Nach erfolgreichem Speichern wird die alte Sitzung beendet.
- [ ] Die erneute Anmeldung funktioniert ausschließlich mit dem neu vergebenen Kennwort.
- [ ] Im nativen Benutzereditor ist weiterhin ein Passwort-Hash für das richtige Benutzerkonto vorhanden.

## Abschluss

- [ ] EOS Assist bleibt ausgeblendet.
- [ ] Sicherung, Dienste, Module, Datenpunkte und Systemlogs bleiben erreichbar.
- [ ] Es treten während der Abnahme keine neuen Fehler im EOS-Admin-Log auf.
