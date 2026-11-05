# Ergänzende Codeprüfung – Systembereich und Lizenzoberfläche

Stand: 05.11.2026, EOS Admin 8.0.2. Prüfung der von anderen Bearbeitern geänderten
Frontendbereiche; die eigene Backendkorrektur ist in `BACKEND_ROLE_REVIEW_DE.md`
getrennt beschrieben. Dies ist eine zusätzliche interne Codeprüfung, keine
unabhängige Zertifizierung oder vollständige Penetrationsprüfung.

## Geprüfter Umfang

- `App.tsx` und `Drawer.tsx`: sichtbare System-/Expertenzugänge, spätes Eintreffen
  des authentifizierten Rollenstatus, Widerruf und weiterhin getrennte
  Administrator-/Installateur-/Endkundenrechte.
- `SystemSettings/index.tsx` und `MainSettingsDialog.tsx`: vorhandene Konfiguration,
  Kundennamen-/Anlagenbezeichnung, Lade-/Speicherfehler und Lizenzregister.
- `EosLicenseDialog.tsx`, `eosLicenseApi.ts`, `eos-license-link.js`:
  vorhandene Lizenz-API, Home/Pro, Eingabebehandlung, Antwortprojektion,
  Zeit-/Größenlimits, Abbruch und entfernte schwebende Zusatzschaltfläche.
- Bestehende Backendgrenzen für OAuth, Rollen und Lizenzverwaltung.

## Im Review nachgebesserte Punkte

1. React entscheidet nun anhand des geprüften Rollenstatus im Komponentenstatus.
   Eine spätere Änderung der alten globalen Rollenvariable kann nach Widerruf
   keine Experten-/Systembedienelemente wieder freigeben. Auch bereits erzeugte
   Ereignisbehandlungen prüfen die aktuelle Rolle erneut.
2. Die Antwort einer Lizenzentfernung wird zurückgewiesen, wenn sie weiterhin
   eine gültige Lizenz meldet. Eine fehlgeschlagene Aktivierung kann ebenfalls
   keine Erfolgsmeldung erzeugen. System-UUIDs erhalten eine Strukturprüfung.
3. Fehler beim Verschlüsseln, Schreiben oder Aktualisieren vorhandener
   Adapter-Lizenzzugangsdaten gelangen in die gemeinsame Fehlerbehandlung.
   Die Oberfläche bleibt mit den eingegebenen Änderungen offen und behauptet
   kein erfolgreiches Speichern.

## Prüfergebnis

Der kombinierte Lauf

```
node --test test/eos-admin8-navigation.test.cjs test/eos-system-save.test.cjs test/eos-system-license-ui.test.cjs
```

bestand auf Node.js 24.22.1 mit **22/22 Tests**, ohne übersprungene Tests.
Rohbeleg: `review-tests.log`. Navigation und Speichervorgang verwenden die
tatsächlichen TSX-Methoden, jedoch synthetische Umgebung/Controller-Schnittstellen.
Die API-Prüfungen decken positive und negative Antworten sowie tatsächlich
abgebrochene HTTP-Antwortströme bei Gesamtdeadline und Panel-Schließen ab.

Zusätzlich wurden die vorhandenen 40 Prüfungen der serverseitigen
Sicherheitsgrenzen erfolgreich ausgeführt. Der übergeordnete Releaseprüflauf
führt deren Rohbeleg und die übrigen Paketprüfungen zusammen.

Die neue Lizenzoberfläche speichert keinen Aktivierungscode im Browserspeicher,
zeigt gespeicherte Codes nicht erneut an und übernimmt nur freigegebene
Statusfelder. Browseranfragen bleiben am gleichen Ursprung und folgen keinen
Weiterleitungen. Unbekannte Fehlertexte aus Antworten werden nicht angezeigt.
HTTP-/HTTPS-, CSRF-, Rollen-, Raten- und Größenprüfungen des Backends bleiben
wirksam. Ein ausgeblendetes Bedienelement wird nicht als Berechtigungsnachweis
verwendet.

Keine offene kritische Abweichung wurde im beschriebenen Änderungsumfang
festgestellt. Die Systemkonfiguration wird weiterhin über die vorhandenen
Controller-APIs geschrieben; mehrere betroffene Objekte bilden keine neue
atomare Datenbanktransaktion. Ein Fehler kann nach einem bereits erfolgreichen
Teilschritt auftreten und wird jetzt sichtbar gemeldet. Der tatsächliche
Browser-/Praxistest und das vollständige Releasepaket werden getrennt abgenommen.
