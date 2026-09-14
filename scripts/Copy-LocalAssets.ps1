param([string]$Source='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if (-not $Source) { $Source=Join-Path $root '.runtime/asset-source' }
$sourcePath=(Resolve-Path -LiteralPath $Source).Path
$manifest=Get-Content -LiteralPath (Join-Path $root 'frontend/src/avatar/assets.manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceModels=[IO.Path]::GetFullPath((Join-Path $sourcePath 'kelaita'))
$targetModels=[IO.Path]::GetFullPath((Join-Path $root 'frontend/public/assets/kelaita'))
function Copy-Verified([string]$From,[string]$To,[string]$ExpectedHash) {
 if (-not (Test-Path -LiteralPath $From -PathType Leaf)) { throw "Missing asset: $From" }
 if ((Get-FileHash -LiteralPath $From -Algorithm SHA256).Hash -ne $ExpectedHash) { throw "Source hash mismatch: $From" }
 if (Test-Path -LiteralPath $To) {
  if ((Get-FileHash -LiteralPath $To -Algorithm SHA256).Hash -ne $ExpectedHash) { throw "Existing asset differs; retained without overwrite: $To" }
  return
 }
 [IO.Directory]::CreateDirectory((Split-Path -Parent $To)) | Out-Null
 Copy-Item -LiteralPath $From -Destination $To
}
foreach ($item in $manifest.files) {
 $from=[IO.Path]::GetFullPath((Join-Path $sourceModels $item.path))
 $to=[IO.Path]::GetFullPath((Join-Path $targetModels $item.path))
 if (-not $from.StartsWith($sourceModels+'\',[StringComparison]::OrdinalIgnoreCase) -or -not $to.StartsWith($targetModels+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Asset manifest path escapes expected directory' }
 Copy-Verified $from $to $item.sha256
}
$core=$manifest.runtime_dependencies | Where-Object path -eq '/vendor/live2dcubismcore.min.js'
Copy-Verified (Join-Path $sourcePath 'live2dcubismcore.min.js') (Join-Path $root 'frontend/public/vendor/live2dcubismcore.min.js') $core.sha256
Write-Host 'Selected assets and Core verified; existing matching files retained. No source program executed.'
