# NexoWatt EOS Admin

<p align="center">
  <img src="admin/admin.png" width="112" height="112" alt="NexoWatt EOS" />
</p>

<p align="center">
  <strong>Energy Operation System – Administrationsoberfläche für NexoWatt Systeme</strong>
</p>

<p align="center">
  <img alt="npm package" src="https://img.shields.io/npm/v/@nexowatt/iobroker.admin?label=npm" />
  <img alt="license" src="https://img.shields.io/badge/license-NexoWatt%20Proprietary-green" />
  <img alt="package" src="https://img.shields.io/badge/package-public%20npm%20%2F%20proprietary%20use-0ea5a3" />
</p>

---

## Überblick

**NexoWatt EOS Admin** ist die Administrationsoberfläche für das **NexoWatt Energy Operation System (EOS)**.  
Der Adapter stellt die Bedienoberfläche, Anmeldemaske, Modulverwaltung, Dienste-/Instanzansicht, Grundeinstellungen und Systemnavigation im NexoWatt-EOS-Design bereit.

Das Paket ist technisch als Vendor-Build für den bestehenden `admin`-Adapter ausgelegt. Dadurch kann es über ein eigenes NexoWatt-Repository gezielt an NexoWatt-Systeme ausgeliefert werden, ohne dass normale Installationen automatisch umgestellt werden.

---

## Lizenz und Nutzung

Dieses Paket ist **proprietär**.

Die öffentliche Bereitstellung über npm, Git, Download-Archiv oder ein NexoWatt-Repository stellt **keine Open-Source-Lizenz** und **keine allgemeine Nutzungserlaubnis** dar.

Die Nutzung, Installation, Vervielfältigung, Weitergabe, Veröffentlichung, Unterlizenzierung, Vermietung, der Verkauf oder die Bereitstellung an Dritte ist nur für Systeme erlaubt, die von **NexoWatt** betrieben, geliefert, autorisiert oder ausdrücklich lizenziert wurden.

Lizenzdateien:

- `LICENSE`
- `NEXOWATT_PROPRIETARY_LICENSE.md`
- `THIRD_PARTY_NOTICES.md`
- `admin/LICENSE-NEXOWATT.md`
- `adminWww/LICENSE-NEXOWATT.md`

Hinweis: Bestandteile, die auf Upstream- oder Drittanbieter-Komponenten basieren, behalten ihre jeweiligen Lizenzhinweise. Die NexoWatt-spezifischen Branding-, Design-, Logo-, Text-, Layout- und Overlay-Bestandteile stehen unter der NexoWatt Proprietary License.

---

## Paketstruktur

| Datei / Bereich | Bedeutung |
|---|---|
| `package.json` | npm-Paket: `@nexowatt/iobroker.admin` |
| `io-package.json` | Adapter-Metadaten; technischer Adaptername bleibt `admin` |
| `adminWww/` | fertige Admin-Frontend-Dateien inklusive EOS-Branding |
| `adminWww/css/eos-branding.css` | visuelles EOS-Design |
| `adminWww/js/eos-branding.js` | leichte Runtime-Anpassungen für Branding und Texte |
| `admin/` | Adapter-Icon, Konfigurationsschema und Lizenzhinweis |
| `docs/` | NexoWatt-spezifische Hinweise und Repository-Beispiele |
| `THIRD_PARTY_NOTICES.md` | Hinweise zu Upstream-/Drittanbieter-Bestandteilen |

---


## Aktueller Repository-Fix

Wenn die Oberfläche ein Update für `admin` anzeigt, das Update aber nicht auf den NexoWatt EOS Admin wechselt, ist fast immer der Repository-Eintrag unvollständig. Der Eintrag muss zwingend `packetName` enthalten:

```json
{
  "admin": {
    "name": "admin",
    "version": "7.9.20",
    "packetName": "@nexowatt/iobroker.admin"
  }
}
```

Ohne `packetName` sieht ioBroker zwar eine höhere Version für `admin`, versucht aber nicht zuverlässig das NexoWatt npm-Paket zu installieren. Für einen manuellen Notfall-Fix kann der npm-Alias verwendet werden:

```bash
cd /opt/iobroker
iobroker stop admin.0
npm install "iobroker.admin@npm:@nexowatt/iobroker.admin@7.9.22" --omit=dev
iobroker upload admin
iobroker start admin.0
```

## Update über das NexoWatt Repository

