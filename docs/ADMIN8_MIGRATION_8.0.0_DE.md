> Korrektur vom 05.11.2026: EOS **8.0.1** behebt die Gruppen-ID-Verwechslung in der Anmeldung von 8.0.0. Siehe `../START_HERE_8.0.1.md` und `security/admin8-2026-11-05/login-fix/REPORT_DE.md`. Die ursprüngliche Migration ist nachfolgend historisch dokumentiert.

# NexoWatt EOS Admin 8.0.0 – Migration und Betrieb

Stand: 04.11.2026. Eigene Produktversion: **8.0.0**. Offizielle ioBroker-Admin-Basis: **8.3.5**, Git-Commit `6f77eedf525813a7a61d79188d1ff05dffd05086`.

## Was geändert wurde

Dies ist eine tatsächliche Quellcode-Migration mit neu gebautem Frontend und Backend. Der frühere als Admin 8 bezeichnete Vorbereitungsstand enthielt noch einen Admin-7-Kern und ist keine Grundlage dieses Builds. Ausgangspunkt der EOS-Funktionen war das vollständige 7.10.12-Repository. Die Übernahme der offiziellen Änderungen wurde gegen die belegbare Quellcodebasis 7.9.2 abgeglichen; eine ursprüngliche Git-Abstammung des gelieferten ZIPs lässt sich dadurch nicht nachweisen.

- Neuer Admin-8-Server mit express 5, aktualisierten ioBroker-Schnittstellen und streng geprüften TypeScript-Quellen.
- React 19 und `@iobroker/gui-components` mit neuem Vite-Build. Die EOS-Rollenauflösung bleibt Voraussetzung für den Start der Anwendung.
- EOS-Navigation, individuelle Benutzerkonten, Passwortwechsel, Datenpunktrechte, EMS-Übersicht und bestehende NWL2-Lizenzverwaltung bleiben integriert.
- Der Instanzproxy der Admin-8.3-Basis unterstützt den gemeinsamen HTTPS-Ursprung der NexoWatt UI. TLS-Prüfung, Sitzungsbindung, Rollenprüfung, Größen- und Zeitgrenzen bleiben aktiv.
- Datenpunkt-Schreibschutz wird an geprüften, versionsgebundenen GUI-Quellen vor dem Bundeln eingebunden. Ein Hashabweichung stoppt den Build; alte komprimierte Dateien werden nicht nachträglich durch Textmuster umgeschrieben.
- Markdown wird ohne freigegebenes Roh-HTML gerendert. Unsichere URL-Protokolle werden verworfen.
- Die alte OAuth-Bibliothek wird durch den gepflegten API-kompatiblen Nachfolger ersetzt. Passwort- und Refresh-Abläufe wurden mit der bestehenden EOS-Bindung geprüft.
- Die neue Upstream-Startfunktion, die automatisch `npm install` im Controller-Verzeichnis ausführte, wurde nicht übernommen. Eine fehlende oder ungeeignete Abhängigkeit führt zur Diagnose und kontrollierten manuellen Aktualisierung.

## Voraussetzungen und Aktualisierung

Benötigt werden Node.js **22 ab 22.23.4 oder Node.js 24 ab 24.22.1**, jeweils innerhalb der betreffenden Hauptversion, und ioBroker js-controller **ab 7.2.5**. Der Release-Build wird mit Node.js 24.22.1 erstellt; die zusätzliche Laufzeit-/Publish-Prüfung für Node 22 ist im Kopierupdate-Nachweis dokumentiert. Bestehende Anlagen dürfen innerhalb der unterstützten Node-22-Reihe bleiben. Node 23, 25 und andere Hauptversionen sind in diesem Paket nicht freigegeben.

