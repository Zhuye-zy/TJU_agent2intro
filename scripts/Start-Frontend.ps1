param([int]$Port=5173,[int]$ApiPort=8000)
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$env:AI4TJU_WEB_PORT=[string]$Port
$env:AI4TJU_API_PORT=[string]$ApiPort
& npm.cmd run dev
exit $LASTEXITCODE
