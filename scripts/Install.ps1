param([string]$Python='D:\Program Files\Python311\python.exe')
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path -LiteralPath '.tools\Scripts\uv.exe')) {
 & $Python -m venv .tools
 if ($LASTEXITCODE -ne 0) { throw 'venv failed' }
 & '.\.tools\Scripts\python.exe' -m pip install uv==0.12.13
 if ($LASTEXITCODE -ne 0) { throw 'uv install failed' }
}
& '.\.tools\Scripts\uv.exe' sync --frozen --link-mode copy --python $Python
if ($LASTEXITCODE -ne 0) { throw 'uv sync failed' }
& npm.cmd ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
& (Join-Path $PSScriptRoot 'Prepare-SpeechAssets.ps1')
