param([ValidateSet('Js','WebService','Security')][string]$Kind)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $Kind){throw 'Specify -Kind Js, WebService or Security according to the AMap console label.'}
$name=@{Js='CAMPUS_AMAP_JS_KEY';WebService='CAMPUS_AMAP_WEB_SERVICE_KEY';Security='CAMPUS_AMAP_SECURITY_KEY'}[$Kind]
$secret=Read-Host "$name (hidden input)" -AsSecureString
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
 $value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
 if($value -notmatch '^[A-Za-z0-9_-]{16,128}$'){throw 'Unexpected key format; no configuration was written.'}
 $path=Join-Path $root '.env'
 $lines=if(Test-Path -LiteralPath $path){[IO.File]::ReadAllLines($path)}else{@()}
 $next=@($lines|Where-Object {$_ -notmatch ('^'+[regex]::Escape($name)+'=')})
 $next+=($name+'='+$value)
 [IO.File]::WriteAllLines($path,$next,[Text.UTF8Encoding]::new($false))
 Write-Output "$name configured: true. Restart only this checkout with scripts/stop.ps1 and scripts/start-app.ps1."
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
 $value=$null
}
