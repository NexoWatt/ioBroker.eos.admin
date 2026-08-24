# Veröffentlichung – NexoWatt EOS Admin 7.10.2

Vor einer npm-Veröffentlichung ausführen:

```bash
npm ci
npm run check:eos-release
npm pack
```

Das Release-System kompiliert das Backend zusätzlich automatisch während `prepack` und `prepublishOnly`. Veröffentlicht werden darf ausschließlich das nach allen Prüfungen erzeugte Paket der Version 7.10.2.

Die bereits veröffentlichte Version 7.10.1 darf nicht überschrieben werden. npm-Versionen sind unveränderlich; deshalb wird der reparierte Stand als 7.10.2 ausgeliefert.
