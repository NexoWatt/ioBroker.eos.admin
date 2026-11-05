# Windows: ZIP übernehmen, Git erhalten und aus VS Code veröffentlichen

Stand: 05.11.2026, EOS Admin 8.0.0. Der gemeldete Explorer-Fehler **0x80010135 „Pfad zu lang“** entsteht durch den vollständigen Datei- und Ordnerpfad. Im bisherigen ZIP lagen drei EasyAccess-Nachweisdateien im gezeigten Ziel über der klassischen Windows-Grenze. Die Nachweise liegen jetzt unter `docs/ea/`; die Originaldateien und der geprüfte Produktbuild bleiben erhalten.

## 1. Neu entpacken

1. Den abgebrochenen Kopiervorgang abbrechen. Den bisherigen Git-Ordner vollständig als Sicherung behalten; `.git` nicht löschen.
2. Das korrigierte vollständige ZIP verwenden. In „Alle extrahieren“ als Ziel ausdrücklich **`C:\nw`** wählen, sofern dort Schreibrechte bestehen, und keinen bereits belegten Projektordner überschreiben. Andernfalls einen ähnlich kurzen, beschreibbaren Ordner wählen.
3. Danach muss `C:\nw\ioBroker.eos-admin\package.json` vorhanden sein. Keinen zusätzlichen Zwischenordner mit dem langen ZIP-Dateinamen erzeugen. Falls dort schon eine Arbeitskopie liegt, einen anderen kurzen neuen Zielordner verwenden.
4. Den frisch entpackten Projektordner in VS Code öffnen. Für npm ist ein vorheriger Git-Upload nicht erforderlich.

Einfaches Überkopieren des alten Arbeitsordners kann veraltete Build-Dateien zurücklassen. Die Integritätsprüfung weist solche zusätzlichen Dateien zu Recht zurück. Deshalb mit dem vollständigen neuen Dateibaum arbeiten. Keine Löschbefehle wie `git clean -fdx`, keinen Reset und kein spiegelndes Kopieren mit `/MIR` verwenden.

## 2. Bestehende Git-Historie übernehmen

Für ein gewöhnliches Repository, bei dem `.git` ein **Ordner** ist:

1. Vorher `git status --short` im alten Ordner ansehen. Offene eigene Änderungen bleiben im alten Ordner gesichert und müssen anschließend gezielt verglichen werden. Auch unversionierte lokale Dateien behalten.
2. VS Code und andere Git-Programme für den alten Ordner schließen. Im Explorer „Ausgeblendete Elemente“ einschalten und ausschließlich den vollständigen Ordner `.git` aus dem alten Repository in den frisch entpackten Projektordner **kopieren**. Der alte Ordner bleibt unverändert erhalten.
3. Im neuen VS-Code-Terminal prüfen:

```powershell
git rev-parse --show-toplevel
git status --short
git diff --stat
git diff
git diff --cached --stat
git diff --cached
```

Der erste Befehl muss den **neuen** Arbeitsordner melden. Die Änderungen einschließlich entfallener Altdateien in VS Code prüfen und eigene noch benötigte Änderungen aus der Sicherung gezielt übernehmen. Auch bereits vorgemerkte Änderungen prüfen: Die `.git`-Kopie übernimmt den bisherigen Git-Index. Erst danach wie gewohnt committen und pushen. Keine npm-Tokens, Signierschlüssel oder produktiven Konfigurationsdateien aus der Sicherung übernehmen oder committen. Die vorhandene lokale Git-Historie, Branches und Remote-Konfiguration bleiben durch die vollständige `.git`-Kopie erhalten.

**Wenn `.git` eine Datei ist oder `--show-toplevel` den alten Ordner meldet, dieses Kopierverfahren nicht verwenden.** Das kann ein verknüpfter Worktree, ein Submodul oder eine besondere Arbeitsbaum-Konfiguration sein; hierfür muss die konkrete Git-Struktur berücksichtigt werden. npm kann unabhängig davon aus dem frischen ZIP-Ordner getestet werden.

Die neue `.gitattributes` enthält bewusst `* -text`: Git verändert keine Zeilenenden beim Hinzufügen oder Auschecken. Das erhält bytegenaue Versiegelungen sowie originale Fremdquellen mit ihren vorhandenen Zeilenenden. Sie repariert keine bereits umgewandelten alten Dateien; deshalb die frische ZIP-Kopie verwenden. Eigene Änderungen an versiegelten Quellen brauchen anschließend den regulären Build und neue passende Prüfbelege.

## 3. npm direkt aus VS Code

Im Terminal des Ordners mit der `package.json` nacheinander ausführen:

```powershell
node --version
npm.cmd --version
npm.cmd publish --dry-run
```

Benötigt wird Node.js **>=24.22.1 und <25**. Der fertige Build ist enthalten: Für diese Veröffentlichung sind vorher weder `npm install`/`npm ci` noch ein Neuaufbau erforderlich. `npm.cmd` ist unter Windows derselbe npm-CLI-Einstieg und vermeidet eine mögliche PowerShell-Sperre von `npm.ps1`, ohne die Ausführungsrichtlinie zu ändern.

Nur wenn der Dry-run erfolgreich ist:

```powershell
npm.cmd whoami
```

Bei fehlender Anmeldung `npm.cmd login` ausführen und den offiziellen Browser-/2FA-Ablauf abschließen. Danach mit dem berechtigten Konto veröffentlichen:

```powershell
npm.cmd publish
```

Alle normalen Publish-Prüfungen bleiben aktiv. Keine Umgehung mit `--ignore-scripts`, keinen erzwungenen Kanalwechsel, kein `audit fix --force` und keine manuelle Neuversiegelung zur Fehlerunterdrückung verwenden. Wenn der Dry-run abbricht, die **erste konkrete Fehlermeldung vor dem abschließenden „npm error code 1“** sichern; keine Tokens oder Schlüssel weitergeben.

Die Kombination `iobroker.eos-admin@8.0.0` darf noch nicht veröffentlicht worden sein. npm erlaubt keine Wiederverwendung bereits veröffentlichter Versionen. Ist 8.0.0 schon belegt, benötigt es einen neuen abgestimmten Versionsstand samt Build und Prüfungen; nur `package.json` zu ändern macht die Versiegelung ungültig.

## Prüfgrenze und Rückfall

Der beigefügte Windows-Prüfvermerk dokumentiert gemessene Pfadlängen, Dateiintegrität, Git-Transport und den npm-Dry-run in der dort genannten Umgebung. Ein nativer Windows-/Explorer-Test und die Anmeldung, Rechte, 2FA sowie tatsächliche Veröffentlichung mit Dominiques npm-Konto wurden hier nicht ausgeführt. Ein erfolgreicher Dry-run ist keine Zusage, dass das Konto oder die Registry den Upload akzeptiert.

Bis Git-Übernahme und Dry-run erfolgreich sind, den alten Ordner behalten. Für einen Rückfall den bisherigen Ordner wieder in VS Code öffnen. Eine Installation auf der Anlage ist ein eigener Schritt mit Sicherung, Lizenzablage und Zielsystemabnahme gemäß `docs/ADMIN8_MIGRATION_8.0.0_DE.md`.

## Offizielle Grundlagen

- Windows-Pfadgrenzen und erforderliche Anwendungsunterstützung: https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation
- Git-Zeilenendensteuerung mit `text`/`-text`: https://git-scm.com/docs/gitattributes
- npm-Publish, Dry-run, Versionsbelegung und Authentifizierung: https://docs.npmjs.com/cli/v11/commands/npm-publish/
