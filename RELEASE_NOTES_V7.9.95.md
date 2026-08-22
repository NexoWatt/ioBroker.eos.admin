# Release Notes – 7.9.95

- Flache Merge-ZIP für das direkte Entpacken in einen vorhandenen Repository-Ordner.
- Automatischer Versionsabgleich für `io-package.json`, Lockdateien, Frontend-Version, Build-Info und Repository-Eintrag.
- Selbsttest mit absichtlich veraltetem Stand 7.9.92.
- Windows-Helfer `MERGE_UPDATE.cmd` und `MERGE_UPDATE.ps1`.
- Keine funktionale Änderung an Login, Rollen, Port oder EOS-Assist-Sperre.
- npm-Dateiliste bereinigt: keine nicht vorhandenen 7.9.94-Dateien mehr; aktuelle Stable-, Merge- und Prüfscripte werden vollständig gepackt.
- Selbsttests an den dokumentierten Stable-Vertrag angeglichen: Startpasswort `nexowatt` mit Pflichtwechsel; EOS Assist bleibt deaktiviert.
- `package-lock.json`-Rootmetadaten (Skripte und Release-Policy) werden gemeinsam mit `package.json` synchronisiert und validiert.
- Die veröffentlichte npm-Tarball-Dateiliste enthält nur Runtime-Dateien, aktuelle Release-Dokumente und den installierten Update-Reparaturhelfer; Source-only-Prüfwerkzeuge bleiben in der Merge-/Repository-ZIP.
- Die ausgelieferte Merge-ZIP wird tatsächlich flach erzeugt, damit `package.json` direkt im bestehenden Repository-Ordner landet.
