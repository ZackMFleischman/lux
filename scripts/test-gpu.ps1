param([string]$ReviewFile)
$ErrorActionPreference = 'Stop'
try {
  if (!$ReviewFile) { throw 'ReviewFile is required. First prepare an offline request with node scripts/prepare-gpu-review.mjs <request.json>, then obtain review/authorization. No hardware was launched.' }
  if (!(Test-Path -LiteralPath $ReviewFile -PathType Leaf)) { throw "ReviewFile does not exist: $ReviewFile" }
  & node (Join-Path $PSScriptRoot 'experiment-runner.mjs') hardware (Resolve-Path -LiteralPath $ReviewFile).Path 20000
  exit $LASTEXITCODE
} catch { Write-Error $_ -ErrorAction Continue; exit 1 }
