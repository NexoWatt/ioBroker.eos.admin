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
    "version": "7.9.23",
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
