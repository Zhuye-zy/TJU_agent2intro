# Compatibility entry point; use the same managed processes as start-dev.ps1.
param([int]$WebPort=5173,[int]$ApiPort=8000,[string]$EnvFile='')
& (Join-Path $PSScriptRoot 'start-dev.ps1') -WebPort $WebPort -ApiPort $ApiPort -EnvFile $EnvFile
