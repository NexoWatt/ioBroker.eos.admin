# Nachweis vor der Korrektur: ZIP über vorhandenen Arbeitsordner kopieren

Kennung: `EOS-ADMIN8-COPY-OVERLAY-001`. Geprüfter Ausgangsstand: EOS Admin 8.0.0 aus der zuletzt gelieferten vollständigen Repository-ZIP. Die konkrete Umgebung, Quellhashes und Messergebnisse stehen in `overlay-before.json`.

## Ausführung und Ergebnis

Die unveränderte Funktion `collectLegacyRuntimeFiles()` aus `tools/nexowatt-clean-legacy-runtime.cjs` wurde in einer getrennten temporären Teststruktur ausgeführt. Diese enthielt die tatsächlich gelieferten `package.json`, `NEXOWATT_EOS_BUILD_INFO.json` und `adminWww/NEXOWATT_EOS_FRONTEND_MANIFEST.json`. Sechs zusätzliche, synthetische alte Release-Dateien wurden angelegt; sie enthielten ausschließlich Testtext.

| Synthetische alte Datei | Vom bisherigen Bereiniger erkannt |
| --- | --- |
| `adminWww/assets/old-EXAMPLE.js` | Ja |
| `adminWww/assets/old-EXAMPLE.css` | Nein |
| `adminWww/assets/old-EXAMPLE.js.map` | Nein |
| `admin/custom/assets/old-EXAMPLE.js` | Nein |
| `src-admin/src/RemovedAdmin7.tsx` | Nein |
| `tools/removed-test.cjs` | Nein |

Die tatsächliche Auswahl wurde mit einer strikten Assertion auf genau die eine JavaScript-Datei geprüft. Alle sechs Pfade liegen in den vom Prebuilt-Selbsttest überwachten Verzeichnissen. Nicht im aktuellen Manifest enthaltene Dateien werden dort als zusätzliche, unversiegelte Dateien zurückgewiesen. Die Frontendprüfung weist außerdem zusätzliche, nicht im Buildnachweis enthaltene Quellen zurück.

Dies weist eine konkrete Lücke im bisherigen Überkopierablauf nach: Das Kopieren eines vollständigen ZIP entfernt keine Dateien, die nur im alten Stand existieren; der vorhandene Bereiniger erfasst nicht alle solchen Restdateien. Der vorhandene Merge-Selbsttest prüft überwiegend Skriptmarker und Orchestrierung, aber keinen tatsächlichen Übergang eines alten Dateibaums auf den neuen Stand.

## Abgrenzung zur Nutzermeldung

Der Nutzer hat Node.js 24.21.0 sowie den abschließenden npm-Fehler mit der gesamten Lifecycle-Kette übermittelt. Die erste eigentliche Fehlermeldung fehlt. Deshalb ist die konkrete Ursache dieses einzelnen Windows-Abbruchs noch nicht eindeutig festgestellt.

24.21.0 liegt unter der deklarierten Mindestversion 24.22.1. Die bisher geprüften Publish-Skripte setzen jedoch keine ausdrückliche Patchversionsprüfung durch; die Repository-`.npmrc` setzt nur den Veröffentlichungskanal. Die abschließende Zeile `Node.js v24.21.0` ist daher kein Beweis, dass gerade eine Versionsprüfung den Ablauf beendet hat. Auch ein anderer unbehandelter JavaScript-Fehler kann eine solche Abschlusszeile erzeugen.

Die Reproduktion lief unter Linux mit der in der JSON-Datei genannten Node-Version. Ein nativer Windows-/Explorer-Test wurde nicht durchgeführt. Geprüft wurde der Bereiniger, nicht eine vollständige Veröffentlichung aus dieser bewusst unvollständigen Teststruktur. Das produktive Repository wurde nicht verändert; die relevanten Quellhashes wurden vor und nach der Prüfung verglichen. Die temporären Testdateien wurden nach der Prüfung entfernt.

## Folgerung für die Nachprüfung

Die Korrektur muss ein echtes Überkopieren mit alten JavaScript-, CSS-, Sourcemap-, EasyAccess- und Quelldateien prüfen. Fehlende oder veränderte aktuelle Release-Dateien müssen weiterhin abgewiesen werden. Git-Metadaten, lokale Daten und Zugangsdaten dürfen nicht pauschal gelöscht oder veröffentlicht werden. Die Korrektur darf weder Mindestversion noch Integritätsprüfung abschwächen und ist kein Nachweis vollständiger Windows-Kompatibilität oder der tatsächlichen npm-Kontoberechtigungen.
