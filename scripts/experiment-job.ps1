param([Parameter(Mandatory=$true)][string]$Config)
$ErrorActionPreference = 'Stop'
$spec = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
Add-Type -Path (Join-Path $PSScriptRoot 'experiment-job.cs')
[ExperimentJob]::Run($spec.executable, $spec.commandLine, $spec.cwd, $spec.directory, $spec.timeoutMs, [UInt64]$spec.memoryLimitBytes)
