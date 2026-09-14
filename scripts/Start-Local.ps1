# Starts only this worktree's two processes; records PIDs, never kills another process.
param([int]$WebPort=5173,[int]$ApiPort=8000)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
foreach ($port in @($WebPort,$ApiPort)) {
 if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port occupied; choose an allocated free port" }
}
$logs=Join-Path $root '.runtime\logs'
[IO.Directory]::CreateDirectory($logs) | Out-Null
$env:AI4TJU_WEB_PORT=[string]$WebPort
$env:AI4TJU_API_PORT=[string]$ApiPort
$env:LANGSMITH_TRACING='false'
$env:LANGCHAIN_TRACING_V2='false'
$api=Start-Process -FilePath (Join-Path $root '.venv\Scripts\python.exe') -ArgumentList @('-m','uvicorn','backend.app:app','--host','127.0.0.1','--port',[string]$ApiPort,'--no-access-log') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'api.stdout.log') -RedirectStandardError (Join-Path $logs 'api.stderr.log')
$web=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'web.stdout.log') -RedirectStandardError (Join-Path $logs 'web.stderr.log')
[pscustomobject]@{root=$root;api_pid=$api.Id;web_pid=$web.Id;api_port=$ApiPort;web_port=$WebPort} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root '.runtime\processes.json') -Encoding UTF8
Write-Host "Started API PID $($api.Id), web PID $($web.Id). Check health before reporting online."
