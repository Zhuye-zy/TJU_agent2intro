param([string]$Python='D:\Program Files\Python311\python.exe')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Set-Location $root
$resultPath=Join-Path $root '.runtime\install-result.json'
[IO.Directory]::CreateDirectory((Split-Path -Parent $resultPath)) | Out-Null
[IO.File]::WriteAllText($resultPath,'{"status":"running","exit_code":null}')
try {
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
 [IO.File]::WriteAllText($resultPath,'{"status":"completed","exit_code":0}')
} catch {
 [IO.File]::WriteAllText($resultPath,'{"status":"failed","exit_code":1}')
 throw
}