Damit ein bestehender offizieller Admin wirklich auf den NexoWatt EOS Admin aktualisiert wird, müssen drei Dinge gleichzeitig stimmen:

1. Das aktive ioBroker Repository muss das NexoWatt Repository sein.
2. Der Repository-Eintrag `admin` muss `packetName: "@nexowatt/iobroker.admin"` enthalten.
3. Die Repository-Version muss höher sein als die auf dem System installierte `admin`-Version.

Beispiel für den Admin-Eintrag im NexoWatt Repository:

```json
{
  "admin": {
    "name": "admin",
    "version": "7.9.20",
    "packetName": "@nexowatt/iobroker.admin",
    "title": "NexoWatt EOS Admin",
    "desc": {
      "de": "NexoWatt EOS Administrationsoberfläche",
      "en": "NexoWatt EOS administration interface"
    },
    "meta": "https://repo.nexowatt.de/iobroker/admin/io-package.json",
    "icon": "https://repo.nexowatt.de/iobroker/admin/admin.png"
  }
}
```

Nach dem Update muss der Admin-Dateispeicher neu hochgeladen werden:

```bash
iobroker upload admin
iobroker restart admin.0
```

Wenn die Oberfläche danach noch alt aussieht, liegt es meistens an Browser-/Admin-Dateicache. Dann einmal hart neu laden: `Strg + F5`.

## Installation auf NexoWatt-Systemen

### Empfohlener Weg: NexoWatt Repository

Die Installation sollte über das NexoWatt-Repository erfolgen. Im Repository-Eintrag bleibt der Adaptername `admin`, während `packetName` auf das NexoWatt npm-Paket zeigt:

```json
{
  "admin": {
    "name": "admin",
    "version": "7.9.20",
    "packetName": "@nexowatt/iobroker.admin",
    "title": "NexoWatt EOS Admin",
    "desc": {
      "de": "NexoWatt EOS Administrationsoberfläche",
      "en": "NexoWatt EOS administration interface"
    },
    "meta": "https://repo.nexowatt.de/iobroker/admin/io-package.json",
    "icon": "https://repo.nexowatt.de/iobroker/admin/admin.png"
  }
}
```

Auf dem Zielsystem:

```bash
cd /opt/iobroker

iobroker repo add nexowatt https://repo.nexowatt.de/iobroker/sources-dist-nexowatt.json
iobroker repo set nexowatt
iobroker update

iobroker stop admin.0
iobroker upgrade admin
iobroker upload admin
iobroker start admin.0
```

Danach im Browser hart neu laden:

```text
Strg + F5
```

### Direkter Test per npm-Paket

Für einen direkten Test kann das Paket auch lokal installiert werden:

```bash
cd /opt/iobroker

iobroker stop admin.0
npm install "iobroker.admin@npm:@nexowatt/iobroker.admin@7.9.22" --omit=dev
iobroker upload admin
iobroker start admin.0
```

---

## Veröffentlichung auf npm

Dieses Paket ist für eine öffentliche npm-Veröffentlichung vorbereitet, bleibt aber proprietär lizenziert.

```bash
npm login
npm publish --access public
```

Wichtig:

- Der npm-Paketname ist `@nexowatt/iobroker.admin`.
- Der technische Adaptername in `io-package.json` bleibt `admin`.
- Für jedes Release muss die Version in `package.json` und `io-package.json` erhöht werden.
- Eine bereits veröffentlichte npm-Version kann nicht erneut unter derselben Version veröffentlicht werden.

---

## Technischer Adaptername

Der technische Adaptername darf nicht in `EOS Admin` oder `eos-admin` geändert werden, wenn der vorhandene Admin auf NexoWatt-Systemen ersetzt werden soll.

Richtig:

```json
{
  "common": {
    "name": "admin",
    "titleLang": {
      "de": "NexoWatt EOS Admin",
      "en": "NexoWatt EOS Admin"
    }
  }
}
```

Das sichtbare Branding wird über Titel, Icons, Manifest, Login-Design und EOS-Overlay gesetzt. Die interne Adapter-ID bleibt aus Kompatibilitätsgründen `admin`.

---

## Reverse Proxy und 404-Vermeidung

Für stabile Funktion muss die Admin-Oberfläche vom Web-Root des Hosts erreichbar sein. Bei Reverse-Proxys müssen HTTP/HTTPS und WebSocket-Verbindungen weitergeleitet werden.

Typische Nginx-Header:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Bei 404-Fehlern nach Login oder beim Laden von JS/CSS-Dateien prüfen:

