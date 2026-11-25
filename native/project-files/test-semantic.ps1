param([string]$EvidenceName = 'semantic-gate')
$ErrorActionPreference = 'Stop'
$savedInclude = $env:INCLUDE
$savedLib = $env:LIB
try {
  $compilerRoot = 'C:/Program Files (x86)/Microsoft Visual Studio/18/BuildTools/VC/Tools/MSVC/14.50.35717'
  $sdkRoot = 'C:/Program Files (x86)/Windows Kits/10'
  $compiler = Join-Path $compilerRoot 'bin/Hostx64/x64/cl.exe'
  $env:INCLUDE = "$compilerRoot/include;$sdkRoot/Include/10.0.26100.0/ucrt;$sdkRoot/Include/10.0.26100.0/shared;$sdkRoot/Include/10.0.26100.0/um"
  $env:LIB = "$compilerRoot/lib/x64;$sdkRoot/Lib/10.0.26100.0/ucrt/x64;$sdkRoot/Lib/10.0.26100.0/um/x64"
  $repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
  $output = Join-Path $repo 'native/build/project-files'
  $evidence = Join-Path $repo '.superpowers/sdd/filesystem-projects-plan'
  New-Item -ItemType Directory -Force -Path $output | Out-Null
  $fixture = Join-Path $output ('fixture-' + [Guid]::NewGuid().ToString())
  "compiler=$compiler`ncompilerVersion=$((Get-Item -LiteralPath $compiler).VersionInfo.FileVersion)`nsdk=10.0.26100.0`nfixture=$fixture`nexecutor=$env:USERNAME`nOS=$([Environment]::OSVersion.VersionString)" | Set-Content -LiteralPath "$evidence/$EvidenceName-setup.log"
  & $compiler /nologo /std:c++20 /EHsc /W4 /WX /O2 /MT /DNOMINMAX /DWIN32_LEAN_AND_MEAN /UNDEBUG "/Fo$output/semantic_gate.obj" "/Fe$output/semantic_gate.exe" "$PSScriptRoot/semantic_gate.cc" 2>&1 | Tee-Object -FilePath "$evidence/$EvidenceName-build.log"
  if ($LASTEXITCODE -ne 0) { throw 'Semantic harness compilation failed' }
  $process = Start-Process -FilePath "$output/semantic_gate.exe" -ArgumentList ('"' + $fixture + '"') -PassThru -WindowStyle Hidden -RedirectStandardOutput "$evidence/$EvidenceName.out.log" -RedirectStandardError "$evidence/$EvidenceName.err.log"
  $null = $process.Handle
  if (!$process.WaitForExit(45000)) {
    Stop-Process -Id $process.Id -Force
    $process.WaitForExit(5000) | Out-Null
    throw 'Semantic harness exceeded 45 second bound'
  }
  $process.Refresh()
  Get-Content -LiteralPath "$evidence/$EvidenceName.out.log"
  Get-Content -LiteralPath "$evidence/$EvidenceName.err.log"
  "exitCode=$($process.ExitCode)" | Add-Content -LiteralPath "$evidence/$EvidenceName-setup.log"
  if ($process.ExitCode -ne 0) { throw 'Semantic gate failed; inspect evidence before expanding implementation' }
} finally {
  $env:INCLUDE = $savedInclude
  $env:LIB = $savedLib
}
