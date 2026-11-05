# Abschlussbericht: NexoWatt EOS Admin 8.0.0

**Ergebnis:** Die technische Migration auf den tatsächlichen ioBroker-Admin-8.3.5-Quellstand ist umgesetzt, neu gebaut und im nachfolgend beschriebenen lokalen Profil geprüft. Der normale npm-Veröffentlichungsablauf hat als Dry-Run auch ohne installierte `node_modules` bestanden. Es wurde nichts veröffentlicht und kein Kundensystem verändert.

Eigene Produktversion: **8.0.0**. Upstream: **8.3.5**, Commit `6f77eedf525813a7a61d79188d1ff05dffd05086`. EOS-Ausgangspunkt: vollständiges 7.10.12-Repository, Eingangs-ZIP SHA256 `d67b1b0bb11b3b8f8ee416ac470ae9d51b00c8b23033908e1508c762a1720bae`. Die 7.9.2-Vergleichsbasis wurde anhand der gelieferten Quellen rekonstruiert; sie beweist keine ursprüngliche Git-Abstammung des ZIPs. Der frühere gescheiterte Admin-8-Vorbereitungsstand wurde nicht als funktionierende Admin-8-Basis ausgegeben.

## Tatsächliche Abschlussprüfungen

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| Kanonischer `npm run build` | Exit 0; echtes Frontend-Typechecking/Vite, echtes Backend-TypeScript, Inventare, Entwicklungstests und Versiegelung | `canonical-build.log` |
| Strenges, dokumentiertes EOS-Paketprofil | 74 bestanden; einschließlich 25 negativer Manipulationsfälle | `development-1.log`, `PACKAGE_TEST_PROFILE.md` |
| Gesamte EOS-Regressionen/Integration | 200 bestanden, keine Fehler und keine übersprungenen Fälle | `development-2.log` |
| ObjectBrowser | 55 Verhaltensprüfungen; zusätzlich Herkunft und frisches Compilergebnis der Fixtures bestätigt | `development-3.log`, `development-4.log` |
| Markdown | Tatsächliches React-Rendering, schädliche HTML-/URL-Eingaben und Abbruch/Unmount/Race-Fälle bestanden | `development-5.log` |
| Custom-Konfigurationskarten | Tatsächlicher Editor: Ausführungspfade vor Renderer/Request gesperrt, Schreiben verweigert, Bestandswerte erhalten, statische Karte funktioniert | `development-6.log` |
| Übersicht und Cachewechsel | Übergabe an React ohne Doppelansicht/Parallelpolling; versionsgebundene Skript-, CSS- und Socket-Adressen | `development-7.log`, `development-8.log` |
| Vollständiges ESLint | `npm run lint`, Exit 0; Backend ohne Befunde, Frontend 0 Fehler und 6 dokumentierte Warnungen | `final-full-lint.log` |
| Browser | Anmeldung, Administrator und Endkunde: keine Seitenfehler, Konsolenwarnungen/-fehler, fehlenden Ressourcen oder externen Abrufe | `browser/browser-verification-summary.json` |
| Fertiger Build | 1.090 Quell-/Laufzeitdateien versiegelt; 19 erreichbare lokale Backend-Laufzeitdateien auflösbar und syntaktisch gültig | `NEXOWATT_EOS_PREBUILT_MANIFEST.json` im Repositoryroot |
| Veröffentlichen ohne Entwicklungsinstallation | `npm publish --dry-run --json`, Exit 0, in vollständiger Kopie ohne `node_modules`; technische Lifecycle-Prüfungen aktiv | `publish-without-dependencies.log` |
| Identität des Dry-Run-Standes | Paket-, Lock-, io-package-, Frontend-, Prebuilt- und Entwicklungstest-Manifeste bytegleich zum Lieferstand | `FINAL_ARTIFACT_BINDING.json` |

Der lokale Prüfstand ist Linux x64 mit Node.js 24.22.1 und npm 11.9.0. Der dependencyfreie Veröffentlichungstest ist kein Test eines nativen Windows-Terminals. Seine Lifecycle-Befehle benötigen jedoch weder `tsc`/Vite noch eine Frontend-Installation, ein OpenSSL-Programm oder zusätzliche Shell-Reparaturschritte. Die echten Integrationstests mit installierten Bibliotheken laufen beim Build und sind im Lieferstand an 682 unveränderte Eingaben und ihre Original-Testausgaben gebunden; die Veröffentlichung prüft diesen Beleg und führt die portablen Regressionen erneut aus. Änderungen an relevanten Quellen machen den Beleg ungültig. Es gibt keinen stillen Skip bei fehlenden Abhängigkeiten.

Die Bildnachweise stammen aus der echten gebauten Produktionsoberfläche. HTTP-/WebSocket-Antworten sind ausdrücklich synthetische Testdaten. Der Browser prüft die tatsächlichen Startdateien und Rollenanzeige; er simuliert keinen Zugriff auf Dominiques Anlage. Der gemessene Frontend-Manifest-SHA256 ist `f46e01154994d504c064a6351cb8ba4fc15beda450afb96adba1db16962739a9`.

Das EOS-Paketprofil ist ausdrücklich ein enges Herstellerprofil über unveränderten offiziellen Schemas. Es erfindet kein Git-Repository und deklariert proprietäre Teile nicht als MIT. Bekannte EOS-Metadaten sind einzeln typisiert und gebunden; unbekannte Felder bleiben verboten. Der ursprüngliche offizielle Schemafehler und die begründete Erweiterung sind archiviert. Daraus folgt keine Aufnahmebestätigung für ein offizielles ioBroker-Repository.

## Sicherheitsänderungen mit sichtbarer Wirkung