| Symptom | Wahrscheinliche Ursache | Maßnahme |
|---|---|---|
| leere oder unvollständige Oberfläche | Admin nur unter Unterpfad eingebunden | Admin am Web-Root bereitstellen |
| 404 bei JS/CSS | falscher Reverse-Proxy-Pfad oder fehlender Slash | Pfad und abschließenden Slash prüfen |
| WebSocket-Fehler | Upgrade-Header fehlen | WebSocket-Unterstützung aktivieren |
| altes Design sichtbar | Browsercache | `Strg + F5` oder Inkognito-Fenster |

---

## Entwicklung und Prüfung

Paketprüfung:

```bash
npm run check:eos-package
```

TGZ lokal erzeugen:

```bash
npm pack
```

Der Publish-Check prüft unter anderem:

- npm-Paketname `@nexowatt/iobroker.admin`
- `publishConfig.access = public`
- `private = false`
- technische Adapter-ID `admin`
- gleiche Version in `package.json` und `io-package.json`
- vorhandene EOS-CSS/JS/Logo-Dateien
- vorhandene Lizenzdateien
- keine fehlenden `adminWww/index.html`-Assets

---

## Changelog

### 7.9.22

- Treats the `nexowatt` repository as the official NexoWatt EOS repository.
- Removes the upstream “use at own risk” warning for the active NexoWatt repository.
- Keeps repository warnings for other non-official/non-stable repositories.


### 7.9.20 – Repository Update Fix

- Version für neues Repository-Update auf `7.9.20` erhöht.
- Repository-Workflow mit Pflichtfeld `packetName: "@nexowatt/iobroker.admin"` dokumentiert.
- Direkte Notfallinstallation über npm-Alias `iobroker.admin@npm:@nexowatt/iobroker.admin@7.9.22` dokumentiert.
- `tools/nexowatt-generate-repo-entry.cjs` erzeugt jetzt einen vollständigen Admin-Repository-Eintrag.
- `tools/nexowatt-patch-repo.cjs` ergänzt ein bestehendes NexoWatt-Repository automatisch um den korrekten Admin-Eintrag.
- Cache-Busting für EOS Branding auf `v=20` erhöht.

### 7.9.16 – Public npm / Proprietary License

- npm-Paketname auf `@nexowatt/iobroker.admin` gesetzt.
- Öffentliche npm-Veröffentlichung über `publishConfig.access = public` vorbereitet.
- Proprietäre NexoWatt-Lizenzhinweise geschärft.
- Technische Adapter-ID bleibt `admin` für Vendor-Repository-Mapping.

### Ältere Änderungen

Weitere technische Upstream-Historie befindet sich in `CHANGELOG_OLD.md` und in den jeweiligen Upstream-/Drittanbieter-Hinweisen.

---

## Markenhinweis

NexoWatt, NexoWatt EOS, Energy Operation System, die NexoWatt Logos sowie die NexoWatt-spezifischen UI- und Branding-Elemente sind Eigentum von NexoWatt oder stehen NexoWatt zur exklusiven Nutzung zur Verfügung.

## CLI-Recovery bei Admin-Timeout / ERR_EMPTY_RESPONSE

Wenn nach dem Speichern der Admin-Einstellungen die Oberfläche nicht mehr antwortet, kann der Login-Timeout per CLI zurückgesetzt werden:

```bash
cd /opt/iobroker
iobroker set admin.0 --ttl 3600 --enabled true
iobroker restart admin.0
```

Falls der Adapter durch ein fehlgeschlagenes Update nicht sauber installiert ist:

```bash
cd /opt/iobroker
iobroker stop admin.0
npm install "iobroker.admin@npm:@nexowatt/iobroker.admin@7.9.22" --omit=dev
iobroker upload admin
iobroker start admin.0
```



## NexoWatt Repository Update-Hinweis v22

Damit ioBroker den NexoWatt EOS Admin wirklich als Ersatz für den technischen Adapter `admin` installiert, muss der Eintrag im aktiven NexoWatt Repository unter dem Key `admin` stehen und zusätzlich `packetName` enthalten:

```json
{
  "admin": {
    "name": "admin",
    "version": "7.9.22",
    "packetName": "@nexowatt/iobroker.admin"
  }
}
```

Wenn das Repository automatisch aus `io-package.json` generiert wird, muss `packetName` danach erneut in die Repository-Datei gepatcht werden. Das Feld gehört in das Repository, nicht in `io-package.json`.
