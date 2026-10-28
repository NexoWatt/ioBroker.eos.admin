# EOS Admin 7.10.11 – Lieferkette und Lizenzgrenzen

Prüfdatum: 25.10.2026. Read-only-Prüfung des wiederhergestellten vollständigen Repositorys; keine produktive Installation, kein npm install, kein Publish und keine Änderung des Programmcodes. Eingangsarchiv: `NexoWatt_EOS_Admin_7.10.11_SECURITY_LICENSE_FULL_REPOSITORY.zip`, SHA-256 `c58a4c03b3f3113455bf1a3492b942307902deabf3fd8f670670ff16955f9a92`.

## Ergebnis

Die vorhandene Lizenzimplementierung verwendet nachvollziehbare Standardverfahren: Ed25519 zur Echtheitsprüfung, AES-256-GCM für die lokale Lizenzablage, zufälligen lokalen Schlüssel, strikte Claims, UUID-/Edition-/Adapter-/Zeitprüfung und kurze Berechtigungsfreigaben. 79 vorhandene Lizenztests bestehen erneut. Die drei ausgelieferten Lizenzmodule stimmen bytegenau mit ihren geprüften Quellen überein. Ein Muster-Scan ergab kein bestätigtes privates Schlüsselmaterial oder Provider-Token; dies ersetzt keine vollständige Geheimnisprüfung.

Eine Aussage „alle Adapter sind sicher und die Lizenz ist von niemandem extern auslesbar“ ist damit nicht gedeckt. Drei wesentliche Grenzen bleiben: unvollständige Nachweise der Lieferkette, fehlende systemweite Mengenzählung und eine gemeinsame ioBroker-/Betriebssystem-Vertrauenszone. Es wurde in diesem Teilauftrag kein zusätzlicher unauthentifizierter Remote-Angriff auf die Lizenzverwaltung bestätigt.

## Priorisierte Befunde

| ID / Priorität | Bestätigter Befund | Risiko / Voraussetzung | Konkreter nächster Schritt |
|---|---|---|---|
| EOS-DEP-001 / P1 | 563 von 788 Backend-Lockeinträgen haben keine vollständige Downloadherkunft und starke Integritätsangabe; 216 davon sind nicht als `dev` markiert. Frontend: 768 Einträge, kein entsprechender Metadatenfehler. Der echte Admission-Check endet mit `BLOCKED`, Exit 1. | Ein vollständiger reproduzierbarer Build und die tatsächlich gelieferten Abhängigkeiten sind nicht nachgewiesen. Die 563 Einträge sind **keine 563 CVEs**. | Lockdatei aus überprüften Registry-Artefakten kontrolliert vervollständigen, exakte Änderungen reviewen; danach isoliertes `npm ci --ignore-scripts`, aktuelle Advisory-Abgleiche, tatsächliche SBOM, normaler Build und Integrationsprüfung. Keine erfundenen Hashwerte ergänzen. |
| EOS-RELEASE-20261025-01 / P1 Prozessrisiko | Die CI ruft den echten Lock-Check vor `clean-build` auf. Lokale `prepack`, `prepublishOnly` und `check:eos-release` tun dies nicht. Sie prüfen Siegel/Regressionen; der dabei aufgerufene Lock-**Selftest** prüft nur synthetische Fixtures. Der lokale Publish-Channel-Guard akzeptiert diesen ausdrücklich als Integrationskandidaten beschriebenen Stand für `latest`. | Mit Veröffentlichungsberechtigung kann ein lokal gestarteter Freigabeprozess die CI-Aufnahmegrenze auslassen. Kein Remote-Exploit; es wurde kein `npm publish` ausgeführt und kein vollständiger Publish-Erfolg behauptet. | Kandidatenexport weiterhin erlauben, aber Produktveröffentlichung über einen getrennten, überprüfbaren Release-Schritt mit tatsächlichem Lock-/Build-/Advisory-Nachweis und kontrollierten Veröffentlichungsrechten führen. Das bestehende Hash-Siegel ist kein Hersteller-Signaturnachweis. |
| EOS-LIC-20261025-01 / P1 Funktionsanforderung | Der Dienst vergleicht `required` je Anfrage mit den signierten Limits, aggregiert jedoch weder Instanzen noch belegte Anlagenressourcen. Neuer isolierter Nachweis: zwei freigegebene Instanzen erhalten jeweils Home 3 Ladepunkte/2 Batterien; insgesamt 6/4 bei signiertem Systemlimit 3/2. | Instanzaufteilung kann Anlagenlimits umgehen. Diese Grenze war schon dokumentiert und wurde jetzt positiv reproduziert. Keine Fälschung der Signatur und keine Home-zu-Pro-Eskalation. | Gemeinsame Anlagenressourcen mit stabilen IDs zentral zählen/zuordnen; Reservierung atomar und gerätebezogen gestalten, Freigabe nach Neustart/Timeout/Umkonfiguration prüfen. Verbraucher müssen tatsächliche Mengen und alle geschützten Betriebsbefehle anbinden. |
| EOS-LIC-20261025-02 / P1 Architekturentscheidung | `storage.key` liegt bei `license.enc` im privaten Dienstverzeichnis; andere Adapter erhalten eine kurzlebige Berechtigung über den lokalen ioBroker-Bus. Der Bus ist in dieser Architektur eine vertrauenswürdige Zone, keine kryptografische Trennung gegenüber kompromittierten lokalen Adaptern oder derselben UID. | Besitz beider Dateien, Laufzeit-/Rootrechte oder Zugriff über dieselbe UID kann die Vertraulichkeit der Lizenz aufheben bzw. Prüfcode umgehen. Ein kopierter System-UUID-Wert allein ist kein Hardware-Identitätsnachweis. | Bedrohungsmodell ausdrücklich festlegen; Hersteller-Privatschlüssel strikt getrennt halten. Für stärkere Isolation separate Dienstidentitäten/IPC-Berechtigungen, sichere Boot-/Updatekette und gegebenenfalls hardwaregebundene Schlüssel evaluieren. Nicht allen Adaptern den AES-Schlüssel aushändigen. |
| EOS-SUPPLY-20261025-02 / P2 Entwicklungsworkflow | `npm run npm` verwendet `npm i -f`; `update-packages` verwendet ungepinntes `npx -y npm-check-updates --upgrade`. | Bei bewusstem Aufruf werden aktuelle Pakete/Code außerhalb der kontrollierten Lock-Aufnahme ausgeführt bzw. Abhängigkeiten geändert. Kein automatisch ausgelöster Installationspfad behauptet. | Entwickler-Kommandos in kontrolliertes Lockupdate mit gepinnten Tools und isolierter Prüfung überführen; nicht als Produktionsinstallationsanleitung verwenden. |

