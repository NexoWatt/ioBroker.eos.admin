# NexoWatt EOS Admin 7.9.98 veröffentlichen

## Empfohlener Weg: geprüftes TGZ veröffentlichen

Dadurch können keine alten oder lokal zusätzlich vorhandenen Dateien in das npm-Paket gelangen.

```powershell
npm login
npm whoami
npm publish .\iobroker.eos-admin-7.9.98.tgz --dry-run --tag latest
npm publish .\iobroker.eos-admin-7.9.98.tgz --tag latest
```

Der Dry-Run muss mit folgendem Paket enden:

```text
+ iobroker.eos-admin@7.9.98
```

## Veröffentlichung direkt aus dem Repository

Nur aus einem sauberen Arbeitsordner ausführen:

```powershell
npm login
npm whoami
npm run sync:eos-version
npm run check:eos-release
npm publish --dry-run --tag latest
npm publish --tag latest
```

Bei einem Fehler nicht veröffentlichen. Insbesondere müssen `package.json`, `package-lock.json`, `io-package.json`, `src-admin/package.json` und `src-admin/src/version.json` dieselbe Version enthalten.
