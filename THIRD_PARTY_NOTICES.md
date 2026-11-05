# Third-party notices

This repository contains software components derived from or compatible with the upstream ioBroker.admin project. The following notice is retained for the upstream MIT-licensed portions.

The MIT License (MIT)

Copyright (c) 2014-2026 bluefox <dogafox@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## OAuth2-Modell-Testfixture

`test/fixtures/oauth2-model-v1.4.0.ts` stammt unverändert aus `ioBroker/webserver`, Tag v1.4.0, Git-Blob `3651fb210e04ebb92d952b2a532cebf6d5223df6`. Die MIT-Lizenz des Projekts liegt als `test/fixtures/OAUTH2_MODEL_LICENSE` bei. Die Datei dient ausschließlich der reproduzierbaren Prüfung des EOS-Sitzungswiderrufs; sie ersetzt keine ausgelieferte Laufzeitabhängigkeit.

## Admin 8 migration (2026-11-04)

The actual upstream base is ioBroker.admin 8.3.5 (commit `6f77eedf525813a7a61d79188d1ff05dffd05086`). Bundled GUI modules include `@iobroker/gui-components` 10.3.14; the EOS overlay is applied to reviewed unminified inputs and is documented in `docs/security/NEXOWATT_ADMIN8_FRONTEND_SECURITY_MIGRATION_2026-11-04.md`.

Exact unmodified LICENSE/NOTICE texts, package versions, origins and hashes for the identified bundled packages are recorded under `docs/third-party/admin8/` by `tools/nexowatt-artifact-inventory.cjs`. That inventory describes its coverage limits explicitly; a package metadata license label alone is not substituted for a supplied license text.

The release-only parser is Acorn 8.17.0 (MIT); its exact source, license and provenance are in `tools/vendor/acorn/`. Reviewed GUI test fixtures and their MIT license/provenance are in `tools/fixtures/admin8-objectbrowser/`. The runtime OAuth alias resolves to `@node-oauth/oauth2-server` 5.3.1 (MIT), as recorded in the lockfiles and dependency report. Original notices above remain applicable.

The development-only EOS package validator is a narrowly adapted copy of the MIT-licensed `@iobroker/testing` 6.3.1 `packageFiles` validator (Copyright 2024–2026 AlCalzone). Its exact original/fork hashes, reviewed diff and complete MIT notice are provided in `tools/vendor/package-profile-provenance.json`, `docs/security/admin8-2026-11-04/package-validator-profile.patch` and `tools/vendor/iobroker-testing-package-files.LICENSE`. The offline schema pins retain their official ioBroker origin in `test/schemas/sources.json`; they are validation inputs, not runtime libraries.

The complete MIT license texts for both pinned schema repositories are retained in `test/schemas/io-package-schema.LICENSE` and `test/schemas/jsonConfig-schema.LICENSE`; immutable-commit provenance and file hashes are in `test/schemas/license-sources.json`. The separate EOS metadata overlay is original project validation code, not an unmodified upstream schema.

## EasyAccess-Nachprüfung vom 05.11.2026

Die tatsächliche Zusammensetzung von `@iobroker/admin-component-easy-access`3.0.8 und seine Generatorherkunft sind unter `docs/ea/` dokumentiert. Dort liegen eine ergänzende CycloneDX-Komponentenliste, unveränderte verfügbare Lizenz-/Notice-Texte und `license-provenance.json`. Fehlende Volltexte für qrcode-generator2.0.4 und das native Rolldown-Buildbinding1.2.7 bleiben ausdrücklich offen. Der Anwendungscode wurde nicht verändert.
