$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Set-Location $root
$base=(& git rev-parse refs/tags/m0-bootstrap).Trim()
if ($LASTEXITCODE -ne 0 -or $base -notmatch '^[0-9a-f]{40}$') { throw 'Missing immutable bootstrap tag' }
$launch=(& git rev-parse HEAD).Trim()
$spec=@(
 @{window='A';name='ui';branch='work/ui';web_port=5174;api_port=8001},
 @{window='B';name='avatar';branch='work/avatar';web_port=5175;api_port=8002},
 @{window='C';name='api';branch='work/api';web_port=5176;api_port=8003},
 @{window='D';name='knowledge';branch='work/knowledge';web_port=5177;api_port=8004}
)
[IO.Directory]::CreateDirectory((Join-Path $root '.runtime')) | Out-Null
[IO.File]::WriteAllText((Join-Path $root '.runtime\BASE_COMMIT'),$base)
$jobs=@()
foreach ($item in $spec) {
 $path=Join-Path $root ('.worktrees\'+$item.name)
 if (Test-Path -LiteralPath $path) {
  $top=(& git -C $path rev-parse --show-toplevel).Trim().Replace('/','\')
  $branch=(& git -C $path branch --show-current).Trim()
  $head=(& git -C $path rev-parse HEAD).Trim()
  if ($top -ne $path -or $branch -ne $item.branch -or ($head -ne $base -and $head -ne $launch)) { throw "Existing worktree does not match baseline: $path" }
  if (& git -C $path status --porcelain) { throw "Existing worktree has changes: $path" }
 } else {
  & git show-ref --verify --quiet ('refs/heads/'+$item.branch)
  if ($LASTEXITCODE -eq 0) {
   $head=(& git rev-parse $item.branch).Trim()
   if ($head -ne $base) { throw "Existing branch differs from bootstrap: $($item.branch)" }
   & git worktree add $path $item.branch
  } else {
   & git worktree add -b $item.branch $path $base
  }
  if ($LASTEXITCODE -ne 0) { throw 'Worktree creation failed' }
 }
 $runtime=Join-Path $path '.runtime'
 [IO.Directory]::CreateDirectory($runtime) | Out-Null
 [IO.File]::WriteAllText((Join-Path $runtime 'BASE_COMMIT'),$base)
 & (Join-Path $path 'scripts\Copy-LocalAssets.ps1')
 $process=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-File',(Join-Path $path 'scripts\Install.ps1')) -WorkingDirectory $path -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'install.stdout.log') -RedirectStandardError (Join-Path $runtime 'install.stderr.log')
 $jobs+=@{spec=$item;path=$path;process=$process}
}
$result=@()
foreach ($job in $jobs) {
 $job.process.WaitForExit()
 $job.process.Refresh()
 $receipt=Get-Content -LiteralPath (Join-Path $job.path '.runtime\install-result.json') -Raw | ConvertFrom-Json
 $code=$receipt.exit_code
 $result += [pscustomobject]@{window=$job.spec.window;path=$job.path;branch=$job.spec.branch;base_commit=$base;launch_commit=$launch;web_port=$job.spec.web_port;api_port=$job.spec.api_port;install_exit_code=$code;env_copied=(Test-Path -LiteralPath (Join-Path $job.path '.env'));node_modules=(Test-Path -LiteralPath (Join-Path $job.path 'node_modules'));venv=(Test-Path -LiteralPath (Join-Path $job.path '.venv'))}
}
[pscustomobject]@{base_commit=$base;coord_commit=$launch;integration_branch='integration/m0';worktrees=$result} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $root '.runtime\parallel-state.json') -Encoding UTF8
$result | Format-Table window,branch,install_exit_code,node_modules,venv,env_copied -AutoSize
if ($result | Where-Object { $_.install_exit_code -ne 0 -or $_.env_copied -or -not $_.node_modules -or -not $_.venv }) { throw 'Worktree setup incomplete; inspect per-tree install logs' }
