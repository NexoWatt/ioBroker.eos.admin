[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
# Optional verification only; the normal release command performs the same preparation.
& npm.cmd publish --dry-run
if ($LASTEXITCODE -ne 0) {
    throw "Die Kopier-/Publish-Prüfung ist mit Exit-Code $LASTEXITCODE fehlgeschlagen. Siehe erste Fehlermeldung oben."
}
Write-Host 'Kopier-/Publish-Prüfung erfolgreich. Es wurde nichts veröffentlicht.'