1. Vor dem Adapterwechsel die vorhandene ioBroker-Konfiguration, individuellen Konten und Lizenzdaten mit dem etablierten Backup-Verfahren sichern. Zugriff auf die lokale Administrationskonsole sicherstellen.
2. Das vollständige Repository in einen sauberen Arbeitsordner entpacken. Vorhandene `node_modules` und alte Buildreste nicht in den neuen Ordner übernehmen.
3. Für den gewohnten npm-Upload den Ordner in VS Code öffnen und im Terminal `npm publish` ausführen. Das Paket enthält den fertigen Build. Die Lifecycle-Prüfungen prüfen ihn ohne lokalen TypeScript-/Vite-Neubau. Eine vorhandene npm-Anmeldung mit Veröffentlichungsrechten wird vorausgesetzt.
4. Auf dem Zielsystem den Adapter über den regulären ioBroker-Upgradevorgang aktualisieren. Ein bloßes Kopieren von Browserdateien ersetzt diesen Vorgang nicht. Für den HTTPS-Proxy müssen die aktualisierten Instanzobjekte, insbesondere `common.adminTab.proxy: true` der NexoWatt UI, vorhanden sein.
5. Danach die unten genannten Abnahmepunkte auf dem Zielsystem durchführen. Ein Screenshot einer lokalen Testinstanz ersetzt diese Abnahme nicht.

Ein Quellcode-Neubau benötigt die gesperrten Entwicklungsabhängigkeiten in Root und `src-admin`. Nach Änderungen müssen Quellen, Builds, Inventare und das Prebuilt-Manifest gemeinsam neu erzeugt und geprüft werden. Die npm-Veröffentlichung darf einen veränderten Quellstand nicht automatisch neu versiegeln.

## Anmeldung, Proxy und Rollen

Der Admin bleibt authentifiziert. Eine EOS-Installateurrolle ist keine Mitgliedschaft in `system.group.administrator`. Die vorgeschaltete Admin-Proxyfreigabe verlangt die tatsächliche ioBroker-Administratorberechtigung; sie wird nicht zur Umgehung von Zugriffsproblemen erweitert. Für andere Rollen gelten die bereits vorgesehenen direkten EOS-Zugangswege.

Die NexoWatt UI prüft zusätzlich ihre eigene persönliche Anmeldung. Ein Admin-Cookie ersetzt diese Anmeldung nicht. Abmeldung, Passwortwechsel, deaktivierte Benutzer und Rollenänderungen müssen bestehende Zugriffe einschließlich langlebiger Proxyverbindungen widerrufen.

HTTP/2 und automatische ACME-Challenge-Listener sind in diesem geprüften Profil deaktiviert. HTTPS über HTTP/1.1 wird unterstützt. Single Sign-on und KI/MCP bleiben deaktiviert; die Migration gibt diese Funktionen nicht nachträglich frei.

## Home/Pro und Lizenzdaten

Die bestehende **NWL2**-Schnittstelle bleibt erhalten: signierte Lizenzen, UUID-Bindung, serverseitige Home-/Pro-Berechtigungsprüfung, kurze Freigabeleases und AES-256-GCM für die lokale Ablage. Der Aussteller-Schlüssel gehört nicht in den Adapter. Andere Adapter verwenden die dokumentierte Consumer-Schnittstelle in `docs/licensing/ADAPTER_INTEGRATION.md` und `packages/eos-license-client`.

Die Verschlüsselung ersetzt weder Dateirechte noch Signaturprüfung. Ein Angreifer mit Root- oder gleichwertigem Zugriff auf den laufenden Adapterprozess kann nicht durch eine lokale Lizenzdateiverschlüsselung grundsätzlich ausgeschlossen werden. Diese Migration ändert weder bereits ausgegebene Schlüssel noch das Lizenzformat stillschweigend.

## Abnahme auf dem realen System

- Start und Neustart mit vorhandenem Objekt-/Zustandsbestand; keine Portkollision mit einer zweiten Admin-Instanz.
- Persönliche Anmeldung, verpflichtender erster Passwortwechsel und erneute Anmeldung nach Passwortänderung.
- Administrator, Installateur und Endkunde: Navigation, Datenpunkte, Lese-/Schreibrechte, gesperrte Werkzeuge und Kontoverwaltung.
- Home-/Pro-Freigabe, falsche UUID, abgelaufene oder manipulierte Lizenz, fehlende Lizenz und Neuausgabe eines Freigabeleases.
- NexoWatt UI über den tatsächlichen HTTPS-Ursprung einschließlich Unterpfad, eigener Anmeldung, Abmeldung und Rollenentzug.
- Datenpunktbearbeitung per Maus und Tastatur; `common.write: false`, Wertewechsel während eines geöffneten Dialogs und Schreibfehler.
- Dienste, Adapteraktualisierung, Logs, EMS-Übersicht und Backup auf dem tatsächlichen Gerät.

