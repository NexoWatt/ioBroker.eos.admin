# NexoWatt EOS Admin 7.9.87-rc.3 auf npm veröffentlichen

Diese Version ist ein Release Candidate. Sie wird unter dem npm-Dist-Tag `rc` veröffentlicht. Der normale Installationskanal `latest` bleibt dadurch auf der freigegebenen Stable-Version.

## Prüfung

```powershell
npm run check:eos-publish-channel
npm run check:eos-package
npm run check:eos-stability
npm publish --dry-run --tag rc
```

Die letzte Zeile muss anzeigen:

```text
Publishing to https://registry.npmjs.org/ with tag rc
```

## Veröffentlichung

```powershell
npm login
npm whoami
npm publish --tag rc
```

Im Repository liegt zusätzlich eine `.npmrc` mit `tag=rc`. Dadurch funktioniert auch `npm publish` ohne Parameter. Der ausdrückliche Befehl `npm publish --tag rc` ist dennoch eindeutiger.

Ein Publish mit `--tag latest` wird vom Publish-Guard abgebrochen.

## Dist-Tags kontrollieren

```powershell
npm dist-tag ls iobroker.eos-admin
```

Erwartet:

```text
latest: 7.9.86
rc: 7.9.87-rc.3
```

## Release Candidate installieren

```bash
cd /opt/iobroker
npm install --no-save --omit=dev iobroker.eos-admin@rc
iobroker upload eos-admin
iobroker restart eos-admin.0
```

## Spätere Stable-Freigabe

Nach bestandener Abnahme wird die Version auf `7.9.87` ohne Prerelease-Suffix gesetzt. Erst diese Version wird mit dem Dist-Tag `latest` veröffentlicht.
