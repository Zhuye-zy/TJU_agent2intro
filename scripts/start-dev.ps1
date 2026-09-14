param([int]$WebPort=5173,[int]$ApiPort=8000,[string]$EnvFile='')
& (Join-Path $PSScriptRoot 'Start-Managed.ps1') -Mode dev -WebPort $WebPort -ApiPort $ApiPort -EnvFile $EnvFile
