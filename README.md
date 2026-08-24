# NexoWatt EOS Admin

**NexoWatt EOS Admin** ist die Administrationsoberfläche für das **Energy Operation System**.

Diese Ausgabe ist bewusst als eigenständiger ioBroker-Adapter aufgebaut:

```text
Technischer Adaptername: eos-admin
npm-Paketname:          iobroker.eos-admin
Sichtbarer Name:        NexoWatt EOS Admin
Standard-Port:          8081
```

Damit überschreibt der Adapter den offiziellen `admin`-Adapter nicht mehr. Die alte ioBroker-Admin-Oberfläche kann parallel vorhanden bleiben, während NexoWatt-Systeme über `eos-admin.0` die EOS-Oberfläche nutzen.

## Aktueller Stable-Verkaufskandidat 7.10.3

Version 7.10.3 übernimmt den validierten und absturzfreien Stand 7.10.2. Die Einstellung **Automatische Adapter-Updates** liegt jetzt ausschließlich in den **Systemeinstellungen** hinter dem Schraubenschlüssel. Auf Übersicht, Module und allen anderen Hauptseiten wird die Karte nicht mehr angezeigt. Die restart-sichere Updateverwaltung, der verzögerte Repository-Abgleich und die vollständige Backend-Paketprüfung bleiben unverändert.

Verwaltete Installateur- und Endkundenkonten verwenden das Startpasswort `nexowatt`. Nach der ersten Anmeldung beziehungsweise nach einem Reset muss unmittelbar ein persönliches Passwort vergeben werden. Der Reset und die persönliche Passwortvergabe schreiben das reale ioBroker-Benutzerkennwort; EOS-Metadaten werden davon getrennt aktualisiert.

Admin/Service darf verwaltete Installateur- und Endkundenkonten zurücksetzen. Installateure dürfen ausschließlich ausdrücklich zugeordnete Endkundenkonten zurücksetzen. Admin-, Eigen-, deaktivierte und nicht verwaltete Konten bleiben geschützt.

EOS Assist ist in diesem Stand bewusst deaktiviert. Der interne Admin und die interne BackItUp-Notfallreserve bleiben installiert und sind ausschließlich für Admin/Service sichtbar. Für den regulären Betrieb wird die NexoWatt Sicherung verwendet.

## Installation über das NexoWatt Repository

Im NexoWatt Repository muss der Adapter unter dem Key `eos-admin` stehen. Da das npm-Paket unscoped `iobroker.eos-admin` heißt, ist kein `packetName` nötig.

Minimaler Repository-Eintrag:

```json
{
  "eos-admin": {
    "name": "eos-admin",
    "version": "7.10.3",
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
http://DEINE-IP:8081
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
# http://DEINE-IP:8081

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

Den internen `admin`-Adapter nicht löschen. Er bleibt deaktiviert auf `127.0.0.1:18081` als geschützte Service-Reserve erhalten.


## EOS Rollen- und Löschschutz

Ab Version `7.9.25` überwacht der EOS Admin sensible Systembereiche direkt:

- Der alte `admin`-Adapter und `admin.0` werden für Benutzer außerhalb der konfigurierten EOS-Admin-Gruppen ausgeblendet.
- `admin.0` bleibt durch den Security Guard deaktiviert und auf `127.0.0.1:18081` verschoben, solange die Legacy-Admin-Sperre aktiv ist.
- Geschützte Adapter können vom Installateur- oder Endkundenbereich nicht gelöscht werden. Die Löschbuttons werden für Nicht-Administratoren ausgeblendet beziehungsweise deaktiviert.
- Die Schutzliste wird vom Administrator im Bereich **EOS security** gepflegt. Updates bleiben möglich, weil `dontDelete=false` und `nondeletable=false` bleiben. Der Schutz läuft über Administrator-ACLs, EOS-UI-Regeln und den Security Guard.

Standardmäßig geschützt:

```text
eos-admin
admin
backitup
nexowatt-backup
eos-backup
nexowatt-devices
nexowatt-ui
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

Vor der Veröffentlichung müssen Paket- und Stabilitätsprüfung vollständig grün sein:

```bash
npm login
npm whoami
npm run sync:eos-version
npm run check:eos-release
npm publish --dry-run --tag latest
npm publish --tag latest
```

