param([string]$Python='D:\Program Files\Python311\python.exe',[string]$AssetSource='')
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'Install.ps1') -Python $Python
if ($AssetSource) { & (Join-Path $PSScriptRoot 'Copy-LocalAssets.ps1') -Source $AssetSource }
else { & (Join-Path $PSScriptRoot 'Copy-LocalAssets.ps1') }
Write-Host 'Setup complete. Existing .env retained; use Configure-Local.ps1 only if a model key is missing.'
