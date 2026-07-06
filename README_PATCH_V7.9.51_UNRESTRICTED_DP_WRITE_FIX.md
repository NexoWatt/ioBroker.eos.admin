# NexoWatt EOS Admin v7.9.51 – Unrestricted DP Write Fix

Dieser Patch behebt den manuellen Schreibpfad in der Datenpunkte-/ObjectBrowser-Ansicht.

## Kernänderungen

- `common.write=false` und `common.read=false` werden in der EOS-Oberfläche nicht mehr als Schreibsperre verwendet.
- Jeder vorhandene ioBroker-Objekt-Typ `state` kann in der Wert-Spalte angeklickt und geschrieben werden.
- Der native ObjectBrowser-Dialog und der EOS-Fallback-Dialog verwenden denselben harten Schreibpfad.
- Direkte Boolean-/Button-Schreibaktionen werden ebenfalls über den neuen Write-Bridge-Pfad abgesichert.
- Wenn `socket.setState(...)` vom Browser-/Benutzerkontext abgelehnt wird, versucht EOS zusätzlich die Backend-Bridge:

```text
eos-admin.0 → sendTo("eos:writeState") → setForeignStateAsync(id, state)
```

- Wenn auch der Controller/Backend-Schreibpfad ablehnt, wird der konkrete ioBroker-Fehler im Dialog angezeigt.

## Nicht geändert

- Datei-States (`common.type=file`) werden nicht als normaler State-Wert geschrieben.
- Objekt-Typen wie `folder`, `channel`, `device` oder `meta` werden nicht als State geschrieben.
- Die vorherigen Delete-, Logquiet- und Rollen-Fixes bleiben enthalten.

## Test

Nach Installation im Browser `Strg+F5` ausführen und dann unter **Datenpunkte** testen:

- Zahl-States, z. B. Temperatur-Sollwert
- Boolean-States, z. B. Schalten / Heizung an-aus
- Button-/Command-States
- States mit `common.write=false`

Wenn ein Schreibvorgang immer noch nicht angenommen wird, muss der angezeigte Fehlertext weitergegeben werden. Dann blockiert nicht mehr die EOS-Oberfläche, sondern ioBroker Controller/ACL oder der empfangende Adapter.
