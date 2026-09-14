param([int]$Port=8000,[string]$EnvFile='')
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($EnvFile) { $env:AI4TJU_ENV_FILE=(Resolve-Path -LiteralPath $EnvFile).Path }
$env:LANGSMITH_TRACING='false'
$env:LANGCHAIN_TRACING_V2='false'
& '.\.venv\Scripts\python.exe' -m uvicorn backend.app:app --host 127.0.0.1 --port $Port --no-access-log
exit $LASTEXITCODE