Die Version muss vor jedem erneuten Publish erhöht werden. Für 7.10.3 wird direkt aus der vollständig geprüften Repository-ZIP veröffentlicht; `npm publish` benötigt dabei weiterhin weder `tsc` noch `tsx`.

## Lizenz

Die NexoWatt EOS Oberfläche, das Branding, das Layout und alle NexoWatt-spezifischen Anpassungen sind proprietär. Die öffentliche technische Bereitstellung über npm oder ein Repository ist keine Open-Source-Lizenz und keine allgemeine Nutzungserlaubnis.

Details stehen in:

```text
LICENSE
NEXOWATT_PROPRIETARY_LICENSE.md
THIRD_PARTY_NOTICES.md
```

### 7.9.29

- Self-Update über die EOS-Oberfläche repariert: der gebaute Adapter-Bundle nutzt jetzt `eos-admin` statt `admin` für den Webserver-Updatepfad.
- `eos-admin` wird im Update-Alle-Dialog übersprungen, damit sich die laufende Oberfläche nicht selbst über den normalen Terminal-Befehl beendet.
- Objektbasierte Löschsperren (`dontDelete`/`nondeletable`) werden für EOS Admin entfernt, damit Updates nicht blockiert werden. Der Schutz bleibt über EOS-UI, Rollen und ACLs aktiv.

### 7.9.27

- Header-Logo links optisch verstärkt und leicht nach oben gesetzt.
- Benutzername/Kontoanzeige oben rechts kontrastreicher dargestellt.


## v29 Update-Fix

Version `7.9.29` entfernt den harten `common.dontDelete`-Schutz vom `eos-admin` Adapterobjekt. Dieser harte Objekt-Flag kann den ioBroker-Upgrade-Ablauf stören. Der EOS Admin bleibt für Installateur-/Endkundenrollen geschützt, bleibt aber updatefähig, weil der Schutz jetzt über ACLs, UI-Regeln und den Security Guard läuft.

Empfohlene Reparatur auf bestehenden Anlagen:

```bash
cd /opt/iobroker
iobroker object set system.adapter.eos-admin common.dontDelete=false || true
iobroker object set system.adapter.eos-admin common.nondeletable=false || true
iobroker object set system.adapter.eos-admin.0 common.dontDelete=false || true
iobroker object set system.adapter.eos-admin.0 common.nondeletable=false || true
iobroker upgrade eos-admin https://iobroker.live/repo/repo-nexowatt.json
iobroker upload eos-admin
iobroker restart eos-admin.0
```

## v7.9.29 update reliability note

This release fixes the EOS Admin self-update path. Previous standalone builds could still route the `eos-admin` update through the normal adapter command dialog in the prebuilt frontend bundle. Because EOS Admin is the active web interface, that path can terminate the running web process during the update. Version 7.9.29 routes the `eos-admin` adapter card update through the webserver update flow and excludes `eos-admin` from bulk update-all operations. The repository metadata must also keep `stopBeforeUpdate: false` and valid `meta`/`icon` URLs.

If an older installation has stale update-blocking object flags, repair them once with:

```bash
cd /opt/iobroker
node /opt/iobroker/node_modules/iobroker.eos-admin/tools/nexowatt-repair-eos-admin-update.cjs
```


## NexoWatt EOS v7.9.40 Update-Hinweis

Diese Version korrigiert den Repository-Update-Pfad für den eigenständigen Adapter `eos-admin`. Der Repository-Eintrag muss `packetName: "iobroker.eos-admin"` enthalten, damit ioBroker beim Update nicht den falschen Paketpräfix verwendet. Technische Paketnamen in Befehls-/npm-Dialogen werden nicht mehr zu Branding-Text umgeschrieben, damit Fehlermeldungen eindeutig bleiben.

## NexoWatt EOS v7.9.42 Force-Update-Hinweis

Dieses Paket hebt die sichtbare Adapter-Version und die EOS-Frontend-Cache-Buster auf v7.9.42 an. Es enthält den Delete-/DP-Write-Fix aus v7.9.41 und sorgt dafür, dass Browser nicht weiter die v40-Hilfsskripte verwenden.

## NexoWatt EOS v7.9.45 Dienste/Module Delete Hardfix

Fixes trash-icon deletion. DOM security scripts no longer capture delete clicks; only EOS core adapters stay protected and stale delete locks are repaired automatically.
