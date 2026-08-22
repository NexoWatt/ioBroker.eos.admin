# npm-Freigabe 7.9.93

Nach erfolgreichem Realtest:

```powershell
npm login
npm whoami
npm run check:eos-package
npm run check:eos-stability
npm publish --dry-run --tag latest
npm publish --tag latest
```

Kontrolle:

```powershell
npm view iobroker.eos-admin@latest version
npm dist-tag ls iobroker.eos-admin
```
