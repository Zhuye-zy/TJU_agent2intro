# M-only; existing branches fast-forward only. No deletion, reset, stash or secret copying.
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
Set-Location $root
if ((& git rev-parse --show-toplevel).Trim().Replace('/','\') -ne $root) { throw 'Unexpected Git boundary' }
$base=(& git rev-parse refs/tags/r2-baseline).Trim()
$launch=(& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $base -notmatch '^[0-9a-f]{40}$') { throw 'Missing immutable r2-baseline tag' }
$spec=@(
 @{window='A';name='ui';branch='work/ui';web_port=5174;api_port=8001},
 @{window='B';name='avatar';branch='work/avatar';web_port=5175;api_port=8002},
 @{window='C';name='api';branch='work/api';web_port=5176;api_port=8003},
 @{window='D';name='knowledge';branch='work/knowledge';web_port=5177;api_port=8004}
)
# Validate ALL trees before the first mutation.
foreach($item in $spec){
 $path=[IO.Path]::GetFullPath((Join-Path $root ('.worktrees\'+$item.name)))
 if(-not $path.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Outside workspace'}
 if(-not(Test-Path -LiteralPath $path)){throw "Expected original worktree missing: $path"}
 if((& git -C $path rev-parse --show-toplevel).Trim().Replace('/','\') -ne $path){throw 'Unexpected tree boundary'}
 if((& git -C $path branch --show-current).Trim() -ne $item.branch){throw 'Unexpected branch'}
 if(& git -C $path status --porcelain){throw "Uncommitted changes: $path"}
 & git -C $path merge-base --is-ancestor HEAD $launch
 if($LASTEXITCODE -ne 0){throw "Cannot fast-forward $path"}
 foreach($name in @('node_modules','.venv','.tools','.runtime')){
  $dir=Join-Path $path $name
  if((Test-Path $dir) -and ((Get-Item -LiteralPath $dir).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw "Shared writable link: $dir"}
 }
 if(Test-Path -LiteralPath (Join-Path $path '.env')){throw "Unexpected worktree .env; preserve and notify M: $path"}
}
$result=@()
foreach($item in $spec){
 $path=Join-Path $root ('.worktrees\'+$item.name)
 & git -C $path merge --ff-only --quiet $launch
 if($LASTEXITCODE -ne 0){throw 'Fast-forward failed'}
 $runtime=Join-Path $path '.runtime'
 [IO.Directory]::CreateDirectory($runtime)|Out-Null
 [IO.File]::WriteAllText((Join-Path $runtime 'BASE_COMMIT_R2'),$base)
 $installer=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-File',(Join-Path $path 'scripts\Install.ps1')) -WorkingDirectory $path -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'r2-install.stdout.log') -RedirectStandardError (Join-Path $runtime 'r2-install.stderr.log')
 $installer.WaitForExit()
 if(-not(Test-Path -LiteralPath (Join-Path $runtime 'install-result.json'))){throw 'Missing install receipt'}
 $install=Get-Content -Raw -LiteralPath (Join-Path $runtime 'install-result.json')|ConvertFrom-Json
 if($install.exit_code -ne 0){throw "Install failed: $path"}
 & (Join-Path $path 'scripts\Copy-LocalAssets.ps1') -Source (Join-Path $root '.runtime\asset-source')
 Push-Location $path
 try {
  & node.exe (Join-Path $path 'node_modules\typescript\bin\tsc') --noEmit *> (Join-Path $runtime 'r2-typecheck.log')
  if($LASTEXITCODE -ne 0){throw "Type check failed: $path"}
  & '.\.venv\Scripts\python.exe' -c 'from backend.app import app; from backend.r2_contracts import R2ChatRequest; print(app.version)' *> (Join-Path $runtime 'r2-import.log')
  if($LASTEXITCODE -ne 0){throw "Import failed: $path"}
 } finally {Pop-Location}
 $result+=[pscustomobject]@{window=$item.window;path=$path;branch=$item.branch;base_commit=$base;launch_commit=$launch;web_port=$item.web_port;api_port=$item.api_port;install_exit_code=0;typecheck_exit_code=0;import_exit_code=0;env_copied=$false}
}
$state=Join-Path $root '.runtime\R2'
[IO.Directory]::CreateDirectory($state)|Out-Null
[pscustomobject]@{base_commit=$base;coord_commit=$launch;integration_branch='integration/m0';worktrees=$result}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $state 'parallel-state.json') -Encoding UTF8
$result|Format-Table window,branch,install_exit_code,typecheck_exit_code,import_exit_code,env_copied
