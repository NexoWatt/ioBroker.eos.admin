# NexoWatt EOS Admin 7.9.91 – Release Notes

## Behobene Fehler

- Die Anmeldung verwendet wieder den kompakten zweistufigen Aufbau: äußerer Rahmen ca. 390 × 480 px, innere Karte ca. 334 × 424 px.
- Bei `installer`, `guest` und `user` wird die normale Anmeldeschaltfläche bei leerem Passwort nur aktiviert, wenn das Backend eine echte Erstaktivierung oder einen autorisierten Passwort-Reset bestätigt.
- Nach der persönlichen Passwortvergabe bleibt eine Anmeldung ohne Passwort gesperrt.
- Der Erstkennwortdialog nutzt eine vollständige Formularidentität und verursacht keine Rückkopplungsschleife am Submit-Button.
- Die Übersichtskacheln sind für Installateur und Endkunde per Maus und Tastatur bedienbar und navigieren über die vorhandenen nativen Einträge.
- `admin.0` und `backitup.0` werden in „Dienste“ für Installateur und Endkunde zuverlässig ausgeblendet, auch bei nachgeladenen oder virtualisierten Zeilen.
- `eos-admin.0` und `nexowatt-backup.0` bleiben für die vorgesehenen Rollen sichtbar.
- EOS Assist bleibt im Header; die Kontoverwaltung bleibt ausschließlich unter „Zugänge & Rechte“.
- Standardport bleibt 8081.

## Rollen

- Admin / NexoWatt Service: vollständiger Zugriff und Expertenmodus.
- Installateur: Inbetriebnahme, Fehlersuche und freigegebene NexoWatt-Sicherung; keine internen Reserve-Dienste.
- Gast / Endkunde: freigegebene Smart-Home- und NexoWatt-Funktionen; keine internen Reserve-Dienste und kein Expertenmodus.

## Veröffentlichung

Die Version ist für den npm-Dist-Tag `latest` vorbereitet. Eine tatsächliche npm-Veröffentlichung erfolgt erst mit dem berechtigten NexoWatt-npm-Konto.
