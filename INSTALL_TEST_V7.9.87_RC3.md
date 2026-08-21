# NexoWatt EOS Admin 7.9.87-rc.3 – Installation und Abnahme

## Installation des Testpakets

Vor der Installation ein vollständiges Systembackup erstellen.

```bash
cd /opt/iobroker

iobroker backup
iobroker stop eos-admin.0
npm install --no-save --omit=dev /PFAD/iobroker.eos-admin-7.9.87-rc.3.tgz
iobroker upload eos-admin
iobroker restart eos-admin.0
```

Version prüfen:

```bash
node -p "require('/opt/iobroker/node_modules/iobroker.eos-admin/package.json').version"
```

Erwartet:

```text
7.9.87-rc.3
```

## Erstanmeldung

- Admin/NexoWatt Service meldet sich mit dem bestehenden festgelegten Kennwort an; es erscheint keine Passwortpflicht.
- Installateur meldet sich mit dem bei der Kontoanlage vergebenen Startkennwort an und muss anschließend ein eigenes Kennwort setzen.
- Endkunde meldet sich mit dem bei der Kontoanlage vergebenen Startkennwort an und muss anschließend ein eigenes Kennwort setzen.
- Nach der Kennwortvergabe erfolgt eine Abmeldung. Danach ist ausschließlich das neue Kennwort gültig.

## Rollenprüfung

### Admin / NexoWatt Service

- alle Bereiche sichtbar
- Expertenmodus verfügbar
- Benutzer, Gruppen, Sicherheit, Zertifikate, Zugangsdaten und Repositoryverwaltung verfügbar

### Installateur

- Inbetriebnahme, Adapter, Instanzen, Logs, Datenpunkte und sichere Basis-Einstellungen verfügbar
- Räume/Funktionen und Smart Home verfügbar
- Expertenmodus nicht sichtbar und nicht aktivierbar
- Benutzer, Gruppen, Zertifikate, Zugangsdaten, Repositories, Standard-ACL und globale Sicherheitsbereiche nicht verfügbar

### Endkunde

- Smart Home, Räume/Funktionen und freigegebene NexoWatt-UI-Bereiche verfügbar
- keine Adapter-, Instanz-, Log-, Objekt-, Benutzer- oder Systemverwaltung
- Expertenmodus nicht sichtbar und nicht aktivierbar

## Pflichtprüfung

- direkter Aufruf gesperrter Hash-Routen führt auf eine erlaubte Seite
- Browser-LocalStorage `App.expertMode=true` aktiviert bei Installateur/Endkunde keinen Expertenmodus
- sichere Basis-Einstellungen verändern keine Repository-, ACL- oder Expertenwerte
- beschreibbare freigegebene Datenpunkte funktionieren
- Popup-Schließen, Adapter-Suche und Instanzkonfiguration funktionieren
- Neustart von EOS Admin und kompletter Systemneustart funktionieren

## Rückkehr zu Stable 7.9.86

```bash
cd /opt/iobroker

iobroker stop eos-admin.0
npm install --no-save --omit=dev iobroker.eos-admin@7.9.86
iobroker upload eos-admin
iobroker restart eos-admin.0
```


## npm RC-Veröffentlichung

Die Release-Candidate-Version kann mit `npm publish` oder `npm publish --tag rc` veröffentlicht werden. Die Projektdatei `.npmrc` setzt `tag=rc`; zusätzlich erzwingen `publishConfig.tag=rc` und der Publish-Guard den RC-Kanal. Dadurch bleibt der npm-Dist-Tag `latest` unverändert auf der freigegebenen Stable-Version. Ein Publish mit `--tag latest` wird weiterhin technisch blockiert.


## Standardport 8081

Neue EOS-Admin-Instanzen verwenden standardmäßig Port `8081`. Vor der Aktivierung muss der interne Legacy-Admin durch den EOS-Installer bzw. die Sicherheitsroutine auf `127.0.0.1:18081` verschoben und deaktiviert werden, damit kein Portkonflikt entsteht.
