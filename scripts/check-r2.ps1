$ErrorActionPreference='Continue'
# Windows PowerShell maps native stderr to ErrorRecord; every native exit code is checked below.
$root=Split-Path -Parent $PSScriptRoot
$previousWebSearch=$env:CAMPUS_WEB_SEARCH_ENABLED
$env:CAMPUS_WEB_SEARCH_ENABLED='false'
Push-Location $root
try {
 & npm.cmd run build
 if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
 & node scripts/check-adapters.mjs
 if ($LASTEXITCODE -ne 0) { throw 'Adapter test build failed' }
 & node --test tests/ui/model.test.ts tests/ui/r2-model.test.ts tests/ui/navigation.test.ts tests/speech/adapter.test.mjs tests/speech/controller.test.mjs tests/maps/navigation.test.mjs tests/transport/api.test.ts
 if ($LASTEXITCODE -ne 0) { throw 'Frontend isolated regressions failed' }
 & '.\.venv\Scripts\python.exe' -m pytest -p no:langsmith -q
 if ($LASTEXITCODE -ne 0) { throw 'Backend regressions failed' }
} finally { $env:CAMPUS_WEB_SEARCH_ENABLED=$previousWebSearch; Pop-Location }
