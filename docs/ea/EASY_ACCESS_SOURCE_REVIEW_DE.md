# EasyAccess 3.0.8: Herkunft, reproduzierter Build und tatsächliche Komponenten

Prüfung am 05.11.2026 für `EOS-ADMIN8-CUSTOM-BUNDLE-001`. Geprüft wurde die unveränderte EasyAccess-Lieferung aus EOS Admin 8.0.0. Keine Produktdatei wurde geändert; die Installation und Reproduktion fanden ausschließlich in einer getrennten Prüfumgebung statt.

## Ergebnis

Die bislang undurchsichtige Zusammensetzung des vorgebauten Browserartefakts ist jetzt technisch nachvollzogen: **26 von 26 Lieferdateien wurden bytegleich reproduziert**, der unveränderte offizielle Source-Lock wurde verwendet, und ein ausschließlich beobachtender Vite-Hook ordnet **12.089 Moduleinträge in 14 erzeugten Chunks zu 63 Paketinstallationen** zu. Kein physisches Modul blieb ohne Paket-/Quellzuordnung. 28 zusätzliche virtuelle Module sind ebenfalls zugeordnet: vier Helper der vom Compiler gemeldeten OXC-Runtime 0.148.0 sowie Rolldown-, Vite- und Federation-Helfer. Ihre Quellwerkzeuge sind über Original-Lock, Paketmanifesthashes und bytegleichen Build gebunden. Die 63 Paketinstallationen allein sind daher keine vollständige Zählung sämtlicher generierter Laufzeithelfer.

Die erneute npm-Prüfung des vollständigen ursprünglichen EasyAccess-Buildbaums liefert **23 Paketmeldungen: 10 hoch und 13 mittel**. **Keines dieser 23 gemeldeten Pakete trägt ein Modul zu dem bytegleich nachgebauten ausgelieferten Browserartefakt bei.** Vite und Federation-Vite erzeugen zwar Browserhilfscode; die gemeldeten verwundbaren Node-Server-/Editor-/Typgeneratorpfade sind darin aber nicht enthalten. Dies ist eine konkrete Artefaktzuordnung, keine pauschale Behauptung, alle Entwicklungswerkzeuge seien sicher oder die Software habe keine unbekannten Schwachstellen.

Zusammen mit dem getrennten tatsächlichen Browser-/Komponententest und dem Quellreview kann die ursprüngliche Lücke „nicht nachvollzogene vorgebaute Bibliotheken“ fachlich geschlossen werden. Neue konkrete UI-/Robustheitsbefunde und die reale Zielsystemabnahme behalten eigene Kennungen und werden dadurch nicht geschlossen.

## Offizielle Herkunft und Integrität

- Projekt: `https://github.com/ioBroker/ioBroker.admin-component-easy-access`
- Offizieller Tag: `v3.0.8`; annotiertes Tagobjekt `19f3c584d606570e5fcc00beca83d70c5693c653`.
- Commit nach Tagauflösung und npm-`gitHead`: `ae303bdabc73c2588b1194d2f0c4951ac0d8b00e`.
- npm-Paket: `@iobroker/admin-component-easy-access@3.0.8`, veröffentlicht laut Hersteller am 03.09.2026.
- Tarball: `https://registry.npmjs.org/@iobroker/admin-component-easy-access/-/admin-component-easy-access-3.0.8.tgz`.
- SHA-512: `a38603ef8a70cfea6793f0198af4604bb30d5e3851215828060cfeaa7d3ba755d97fef45d7849483835d39f658652c88556f70b49b67c8da2f45f948a586bcf9`.
- Source-Lock SHA-256: `f45f9b4bbc5b2dc0265e5bd5887045020d15fac11ae712cb616cd00e0423307c`.

Der unabhängig neu geladene Tarball stimmt mit der SHA-512-Angabe im EOS-Lock und mit allen 26 gelieferten Dateien überein. Das npm-Paket enthält 30 Dateien, aber keine Quelltexte, Sourcemaps, Build-Lock oder eigene SBOM. Diese Informationen wurden deshalb aus dem offiziellen, exakt gepinnten Git-Quellstand ergänzt.

Die Registry liefert ein Publish-Attestat und eine SLSA-v1-Provenienz. Deren Nutzlast bindet den tatsächlichen Tarballhash an Tag, Commit, Workflow `.github/workflows/test-and-release.yml` und Actionslauf `33781989402`, Versuch 1. Zusätzlich wurde npm-eigenes `npm audit signatures --json` in einem isolierten Baum mit genau diesem Paket ausgeführt: Exit 0, `invalid: []`, `missing: []`. Das ist ein Herkunfts-/Signaturnachweis und keine Code-Sicherheitsbewertung.

## Reproduktion und Zuordnung

Umgebung: Linux x64, Node.js 24.22.1, npm 11.9.0. Original-Lock: 700 Einträge einschließlich Wurzel; alle 699 Pakete haben Registry-HTTPS-Adresse und SHA-512. `npm ci --ignore-scripts --no-audit --no-fund` installierte 651 Pakete; plattformabhängige optionale Einträge erklären den Unterschied. Keine fremden Installationsskripte wurden ausgeführt. Der Lock blieb bytegleich.

