# Review-bound publish-test fixtures

These unmodified `@iobroker/gui-components` 10.3.14 ObjectBrowser modules are MIT-licensed; see `LICENSE.gui-components`. Their exact SHA-256 values must match the reviewed pre-bundle overlay manifest. `provenance.json` also records the npm integrity value from the installed lockfile.

`ObjectBrowserValue.test.cjs` is a generated test-only compilation of the EOS dialog. The test checks its SHA-256 and the current source SHA-256 before executing methods with a minimal React state shim. It is not a browser/runtime asset and does not replace the normal TypeScript/Vite build.

Run `node tools/nexowatt-admin8-objectbrowser-fixtures.mjs --check` with development dependencies to compare the current compiler output and reviewed vendor inputs byte-for-byte. This check belongs to the full build security gate. After a deliberate reviewed source change, `node tools/nexowatt-admin8-objectbrowser-fixtures.mjs` refreshes the fixtures. Do not change fixture hashes to bypass a failed review.

The publish-time interaction selftest uses only Node 24 builtins and performs every behavioral assertion without frontend dependencies. It never silently skips missing dependencies.
