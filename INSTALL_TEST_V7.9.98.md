# Installationstest – NexoWatt EOS Admin 7.9.98

## Installation nach der npm-Veröffentlichung

```bash
cd /opt/iobroker
iobroker stop eos-admin.0
npm install --no-save --omit=dev iobroker.eos-admin@7.9.98
iobroker upload eos-admin
iobroker restart eos-admin.0
iobroker restart nexowatt-ui.0
```

Version prüfen:

```bash
node -p "require('/opt/iobroker/node_modules/iobroker.eos-admin/package.json').version"
```

Erwartet:

```text
7.9.98
```

Danach im Browser eine vollständige Aktualisierung mit `Strg + F5` durchführen.

## Installation des geprüften TGZ ohne Registry

```bash
cd /opt/iobroker
iobroker stop eos-admin.0
npm install --no-save --omit=dev /PFAD/iobroker.eos-admin-7.9.98.tgz
iobroker upload eos-admin
iobroker restart eos-admin.0
iobroker restart nexowatt-ui.0
```

Anschließend die vollständige Abnahme aus `RELEASE_ACCEPTANCE_V7.9.98.md` durchführen.