- Admin-8-Server und neuer React-19-Build mit erhaltenen EOS-Rollen-, Konto-, Lizenz- und Datenpunktgrenzen; keine Umbenennung alter Admin-7-Bundles.
- Instanzproxy mit tatsächlicher TLS-Prüfung, aktuellen Sitzungs-/Gruppenentscheidungen, begrenzten Ressourcen und Widerruf langlebiger Verbindungen. Freigabe nur für tatsächliche ioBroker-Administratoren; die EOS-Installateurrolle wird nicht erweitert.
- Gepflegte OAuth-Implementierung und gezielte Sicherheitsupdates. Passwortanmeldung, Refreshrotation, Replay-Abweisung und Widerruf wurden über echte lokale HTTP-Anfragen geprüft.
- Betriebssystem-Passwort-RPC und automatische Standardpasswort-Anmeldeversuche entfernt. Individuelle ioBroker-Passwortverwaltung bleibt erhalten.
- Kein automatisches `npm install` während des Adapterstarts. Ungeprüfte unbeaufsichtigte Aktualisierungen bleiben gesperrt.
- Eigene Alias-/Custom-Editorpfade führen keine eingegebenen Funktionsstrings aus. Betroffene Customkarten mit ausführbaren Ausdrücken, nachgeladenem Code/dynamischer Ausdrucksauswertung oder Roh-HTML werden mit Meldung gesperrt; bestehende Werte werden nicht gelöscht.
- Dokumentationsabruf mit tatsächlichem Fünf-Sekunden-Gesamtbudget und 2-MiB-Grenze, ohne aktives Markdown-HTML.
- Versionsgebundene öffentliche Assets verhindern die Wiederverwendung lang gecachter Admin-7-Skripte. Die neue Federation-Startdatei wird durch den Build erzeugt; fertige komprimierte Module werden nicht nachträglich umgeschrieben.

Home/Pro, UUID-Bindung, NWL2-Signaturprüfung, verschlüsselte Ablage und Consumer-Leases bleiben kompatibel. Die Migration integriert nicht automatisch andere, hier nicht mitgelieferte NexoWatt-Adapter.

## Lieferkette und verbleibende Grenzen

Die abschließende npm-Prüfung meldet **null Befunde im aktuellen Backend-Produktions-Lock und im gesamten aktuellen `src-admin`-Lock**. Im Backend-Entwicklungsbaum verbleiben 15 mittlere npm-Meldungen aus drei dokumentierten Ursachen; keine hohen oder kritischen. 1.052 echte zwischengespeicherte Tarballs wurden unabhängig gegen SHA-512 geprüft. Lock-Inventar, installierter Baum und tatsächliche Bundle-Zuordnung sind getrennt nachgewiesen. Die aktuelle maschinenlesbare Artefaktinventur ist maßgeblich; optionale Peer-Verweise werden nicht verschwiegen.

Die separat vorgebaute EasyAccess-Komponente wurde am 05.11.2026 eigenständig nachgeprüft. Offizielle Herkunft, Signaturen, bytegleicher Nachbau, vollständige physische Modulzuordnung samt Generatorherkunft, aktuelle Advisory-Triage und tatsächliche Browserprüfungen sind nun belegt. Die ursprüngliche Nachweislücke `EOS-ADMIN8-CUSTOM-BUNDLE-001` ist für dieses Artefakt geschlossen. Der zusätzliche Original-Buildbaum hat 23 bewertete Meldungen; daraus wird keine pauschale Audit-0-Aussage für das gesamte Paket. Drei P2-Funktionsbefunde sowie reale Zielsystemabnahme bleiben offen. Details und Originalbelege: `../admin8-2026-11-05/EASYACCESS_FOLLOWUP_DE.md`. Die vorher entfernten 146 Altdateien bleiben aus dem Lieferumfang ausgeschlossen.

Ein vollständiger upstream-Lizenztext für `size-sensor` 1.0.2 fehlt weiterhin; dessen originale ISC-Zuordnung wurde unverändert gesichert. Alle dazugehörigen Grenzen stehen im Drittanbieter-Herkunftsnachweis. Keine erfundenen Copyrightzeilen oder pauschale rechtliche Freigabe wurden ergänzt.

**Die reale Zielsystemabnahme bleibt offen.** Benötigt werden ein gesicherter Upgrade-/Wiederherstellungsversuch, ein laufender unterstützter js-controller, reale TLS-/Netzwerkbedingungen, sämtliche Rollen, gültige/ungültige Home-/Pro-Lizenzen und die tatsächlichen Geräteaktionen. Allgemeine JSON-Config-Seiten installierter Drittanbieter-Adapter behalten eigene Ausdrucks-/Komponentenfähigkeiten und bilden eine separate Vertrauensgrenze. Der Gesamtbestand ist nicht als vollständig evalfrei oder vollständig nach jeder zusätzlichen TS-/JS-Regel modernisiert nachgewiesen.

Die einzelnen Anforderungen, Befunde, Verantwortlichkeiten und offenen Abnahmen stehen in `REQUIREMENTS_REVIEW_DE.md`. Die technische Auslieferung ist weder eine Behauptung völliger Fehlerfreiheit noch eine IEC-Zertifizierung oder CRA-Konformitätsbescheinigung. Für Vorgehen und Voraussetzungen siehe `START_HERE_8.0.0.md` und `docs/ADMIN8_MIGRATION_8.0.0_DE.md` im Repository.


Nachtrag 05.11.2026: Der aktuelle Kopierablauf und die zusätzliche Node-22-Unterstützung sind im Bericht `docs/security/admin8-2026-11-05/copy-update/REPORT_DE.md` (Pfad ab Repositorywurzel) dokumentiert. Frühere Angaben dieses Berichts bleiben historische Prüfstände.