Die offiziellen Stufen wurden mit `node --import tsx tasks.ts --0-clean`, `--2-compile` und `--3-copy` ausgeführt. Dadurch wurde die zusätzliche automatische `npmInstall`-Stufe des vollständigen Upstream-Skripts vermieden; die bereits exakt installierte Lock-Umgebung blieb erhalten. Typprüfung und Vite-Build waren erfolgreich, alle 26 Lieferdateien identisch.

Anschließend wurde `vite.config.inventory.ts` als rein lesender `generateBundle`-Beobachter ausgeführt. Er schreibt außerhalb des Buildordners und verändert keine Chunks. Auch danach sind alle 16 generierten Lieferdateien bytegleich; die zehn unveränderten Sprachdateien werden gesondert gebunden. Paketzuordnung, Version, Paketmanifesthash, Lock-Integrität und konkrete Modul-/Chunklisten stehen in `easy-access-bundle-inventory.json`. Die flache CycloneDX-Komponentenliste ist `easy-access-bom.cdx.json`; sie behauptet keinen vollständigen transitive Abhängigkeitsgraphen.

Die Inventur umfasst vorsorglich auch zugeordnete Module mit `renderedLength = 0` sowie alle ausgelieferten Chunks, nicht nur den im Browser zuerst geladenen Pfad. Die generierten Federation-Startdateien und Vite-Preload-Helfer sind zusätzlich durch ihre unveränderten Bytes und den nachgewiesenen Build gebunden. Deren Herkunft aus einem Buildwerkzeug bedeutet nicht, dass dessen Server-, ZIP- oder CLI-Code im Browser mitgeliefert wird.

## Bewertung der Auditmeldungen

Das Ergebnis des Original-Source-Locks steht unverändert in `upstream-source-lock-audit.json`. Jede der 23 Paketmeldungen ist in `easy-access-bundle-inventory.json` unter `auditTriage` einzeln gegen die tatsächlichen Modulbeiträge abgeglichen. Beispielsweise kommen `node-forge` 1.4.0 und `axios` 1.18.1 über `@iobroker/js-controller-common-db` in den Buildbaum; sie sind keine Modulbeiträge im erzeugten Browserartefakt. Zod kommt über das Lintwerkzeug, adm-zip/undici über den Federation-Typgenerator, source-map-js über PostCSS, glob/brace-expansion/minimatch über Build-/Lintwerkzeuge. Die Vite-Meldungen betreffen Entwicklungsserver-/Editorwege und werden nicht aus der mitgelieferten Preload-Hilfsfunktion als Browserlücke abgeleitet.

Die acht im Federation-Manifest deklarierten geteilten Bibliotheksversionen stimmen mit dem offiziellen Source-Lock überein. Die tatsächliche Hostauflösung von Singleton-Bibliotheken bleibt eine eigene Integrationseigenschaft: Der im Paket enthaltene Fallback und eine später vom Host gewählte Bibliothek sind nicht dasselbe.

Eine zusätzliche aktuelle Registry-Bulkabfrage umfasst die tatsächlichen Paketversionen, OXC 0.148.0 und ihre Buildgeneratoren. Sie meldet ausschließlich Vite; die betroffenen Entwicklungsserver-/Editorfunktionen sind nicht Bestandteil der ausgelieferten DOM-/Modulepreload-Helfer. Anfrage, Originalantwort und Einzelbewertung sind mitgesichert.

Die unveränderten vollständigen LICENSE/COPYING/NOTICE-Dateien sind für alle vorgefundenen Pakete und Generatoren unter `third-party/` gesichert. `license-provenance.json` weist zwei fehlende Volltexte ausdrücklich aus: `qrcode-generator` 2.0.4 und das native Build-Binding `@rolldown/binding-linux-x64-gnu` 1.2.7. Deklarationen wurden nicht durch erfundene oder fremde Lizenztexte ersetzt. Die OXC-Lizenz stammt aus dem separat integritätsgeprüften Referenzpaket.

## Verbleibende Grenzen

- Die Prüfung weist Herkunft, konkreten Build und bekannte Advisory-Zuordnung für dieses Artefakt nach. Sie ersetzt keine unabhängige Zertifizierung oder vollständige manuelle Prüfung aller Fremdbibliotheken.
- Die upstream CI benutzt `npm i` und nicht an Commit-SHAs gebundene Action-Tags. Der hier gelungene bytegleiche Build beweist den vorliegenden Lieferstand, nicht automatisch eine generell unveränderliche Releasepipeline.
- Ein erneuter Build mit anderen Quellen, Locks, Werkzeugen oder zusätzlicher Instrumentierung benötigt einen neuen Artefaktvergleich. Alte Belege dürfen nicht umetikettiert werden.
- Laufzeitrollen, echte Controllerkonfiguration, Zielhardware, Anlagenverhalten und Wiederherstellung sind getrennte Abnahmebereiche.

## Reproduzierbare Belege

`package-3.0.8-registry.json`, `package-pack.json`, `registry-attestations.json`, beide `attestation-statement-*.json`, `registry-signature-verification.json`, `install-precheck.json`, `locked-install.log`, `original-build-*.log`, `original-build-comparison.json`, `instrumented-build.log`, `instrumented-build-comparison.json`, `observed-bundle-modules.json`, `easy-access-bundle-inventory.json`, `easy-access-bom.cdx.json`, `inventory_analysis.py`, `upstream-source-proof/` und der Beobachter `vite.config.inventory.ts`.
