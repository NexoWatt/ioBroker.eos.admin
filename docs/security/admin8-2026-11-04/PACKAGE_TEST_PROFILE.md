# Reproduzierbarer EOS-Pakettest

Stand: 04.11.2026. Dieses Profil dient ausschließlich der Entwicklung und CI. Es verändert keine Adapter-Laufzeitrechte und schaltet keinen Publish-Lifecycle ab.

## Ausgangsbefund

Der unveränderte Pakettest aus `@iobroker/testing` 6.3.1 meldete acht fehlgeschlagene Einzelprüfungen:

| Einzelprüfungen | Ursache | Korrektur |
| --- | --- | --- |
| Drei Repository-Prüfungen | Das generische Community-Profil verlangt `repository` und `repository.type=git`. Für dieses proprietäre EOS-Paket wurde keine eigene Git-URL geliefert. | Das eigene Paketprofil akzeptiert fehlende npm-optionale Repository-Metadaten nur zusammen mit `UNLICENSED`, bezahltem Lizenzprofil und der vorhandenen proprietären Lizenzdatei. Falls Repository-Metadaten angegeben werden, müssen Typ und URL vorhanden sein; der ioBroker-Admin-Upstream darf nicht als EOS-Repository ausgegeben werden. |
| Eine io-package-Schema-Prüfung | Live-Download des veränderlichen Controller-`master`-Schemas schlug fehl. | Beide offiziellen Schemas werden an vollständige Commit-IDs und SHA-256 gebunden, lokal gelesen und bei jedem Schema-Laden auf Integrität geprüft. Ein fehlendes oder verändertes Schema lässt die Prüfung fehlschlagen. |
| Eine News-Prüfung | 58 Einträge überschritten das erlaubte Maximum 20. | Die 20 jüngsten Versionen bleiben in `io-package.json`; alle 58 bisherigen Einträge sind vollständig in `docs/changelog-archive.json` archiviert. |
| Zwei Lizenz-Prüfungen | `common.license` und `common.licenseInformation` kollidierten; der Lizenzbezeichner widersprach `package.json`. | Das bevorzugte `licenseInformation` bleibt mit `license: UNLICENSED`, `type: paid` und bisherigem Link. Das doppelte `common.license` entfällt. Proprietäre Rechte und Drittanbieter-Lizenzen bleiben in den bestehenden Lizenzdateien. |
| Eine JSON-Config-Prüfung | `disableMcp.sx` ist im Checkbox-Schema kein gültiges Feld. | Der Tippfehler wurde auf das unterstützte Rasterfeld `xs: 12` korrigiert. |

Die vier echten Metadaten-/Konfigurationsfehler wurden korrigiert. Die übrigen vier Fehlermeldungen betreffen zwei explizite Profilentscheidungen: ehrliche Repository-Metadaten und reproduzierbarer Schematransport. Sie werden nicht als bestandene Prüfung eines bekannten EOS-Git-Repositorys oder eines Live-Schema-Downloads ausgegeben.

## Zusätzlich sichtbar gewordene Schemaabweichungen

Nach dem verifizierten Offline-Pin meldete der unveränderte offizielle io-package-Schemavalidator **71 bestandene, eine fehlgeschlagene Prüfung**. Das Rohprotokoll `package-profile-official-schema-failure.log` bleibt als Gegenbeleg erhalten. Die Sammelprüfung beanstandete bestehende EOS-Vendorfelder, das auch in Upstream Admin 8.3.5 vorhandene Wurzelfeld `schemas`, den proprietären Lizenzbezeichner und den lokalen Lizenzlink. Diese Felder blind zu entfernen hätte vorhandene Release-Identitäten, Metadaten-URLs und die eingebettete Systemkonfiguration beschädigt. Eine eigene HTTPS-Lizenzseite oder eigene Git-URL wurde nicht erfunden.

Deshalb ergänzt **`tools/nexowatt-package-schema-profile.cjs`** eine Kopie des unverändert gespeicherten offiziellen Schemas um ein ausdrücklich **EOS-spezifisches** Profil. Das ist kein Nachweis der Zulassung zum ioBroker-Community-Repository. Wurzel und `common` behalten `additionalProperties: false`; weitere unbekannte Felder bleiben verboten.

| Explizite Erweiterung | Geprüfte Grenze |
| --- | --- |
| Wurzel- und gemeinsame Version | Exakt dieselbe endliche, kanonische Semver wie `package.json`; kein anderer Versionswert. |
| Adapter- und npm-Identität | `eos-admin` beziehungsweise `iobroker.eos-admin`; `publisher` exakt `NexoWatt`. |
| Metadaten-URL | Exakt `https://unpkg.com/iobroker.eos-admin@<Version>/io-package.json`. |
| Bestehende Verwaltungsflags | `dontDelete: false`, `allowAdapterUpdate: true`, `allowAdapterDelete: false`; keine Typkoerzierung. |
| Lizenz | `UNLICENSED`, Typ `paid`, erforderlicher Link. Neben bisherigen HTTPS-Links ist nur `/adapter/eos-admin/LICENSE-NEXOWATT.md` erlaubt. Die tatsächlich ausgelieferte lokale Variante sowie proprietäre Hauptdatei werden auf Existenz, Dateityp und Inhalt geprüft. |
| `schemas.systemConfig` | Ausschließlich `label`, `path: common`, `json`; begrenzter nichtleerer Labeltext. `json` wird vollständig gegen dasselbe unveränderte offizielle JSON-Config-Schema geprüft. Keine weiteren eingebetteten Schemas. |

