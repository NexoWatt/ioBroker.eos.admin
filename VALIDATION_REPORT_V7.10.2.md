# Validierungsbericht – NexoWatt EOS Admin 7.10.2

## Status

**Reparierter Stable Candidate für den defekten Stand 7.10.1.**

Die Version wurde auf **7.10.2** angehoben, weil eine bereits veröffentlichte npm-Version 7.10.1 nicht überschrieben werden darf.

## Festgestellte Ursachen

### 1. Neustartschleife der EOS-Admin-Instanz

Die Stable-Updateverwaltung schrieb während jedes Starts Laufzeitinformationen in
`system.adapter.eos-admin.0.native`. Eine Änderung der Native-Konfiguration der
laufenden Instanz löst über den ioBroker-Controller einen Instanzneustart aus.
Dadurch entstand die wiederkehrende Folge aus Start, `stopInstance`,
`TERMINATE_YOURSELF` und erneutem Start.

Während dieser Neustarts wurde die HTTP-Verbindung auf Port 8081 abgebrochen.
Das erklärt die Browserfehler:

- `ERR_INCOMPLETE_CHUNKED_ENCODING`
- `Failed to fetch dynamically imported module`
- `ERR_CONNECTION_REFUSED`

### 2. Unvollständiges beziehungsweise inkonsistentes Backend-Artefakt

`build/lib/web.js` lädt `./eosRequestSecurity`. Beim fehlerhaften Installationslauf
war die dazugehörige Datei nicht vorhanden, wodurch der Adapter mit
`MODULE_NOT_FOUND` beendet wurde.

Die bisherige Release-Kette stellte außerdem nicht sicher, dass das Backend vor
`npm pack` beziehungsweise vor der Veröffentlichung frisch gebaut und die gesamte
lokale Require-/Import-Kette im Paket enthalten ist.

### 3. Nicht beendete Update-Timer

Beim Schließen des Webservers wurde der Stable-Update-Manager bisher nicht
explizit gestoppt. Dadurch konnten asynchrone Arbeiten noch nach dem Shutdown
weiterlaufen.

## Umgesetzte Reparaturen

- Laufzeitstatus der Stable-Updateverwaltung aus der Native-Konfiguration entfernt.
- Neue bestätigte Adapterzustände verwendet:
  - `info.nexowattStableUpdatesEnabled`
  - `info.nexowattStableUpdatesState`
- Alte Native-Werte werden nur noch als read-only Migrationsquelle gelesen und
  nicht wieder in die Instanzkonfiguration geschrieben.
- Startabgleich um 30 Sekunden verzögert, damit Installation und Upload vollständig
  beendet sind, bevor Repository-Richtlinien geprüft werden.
- Unveränderte Adapterrichtlinien und `system.config` werden nicht erneut geschrieben.
- Timer, verzögerte Starts und noch laufende Arbeiten werden beim Stoppen geschützt
  beziehungsweise beendet.
- `Web.close()` stoppt jetzt den Stable-Update-Manager.
- Backend-Build zwingend in `prepack` und `prepublishOnly` aufgenommen.
- Neuer Runtime-Pakettest verfolgt die lokale Require-/Import-Kette ab
  `build/main.js`, prüft die JavaScript-Syntax und kontrolliert mittels
  `npm pack --dry-run`, dass jede benötigte Laufzeitdatei wirklich veröffentlicht
  wird.
- Explizite Paketprüfung für `build/lib/eosRequestSecurity.js` ergänzt.
- Versions- und Release-Metadaten vollständig auf 7.10.2 synchronisiert.

## Durchgeführte Prüfungen

Folgende Prüfungen wurden erfolgreich ausgeführt:

- `npm run check:eos-package`
- `npm run check:eos-stability`
- Backend-Runtime-Abhängigkeitsprüfung: 14 lokale Laufzeitdateien auflösbar,
  syntaktisch gültig und im npm-Paket enthalten
- Entrypoint-Smoke-Test
- ESM-Syntaxprüfung
- Import-Integritätsprüfung
- Frontend-Abhängigkeitsgraph: 208 erreichbare JavaScript-Dateien
- Rollen-, Rechte-, Passwort- und Sicherheitsprüfungen
- Update- und Auto-Update-Selbsttests
- Versions-, Release-, Merge- und Paketprüfungen
- EOS-UI-, Login-, Branding-, Popup-, Datenpunkt- und EMS-Übersichtsprüfungen
- Statischer HTTP-Transfer-Test des Haupt-Bundles und der betroffenen CSS-Dateien
- Extraktion und erneute Prüfung des erzeugten TGZ-Artefakts

Der vollständige Konsolenlauf liegt in
`VALIDATION_COMMAND_OUTPUT_V7.10.2.log` bei.

## Paketinhalt des installierbaren Artefakts

Das erzeugte Paket enthält unter anderem:

- `build/main.js`
- `build/lib/web.js`
- `build/lib/eosAutoUpdate.js`
- `build/lib/eosRequestSecurity.js`
- `adminWww/assets/index-8JYjTPhv.js`
- `io-package.json`

Paketgröße: **38.250.806 Bytes**  
Dateien im npm-Artefakt: **995**  
SHA-256 des TGZ: `351a6804512659eda27305b43df5603cbfbe7c2fa6983dddb359c3faba6239b5`

## Noch erforderlicher Feldtest auf dem NexoWatt-System

Da in der isolierten Build-Umgebung kein echter ioBroker-Controller mit dem
Produktivdatenbestand betrieben wird, muss der Installations-Feldtest auf dem
NexoWatt-Rechner noch bestätigen:

1. Version 7.10.2 wird angezeigt.
2. Die Instanz bleibt mindestens 60 Sekunden ohne Neustartschleife aktiv.
3. Port 8081 bleibt dauerhaft erreichbar.
4. Browser-Bundle und EOS-CSS laden mit HTTP 200.
5. Die drei Browserfehler aus Version 7.10.1 treten nicht mehr auf.
6. `MODULE_NOT_FOUND: ./eosRequestSecurity` tritt nicht mehr auf.

Die konkreten Prüfschritte stehen in `INSTALL_TEST_V7.10.2.md`.

## Einschränkung der Build-Umgebung

Ein vollständiges neues `npm ci` war in der isolierten Umgebung wegen eines
temporären DNS-/Registry-Zugriffsfehlers (`EAI_AGAIN` für registry.npmjs.org)
nicht möglich. Die geänderten Backend-Dateien wurden mit der vorhandenen globalen
TypeScript-Toolchain erzeugt; sämtliche oben genannten Repository-, Syntax-,
Abhängigkeits-, Paket- und Selbsttests sind anschließend erfolgreich durchgelaufen.
