# Installationstest 7.9.93

```bash
cd /opt/iobroker
iobroker backup
iobroker stop eos-admin.0
npm install --no-save --omit=dev /PFAD/iobroker.eos-admin-7.9.93.tgz
iobroker upload eos-admin
iobroker restart eos-admin.0
```

Prüfen: Login ohne Scrollbalken, Modul-Suche `[NexoWatt]`, EOS-Assist-Konfiguration als Admin, Live-Fragen mit allen drei Rollen, Dienste-/Reservefilter, Neustart und Backup-Rücklesetest.
