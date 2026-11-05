# Lock metadata repair peer review — 2026-10-25

Reviewed `tools/nexowatt-repair-lock-metadata.cjs` in the corrected 7.10.12 tree. No repair-tool source edits by the reviewer. No publish, install, live registry metadata success, or tarball download was performed by this review.

The repair narrowly addresses missing provenance metadata without changing dependency versions. The exact actual package name and version are checked, including npm aliases. Accepted metadata requires canonical SHA-512 SRI and a fixed official npm registry HTTPS tarball path for that identity. Existing conflicting fields stop the operation. The shared transport enforces TLS verification, a five-second request budget and four-MiB maximum; four concurrent workers are bounded and no insecure fallback is present. All metadata requests must succeed before any input lock is replaced.

Changes are staged per file with original-byte backups and evidence. Manifest and lock input bytes are checked again before commit. An ordinary second-file commit failure restores the first input; a concurrent edit during rollback is preserved and reported for backup review. Per-file rename is atomic; the two locks and evidence journal are not a crash-atomic multi-file transaction.

## Verification

`node --test test/eos-lock-repair.test.cjs`: 10/10 passed on Linux with Node 24.22.1. Metadata was injected; no success against the real registry is claimed. Existing eight tests cover exact identity/graph preservation, deduplication, no-op/dry run, aliases, registry failure, rejected identity/hash/origin, conflicting existing metadata, and changes before commit. Reviewer added two failure-path tests:

- A simulated Windows-style EPERM sharing violation during the second lock rename restores both original locks, records ROLLED_BACK, preserves backups and removes staged files.
- A developer edit after the first commit is preserved during rollback; the result is ROLLBACK_REQUIRES_REVIEW.

The real network probe remains blocked in this environment. Original locks still have 563 affected locations/532 unique identities, and the strict provenance gate correctly remains blocked here.

## Three remaining limits to communicate

1. Registry identity and SRI metadata validation does not hash downloaded package tarball bytes, establish publisher attestation, perform a CVE audit, or demonstrate IEC/CRA conformity. Downstream consumers do not inherit a root package-lock from a published npm dependency.
2. The native HTTPS client requires accessible official registry HTTPS. It does not consume npm proxy configuration; a successful cached npm command does not establish connectivity for this repair. Failure preserves inputs and reports a bounded error.
3. No real Windows runner was available. Windows path/permission fixture portability was addressed; POSIX permission/symlink cases remain active on Linux, while the general restore-copy case runs cross-platform. Injected EPERM validates failure handling but is not an actual Windows filesystem test.

## Changed files owned by reviewer

- test/eos-license-trust.test.cjs
- test/eos-web-resources.test.cjs
- test/eos-lock-repair.test.cjs (only the two rollback cases)

Portable trust/web tests passed 24/24 in source mode and 24/24 in build mode. No production policy or trust-platform allowance was relaxed.

Evidence: lock-repair-peer-tests.json/.log, portable-test-results.json, portable-source.log, portable-build.log, npm-publish-dry-run-fixture.json/.log. All paths are under the external review directory and require packaging by the parent task.