## Nachweise und Grenzen

Die genauen lokalen Prüfergebnisse, Abhängigkeiten, Befunde, Abweichungen und offene Zielsystemtests stehen unter `docs/security/admin8-2026-11-04/`. Build-Quellen und echte Ausgabedateien sind über Frontend- und Prebuilt-Manifeste nachvollziehbar verbunden. Lock-Inventar, Audit und Bundle-Zuordnung sind getrennte Nachweisarten.

Es wird keine Fehlerfreiheit, IEC-Zertifizierung oder vollständige CRA-Konformität behauptet. Produktklassifizierung, Herstellerprozesse, Supportdauer, koordinierte Schwachstellenbearbeitung, reale Systemabnahme und gegebenenfalls unabhängige Konformitätsbewertung bleiben eigenständige Aufgaben.

### Betriebssystemwartung

Die geerbte Änderung von Linux-Betriebssystem-Passwörtern aus Admin-Benachrichtigungen und automatische `su`-Anmeldeversuche mit bekannten Standardpasswörtern werden in EOS nicht ausgeführt. Solche Wartung erfolgt über den vorgesehenen lokalen/administrativen Betriebssystemzugang. Das betrifft keine persönlichen ioBroker-Kontopasswörter und keine EOS-Lizenzfreigabe.

### Bewusste Grenze für Custom-Konfigurationskarten

Der EOS-Objekteditor führt Alias-Ausdrücke nicht mehr zur Vorschau im Browser aus; er prüft begrenzt deren Syntax. Bereits gespeicherte Ausdrücke werden dadurch nicht geändert. Die spätere Ausführung eines bewusst konfigurierten Alias im ioBroker-Controller ist eine andere Ausführungsgrenze.

Custom-Konfigurationskarten mit ausführbaren Ausdrücken, nachgeladenen Fremdkomponenten, dynamischen Auswahlantworten mit Ausdrucksauswertung oder freigegebenem Roh-HTML werden mit einer Meldung gesperrt und nicht gespeichert. Bestehende Werte bleiben erhalten. Einfache statische Konfigurationskarten bleiben nutzbar. Dies ist eine absichtliche Einschränkung zugunsten der vereinbarten Sicherheitsvorgaben; betroffene Adapterkonfigurationen benötigen eine datengebundene Anpassung.

Allgemeine Konfigurationsseiten installierter ioBroker-Adapter enthalten weiterhin die Ausdrucksfunktionen der Upstream-JSON-Config-Bibliothek. Diese installierten Adapter bilden eine eigene Vertrauensgrenze. Die vorliegende Migration ist daher kein Nachweis, dass beliebige Drittanbieter-Adapter oder deren eigene Bedienoberflächen frei von ausführbaren Konfigurationen sind.

### Versionswechsel und Browsercache

Die gebauten EOS-Skript- und CSS-Adressen sowie der Socket-Loader erhalten einen zur Produktversion gehörenden Cacheparameter. Der aktive Federation-Einstieg wird ebenfalls mit der Produktversion erzeugt. Damit kann ein früher mit langer Laufzeit gespeicherter Admin-7-Code nicht unter derselben aktiven Startadresse wiederverwendet werden. Der stabile Federation-Kompatibilitätseinstieg bleibt als expliziter Verweis auf den neuen Einstieg vorhanden.

## Ergänzende EasyAccess-Prüfung vom 05.11.2026

Die zuvor offene Herkunfts-/Bibliothekszuordnung wurde für den unveränderten Lieferstand durch bytegleichen Nachbau, tatsächliche Modulzuordnung, aktuelle Advisory-Triage und echte Browserprüfungen ergänzt. Die ursprüngliche Nachweislücke ist geschlossen; drei P2-Funktionsbefunde sowie reale Anlagenabnahme bleiben offen. Details: `security/admin8-2026-11-05/EASYACCESS_FOLLOWUP_DE.md`. Anwendungscode, Lizenzverhalten und Produktversion wurden bei dieser Nachprüfung nicht verändert.
