# NexoWatt EOS Admin v7.9.52 – Fast Unrestricted DP Write

Dieser Patch reduziert die Last auf der Datenpunkte-Seite und ersetzt den fehleranfälligen nativen Wert-Klickpfad durch einen direkten EOS-Schreibdialog.

## Änderungen

- Datenpunkt-Werte werden per Capture-Click direkt über den EOS-Schreibdialog geöffnet.
- Der Schreibdialog schreibt zuerst über die `eos-admin` Backend-Bridge (`eos:writeState`) und nutzt `socket.setState` nur noch als Fallback.
- `common.write=false`, `common.read=false` und Frontend-Expertenmodus blockieren das manuelle Schreiben nicht mehr.
- Der Dialog wird auch geöffnet, wenn der ObjectBrowser-Cache noch lädt; Objekt/State werden mit kurzem Timeout nachgeladen.
- DOM-Vollscans auf `tab-objects` wurden für Branding-, Security-, Role- und DP-Hilfsskripte deutlich reduziert.
- Wiederholte `Translate:`-Logs und bekannte `common.adminUI`-SDK-Warnungen werden in der Browser-Konsole gefiltert.
- Neue Cache-Buster/Bundle-Namen: `DPWrite52`, `DPAdapter52`, `Objects-DPw52Fast`.

## Beibehaltene Fixes

- Delete-Hardfix für Dienste/Adapter.
- Delete-Logquiet-Fix.
- Drei-Rollen-Logik für Admin, Installateur und Endkunde.
- Unrestricted-DP-Write-Backend aus v7.9.51.
