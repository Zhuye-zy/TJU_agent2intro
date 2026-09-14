param([int]$Port=8000,[string]$EnvFile='',[switch]$Build)
$ErrorActionPreference='Stop'
if ($Build) {
 Push-Location (Split-Path -Parent $PSScriptRoot)
 try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build failed' } } finally { Pop-Location }
}
& (Join-Path $PSScriptRoot 'Start-Managed.ps1') -Mode app -ApiPort $Port -EnvFile $EnvFile
