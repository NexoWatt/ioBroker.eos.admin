# Windows-Pfadkorrektur und npm-Nachprüfung

Bezug: `EOS-ADMIN8-WINDOWS-PATH-001`, EOS Admin 8.0.0, 05.11.2026.

Der gemeldete Explorer-Fehler 0x80010135 wurde anhand des gelieferten ZIP und des im Screenshot gezeigten Zielordners auf zu lange Pfade eingegrenzt. Der gesamte EasyAccess-Nachweisordner wurde von `docs/security/admin8-2026-11-05/source-evidence` nach `docs/ea` verschoben. Interne Relativpfade bleiben gültig; referenzierende Dokumente und betroffene Hashindexeinträge wurden angepasst. Der alte falsch benannte Beobachterpfad im Quellbericht ist auf die tatsächlich mitgelieferte `vite.config.inventory.ts` korrigiert.

Die originale Upstream-Quellkopie, Locks, Produktquellen, Laufzeit, Entwicklungstestbelege und Versiegelung wurden nicht verändert. Die neue `.gitattributes` verhindert Git-Zeilenendenumwandlung. README und LICENSE bleiben bytegleich. Die Übernahmeanleitung im Repositorywurzelverzeichnis ist `WINDOWS_GIT_NPM_DE.md`.

Tatsächlich ausgeführt: bestehender Prebuilt-Selbsttest und Entwicklungstest-Nachweisprüfung jeweils Exit 0; lokales Git add/commit/clone mit `core.autocrlf=true` und `core.eol=crlf` für 2.222 Dateien ohne Byteabweichung; anschließend normales `npm publish --dry-run --json` aus dieser Kopie ohne node_modules, Exit 0. Der vorhandene Publish-Ablauf erneuert ausschließlich Zeitstempel in vier Inventur-/SBOM-Berichten. Dies wurde durch strukturellen JSON-Vergleich geprüft. Quell-, Lock- und Laufzeitdateien blieben unverändert. Der Git-Test umfasst den Stand vor Hinzufügen dieser Prüfberichte und den abschließenden Dokumentationskorrekturen; keine neue Produktprüfung wird daraus behauptet.

`validation.json` nennt Umgebung, Befehle, Ergebnis und Grenzen; die gleichnamigen Logs sind Rohbelege. `path-budget.json` misst die vollständigen Pfade des fertigen ZIP-Inhalts für den Benutzerzielordner und das kurze Entpackziel. Windows-Pfadlängen wurden rechnerisch geprüft; ein nativer Windows-/Explorer-Test wurde nicht ausgeführt. Anmeldung, Veröffentlichungsrechte, 2FA und freie npm-Version muss der reale Upload erfüllen. Es wurde nicht veröffentlicht oder auf einer Anlage installiert.

Bisherige Funktions-/Robustheitsbefunde und Zielsystemabnahme bleiben unverändert offen. Keine neue IEC-/CRA-Konformitätsaussage oder Garantie von Fehlerfreiheit.


Nachtrag 05.11.2026: Der aktuelle Kopierablauf und die zusätzliche Node-22-Unterstützung sind im Bericht `docs/security/admin8-2026-11-05/copy-update/REPORT_DE.md` (Pfad ab Repositorywurzel) dokumentiert. Frühere Angaben dieses Berichts bleiben historische Prüfstände.