## Nachvollziehbare Quellstellen

- Abhängigkeiten: `package.json:25–44`; exakter Lockbestand und Hashwerte in `dependency-baseline.json`. `@iobroker/webserver` ist im Lock **1.4.0**, Manifest `^1.4.0`; `@iobroker/socket-classes` **2.3.4**. Dies ist nicht der OIDC-Webserver-Hauptzweig 3.3.x aus der Meldung. Die Runtime-Routenprüfung übernimmt der Auth-Teilbericht; die Versionsangabe allein beweist keine sichere Installation.
- CI-Aufnahme: `.github/workflows/test-and-release.yml:39–53`. Lokale Kommandokette: `package.json:157–166,189–197,224,229–235`; `tools/nexowatt-lock-provenance-check.cjs:7–38`; `tools/nexowatt-publish-channel-guard.cjs:6–42`.
- Vorhandene Kompilierungsgrenze: `reports/security/fallback-build-provenance.json` weist ausdrücklich `fallback-emitted` ohne TypeScript-Semantikprüfung, vollständigen Frontend-/Backend-Build, Dependency-Installation oder echten ioBroker-Test aus. Ein neu bestehender Siegeltest ändert diese Herkunft nicht.
- Lizenzsignatur/Schema/Edition/UUID: `src/lib/eosLicenseCore.js:93–153`; private lokale Ablage und Vertrauensgrenze `:156–186`, Schlüsselgenerierung/Schreibschutz und AEAD im weiteren Modul.
- Rootgeschützter Trust-Anchor ohne beschreibbare Elternverzeichnisse: `src/lib/eosLicenseService.js:20–62`; Home-/Pro-/Adapter-/Mengenprüfung `:276–299`.
- Client: `packages/eos-license-client/index.js`, frischer Nonce, strenge Antwortprüfung, höchstens 15 Sekunden Lease, 2 Sekunden Antwortzeit, 5 Sekunden Erneuerung, Pflicht-Callback für gerätespezifischen sicheren Zustand. Unsichere Bus-/UID-Grenze ausdrücklich im Modul dokumentiert.
- Bestehende Hersteller-/Dateigrenzen: `docs/licensing/ISSUER_AND_STORAGE.md:79–92`; systemweite Mengenlücke `docs/licensing/ADAPTER_INTEGRATION.md:189–196` und `START_HERE_7.10.11.md`.
- Automatische Updates: `src/lib/eosAutoUpdate.ts` setzt EOS-Policies auf `none`; 25 Verhaltenstests bestehen. Das ist Quarantäne, keine fertige signierte Updatekette; manuelle Administratorupdates bleiben vorhanden.

## Prüfung und Rohdaten

