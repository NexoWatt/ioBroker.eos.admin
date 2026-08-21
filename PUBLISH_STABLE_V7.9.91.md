# npm-Veröffentlichung – NexoWatt EOS Admin 7.9.91 Stable

## Vorprüfung

```powershell
npm login
npm whoami
npm run check:eos-publish-channel
npm run check:eos-package
npm run check:eos-stability
npm publish --dry-run --tag latest
```

## Veröffentlichung

```powershell
npm publish --tag latest
```

## Kontrolle

```powershell
npm view iobroker.eos-admin@latest version
npm dist-tag ls iobroker.eos-admin
```

Erwartet:

```text
latest: 7.9.91
```
