# NexoWatt EOS Admin

**NexoWatt EOS Admin** ist die Administrationsoberfläche für das **Energy Operation System**.

Diese Ausgabe ist bewusst als eigenständiger ioBroker-Adapter aufgebaut:

```text
Technischer Adaptername: eos-admin
npm-Paketname:          iobroker.eos-admin
Sichtbarer Name:        NexoWatt EOS Admin
Standard-Port:          8091
```

Damit überschreibt der Adapter den offiziellen `admin`-Adapter nicht mehr. Die alte ioBroker-Admin-Oberfläche kann parallel vorhanden bleiben, während NexoWatt-Systeme über `eos-admin.0` die EOS-Oberfläche nutzen.

## Installation über das NexoWatt Repository

Im NexoWatt Repository muss der Adapter unter dem Key `eos-admin` stehen. Da das npm-Paket unscoped `iobroker.eos-admin` heißt, ist kein `packetName` nötig.

Minimaler Repository-Eintrag:

```json
{
  "eos-admin": {
    "name": "eos-admin",
    "version": "7.9.26",
    "title": "NexoWatt EOS Admin",
    "desc": {
      "de": "NexoWatt EOS Administrationsoberfläche als eigenständiger Adapter.",
      "en": "NexoWatt EOS administration interface as a standalone adapter."
    },
    "meta": "https://iobroker.live/repo/eos-admin/io-package.json",
    "icon": "https://iobroker.live/repo/eos-admin/admin.png"
  }
}
```

Installation auf dem Zielsystem:

```bash
cd /opt/iobroker
iobroker repo set nexowatt
iobroker update
iobroker install eos-admin
iobroker upload eos-admin
iobroker start eos-admin.0
```

Danach ist die Oberfläche standardmäßig erreichbar unter:

```text
http://DEINE-IP:8091
```

## Migration vom offiziellen Admin

Empfohlener sicherer Ablauf:

```bash
cd /opt/iobroker

# 1. EOS Admin parallel installieren und testen
iobroker install eos-admin
iobroker upload eos-admin
iobroker start eos-admin.0

# 2. Im Browser testen
# http://DEINE-IP:8091

# 3. Wenn alles sauber läuft, offiziellen Admin stoppen
iobroker stop admin.0

# 4. EOS Admin auf Standard-Port setzen
iobroker set eos-admin.0 --port 8081 --enabled true
iobroker restart eos-admin.0
```

Danach läuft NexoWatt EOS Admin unter:

```text
http://DEINE-IP:8081
```

Den offiziellen `admin`-Adapter erst löschen, wenn der Zugriff über `eos-admin.0` zuverlässig funktioniert.


## EOS Rollen- und Löschschutz

Ab Version `7.9.25` überwacht der EOS Admin sensible Systembereiche direkt:

- Der alte `admin`-Adapter und `admin.0` werden für Benutzer außerhalb der konfigurierten EOS-Admin-Gruppen ausgeblendet.
- `admin.0` bleibt durch den Security Guard deaktiviert und auf `127.0.0.1:18081` verschoben, solange die Legacy-Admin-Sperre aktiv ist.
- Geschützte Adapter können vom Installateur- oder Endkundenbereich nicht gelöscht werden. Die Löschbuttons werden für Nicht-Administratoren ausgeblendet beziehungsweise deaktiviert.
- Die Schutzliste wird vom Administrator im Bereich **EOS security** gepflegt. Updates bleiben möglich, weil `nondeletable=false` bleibt. `eos-admin` nutzt zusätzlich `dontDelete=true`; andere geschützte Adapter werden über Administrator-ACLs geschützt, damit der Admin sie weiterhin warten kann.

Standardmäßig geschützt:

```text
eos-admin
backitup
```

Administratoren können weitere Adapter in der Tabelle `Protected adapters` ergänzen. Die sichtbaren Admin-Gruppen werden über `EOS admin groups` definiert, standardmäßig `administrator`.

## Updates

Da `eos-admin` ein eigener Adapter ist, laufen Updates unabhängig vom offiziellen `admin`-Adapter:

```bash
iobroker update
iobroker upgrade eos-admin
iobroker upload eos-admin
iobroker restart eos-admin.0
```

## Veröffentlichung auf npm

```bash
npm login
npm publish
```

Die Version muss vor jedem erneuten Publish erhöht werden.

## Lizenz

Die NexoWatt EOS Oberfläche, das Branding, das Layout und alle NexoWatt-spezifischen Anpassungen sind proprietär. Die öffentliche technische Bereitstellung über npm oder ein Repository ist keine Open-Source-Lizenz und keine allgemeine Nutzungserlaubnis.

Details stehen in:

```text
LICENSE
NEXOWATT_PROPRIETARY_LICENSE.md
THIRD_PARTY_NOTICES.md
```


### 7.9.26

- Header-Logo links optisch verstärkt und leicht nach oben gesetzt.
- Benutzername/Kontoanzeige oben rechts kontrastreicher dargestellt.
