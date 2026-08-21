# Installation und Abnahme – NexoWatt EOS Admin 7.9.91

## Installation aus npm

```bash
cd /opt/iobroker
iobroker backup
iobroker stop eos-admin.0
npm install --no-save --omit=dev iobroker.eos-admin@7.9.91
iobroker upload eos-admin
iobroker restart eos-admin.0
```

## Version prüfen

```bash
node -p "require('/opt/iobroker/node_modules/iobroker.eos-admin/package.json').version"
```

Erwartet:

```text
7.9.91
```

## Pflichtprüfungen

1. Anmeldeseite: dekorativer Rahmen ca. 390 × 480 px und innere Karte ca. 334 × 424 px; keine vollhohe Hintergrundkarte.
2. Admin/Service: Anmeldung nur mit festem Passwort; Expertenmodus verfügbar.
3. Installer: leeres Passwort nur bei bestätigter Erstaktivierung oder nach Reset; danach Pflicht zur Passwortvergabe.
4. Guest/User: gleicher Erstaktivierungsablauf; reguläre Anmeldung ohne Passwort anschließend gesperrt.
5. Übersicht: alle freigegebenen Kacheln sind per Maus und Tastatur bedienbar.
6. Dienste: `admin.0` und `backitup.0` sind für Installer und Endkunde unsichtbar.
7. Dienste: `eos-admin.0` und `nexowatt-backup.0` bleiben entsprechend der Rolle sichtbar.
8. EOS Assist sitzt im Header; Zugangsverwaltung nur unter „Zugänge & Rechte“.
9. Port 8081, Neustart und erneute Anmeldung prüfen.
10. NexoWatt Sicherung und Rücklesetest durchführen.
