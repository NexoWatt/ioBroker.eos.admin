# NexoWatt EOS Admin 7.9.91 – Stable

Version 7.9.91 korrigiert die letzten sichtbaren Anmelde- und Rollenfehler des Verkaufsprodukts.

## Korrekturen

- Die Anmeldeseite verwendet wieder die kompakte zweistufige NexoWatt-EOS-Karte.
- Die äußere Hintergrundkarte übernimmt nicht mehr die vollhohe Größe des Loginformulars.
- Installer, Guest und User dürfen sich nur dann einmalig ohne Passwort aktivieren, wenn das Backend die Erstaktivierung oder einen autorisierten Reset bestätigt.
- Nach erfolgreicher Passwortvergabe bleibt eine Anmeldung ohne Passwort gesperrt.
- Übersichtskacheln sind für Installateur und Gast/Endkunde vollständig klickbar.
- `admin.0` und `backitup.0` werden in Dienste für Installateur und Gast/Endkunde zuverlässig ausgeblendet – auch bei nachgeladenen oder virtualisierten Tabellen.
- `eos-admin.0` und `nexowatt-backup.0` bleiben sichtbar.
- EOS Assist bleibt im Header; die Zugangsverwaltung bleibt ausschließlich unter „Zugänge & Rechte“.
- Standardport bleibt 8081.

Admin/Service behält Vollzugriff und Expertenmodus. Installateur und Gast/Endkunde erhalten ausschließlich ihre freigegebenen Funktionen.
