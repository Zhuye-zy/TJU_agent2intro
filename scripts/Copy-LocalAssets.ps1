param([string]$Source='E:\AI4TJU\.runtime\asset-source')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$sourcePath=(Resolve-Path -LiteralPath $Source).Path
$dest=Join-Path $root 'frontend\public\assets\kelaita'
if (-not (Test-Path -LiteralPath (Join-Path $sourcePath 'kelaita\runtime\kelaita.model3.json'))) { throw 'Missing kelaita source' }
if (Test-Path -LiteralPath $dest) { Write-Host 'Existing assets retained; inspect before replacing.'; exit 0 }
[IO.Directory]::CreateDirectory((Split-Path -Parent $dest)) | Out-Null
Copy-Item -LiteralPath (Join-Path $sourcePath 'kelaita') -Destination $dest -Recurse
$vendor=Join-Path $root 'frontend\public\vendor'
[IO.Directory]::CreateDirectory($vendor) | Out-Null
Copy-Item -LiteralPath (Join-Path $sourcePath 'live2dcubismcore.min.js') -Destination (Join-Path $vendor 'live2dcubismcore.min.js')
Write-Host 'Selected assets copied; no symlink or source program execution.'
