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

## Installation auf NexoWatt-Systemen

### Empfohlener Weg: NexoWatt Repository

Die Installation sollte über das NexoWatt-Repository erfolgen. Im Repository-Eintrag bleibt der Adaptername `admin`, während `packetName` auf das NexoWatt npm-Paket zeigt:

```json
{
  "admin": {
    "name": "admin",
    "version": "7.9.17",
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
npm install @nexowatt/iobroker.admin --omit=dev
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

### 7.9.17 – NexoWatt README Update

- README vollständig auf **NexoWatt EOS Admin** ausgerichtet.
- Alte upstream-lastige Projektbeschreibung, öffentliche Upstream-Badges und missverständlicher MIT-Lizenzblock aus der Haupt-README entfernt.
- Hinweise zu proprietärer Nutzung trotz öffentlicher npm-Bereitstellung ergänzt.
- Installationsweg über NexoWatt Repository und `packetName` dokumentiert.
- Direkte npm-Testinstallation, Publish-Hinweise und Reverse-Proxy-/404-Hinweise ergänzt.

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