Die vollständige Prüfung der eingebetteten Systemkonfiguration deckte drei zusätzliche echte Konfigurationsabweichungen auf: `country.max-length` wurde zu `maxLength`; `language.system: false` und `i18n: false` deklarieren die bisher nicht aktivierten Optionen ausdrücklich. Die erlaubte Konfiguration wird nicht zur Umgehung dieser Fehler abgeschwächt.

Der Profiltest führt 25 gezielte unzulässige Mutationen durch: unbekannte Felder, falsche Identitäten/Versionen/Flags, fremde oder ausführbare Lizenzlinks sowie ungültige verschachtelte JSON-Konfiguration. Dazu kommen sieben ungültige Semver-Eingaben, die Ablehnung eines unerwartet offenen Basisschemas und der Nachweis, dass die Originalschema-Daten unverändert bleiben. Die genaue Umsetzung liegt getrennt vom überschaubaren Upstream-Validatorpatch vor.

## Nachvollziehbarer Validator

`tools/vendor/iobroker-testing-package-files.cjs` basiert vollständig auf dem installierten `@iobroker/testing` **6.3.1**. Original-SHA-256: `6c894734d8e8549790c8661c5ec4b1ad05084021ae11a0b6c6784b92099fc2b8`. Die Änderungen sind im benachbarten `package-validator-profile.patch` vollständig sichtbar. Die MIT-Lizenz und Urheberangabe liegen beim Quelltext.

`test/package.js` vergleicht die installierte Upstream-Version und deren Originaldatei sowie die geprüfte Forkdatei und das explizite EOS-Overlay mit der Provenienz, bevor diese lokalen Module ausgeführt werden. Eine andere Testbibliotheksversion erfordert eine neue bewusste Prüfung. Der Validator prüft weiterhin die **tatsächlichen** Produktdateien: Paket-/Adapteridentität, Versionen, Lizenzkonsistenz, vollständiges io-package-Schema mit dem oben offengelegten EOS-Profil, JSON-Konfiguration, Sprachdateien, übrige JSON/JSON5-Dateien, README und Lizenzdateien. Es wird kein synthetisches Paket mit erfundener Repository-URL vorgeschoben. Keine Schema-Prüfung wird über `ignore*Validation` abgeschaltet und kein fehlgeschlagener Test übersprungen.

Die vollständigen MIT-Lizenztexte beider Schema-Repositories stammen aus denselben gepinnten Commits (`test/schemas/*schema.LICENSE`, `license-sources.json`); ihre Hashes werden ebenfalls geprüft. Die Schema-Provenienz steht in `test/schemas/sources.json` mit offiziellen Projekt-URLs, unveränderlichen Commit-IDs und Hashes. Ein Schema-Update muss diese Herkunft erneut verifizieren, die Dateien aktualisieren und die vollständige Paketprüfung ausführen. Der Test behauptet keine automatische Übereinstimmung mit einem künftig veränderten `master`-/`main`-Schema.

## Testbefehle und Reichweite

- `npm run test:package`: vollständiges oben beschriebenes Paketprofil ohne Netzwerkdownload.
- `npm test`: Paketprofil und die im Projekt eingestellte Unit-/Security-Suite; die tatsächliche Ausgabe ist maßgeblich.
- `npm run lint-backend` und TypeScript-Prüfung bleiben zusätzliche Gates.

Die frühere Upstream-Unit-Stufe führte lediglich den Test `DEPRECATED!` aus. `test:unit` führt jetzt tatsächlich `node --test test/eos-*.test.cjs` aus; der Platzhalter wird nicht als Laufzeitnachweis verwendet. Die finalen Befehlsausgaben werden zusammen mit diesem Profil gespeichert. Paket-/Schemaerfolg ersetzt keinen realen ioBroker-Controller- oder Anlagentest und keine npm-Veröffentlichung.

Finaler beobachteter Stand: `npm test` erfolgreich mit **74 Paketprüfungen und 200 EOS-Tests**, keine Fehler oder übersprungenen EOS-Tests. Vollständiges `npm run lint-backend` und `tsc --noEmit` erfolgreich. Rohlogs und SHA-256-Zuordnung stehen in `package-test-evidence.json`; spätere kanonische Release-Prüfungen haben Vorrang.