Umgebung: Node **v24.22.1**, npm **11.9.0**, Linux-Arbeitsumgebung. UTC-Start/Ende, vollständige Argumente, Arbeitsverzeichnis, Exitcodes und Logdateien stehen in `commands.json`.

| Prüfung | Ergebnis | Reichweite |
|---|---|---|
| Lizenz-Core, Service, Client, HTTP, Trust | 79 bestanden, 0 Fehler | Reale Node-Kryptografie und lokale Dateiverarbeitung; ioBroker-Objekt-/Transport-/HTTP-Grenzen überwiegend simuliert. Kein Gerätebeweis. |
| Echter Lock-Provenienzcheck | **BLOCKED**, Exit 1 | 563 Backendpakete, jeweils fehlende starke Integritätsangabe und unbestätigte Herkunft. Kein Download-/Publisher-/CVE-Nachweis. |
| Lock-Prüfer-Selftest | 11 Aufnahme-/Abweisungsfälle bestanden | Prüferlogik mit Fixtures; sagt nichts über die Aufnahme des echten Locks. |
| Auto-Update-Verhalten | 25 Prüfungen bestanden | Quarantäne, Migration, Fehleranzeige; keine signierte Updateauslieferung. |
| Prebuilt-Siegel | 1.439 Dateien / 21 Backenddateien geprüft, bestanden | Unverändertheit gegenüber vorhandenem lokalem Hashmanifest, keine unabhängige Hersteller-Signatur oder Normalbuild-Äquivalenz. |
| Neue Mengenprobe | Lücke reproduziert | Zwei simulierte Instanzen, realer Service/Store/Verifier, frisches Testschlüsselpaar ausschließlich im Arbeitsspeicher. Keine Hardwaresteuerung. |
| Publish-Channel-Guard | `latest` akzeptiert | Nur Kanalprüfung; kein tatsächliches Publish. |
| Secret-Mustersuche | 1.672 Textdateien, kein bestätigter Treffer | Ein Treffer in `CHANGELOG_OLD.md:2002` ist nur ein dokumentierter PEM-Header, kein Schlüssel. Binärdateien, Textdateien über 5 MB und beliebige Passwortformate nicht vollständig abgedeckt. |

`license-shipped-equivalence.json` belegt bytegleiche Core-/Service-/HTTP-Module in `src/lib` und `build/lib`. `quota-boundary-check.cjs` und sein Log dokumentieren die neue Mengenprobe. Es wurden keine Produktionsdateien und keine vorhandenen Tests verändert. Keine Netzwerkinstallation oder Lifecycle-Skripte wurden ausgeführt. Ein vollständiger aktueller CVE-Abgleich, eine tatsächliche installierte SBOM, ein normaler Build und die Geräteintegration gehören noch zum Gesamtnachweis; diese Teilauswertung behauptet keine IEC-/CRA-Konformität.

## Nachtrag: autorisierte Korrektur des Veröffentlichungsablaufs

Nach Abschluss der oben beschriebenen Read-only-Erhebung wurde der Befund
EOS-RELEASE-20261025-01 auf ausdrücklichen Arbeitsauftrag korrigiert. Dieser
Nachtrag beschreibt die Änderung; die vorstehenden Rohdaten bleiben der
unveränderte Nachweis des Eingangsstands.

`prepublishOnly` prüft nun nach der Versionssynchronisation die echten
Lockdateien über `check:eos-production-release`. `check:eos-release` beginnt
mit demselben Check. Beide Paket-/Prebuilt-Validatoren sichern diese Bindung ab.
Der Check ist in die Paketdateiliste aufgenommen. `prepack` bleibt für
Integrationspakete verfügbar. Neue Regression: fünf Tests einschließlich
echter CLI-Ausführung am Repository und isolierter Annahme-/Abweisungsfixtures
bestanden. Der tatsächliche Produktionscheck endet weiterhin erwartungsgemäß
mit Exit 1 / `BLOCKED`; die Lock-Metadaten wurden nicht erfunden oder umgangen.

Geänderte Dateien dieses Teilauftrags: `package.json`,
`tools/nexowatt-prebuilt-release-selftest.cjs`,
`tools/nexowatt-validate-package.cjs`. Neu:
`test/eos-release-admission.test.cjs` und
`docs/operations/RELEASE_ADMISSION_2026-10-25.md`.
Rohdaten: `fix-commands.json`, `fixed-release-admission-tests.log`,
`fixed-production-admission.log`. Versions-/Lockroot-Synchronisation,
Gesamtvalidierung und finales Siegel erfolgen durch die integrierende Hauptarbeit.
Lizenzformat und Schlüsselkompatibilität wurden nicht verändert; systemweite
Mengenaggregation und die externe Geräteintegration bleiben offen.
