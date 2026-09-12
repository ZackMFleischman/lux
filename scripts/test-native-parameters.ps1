param([string]$VsWhere = "${env:ProgramFiles(x86)}/Microsoft Visual Studio/Installer/vswhere.exe")
$ErrorActionPreference = 'Stop'
$savedInclude = $env:INCLUDE
$savedLib = $env:LIB
try {
  $installation = & $VsWhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if (!$installation) { throw 'Visual Studio x64 C++ tools are unavailable' }
  $compilerRoot = Join-Path $installation 'VC/Tools/MSVC/14.50.35717'
  $sdkRoot = "${env:ProgramFiles(x86)}/Windows Kits/10"
  $compiler = Join-Path $compilerRoot 'bin/Hostx64/x64/cl.exe'
  if (!(Test-Path -LiteralPath $compiler)) { throw 'Requires pinned MSVC 14.50.35717' }
  $env:INCLUDE = "$compilerRoot/include;$sdkRoot/Include/10.0.26100.0/ucrt;$sdkRoot/Include/10.0.26100.0/shared;$sdkRoot/Include/10.0.26100.0/um"
  $env:LIB = "$compilerRoot/lib/x64;$sdkRoot/Lib/10.0.26100.0/ucrt/x64;$sdkRoot/Lib/10.0.26100.0/um/x64"
  $repo = Split-Path $PSScriptRoot -Parent
  $output = Join-Path $repo 'native/build/parameters'
  New-Item -ItemType Directory -Force -Path $output | Out-Null
  foreach ($testName in @('host_control_test', 'shared_ring_test', 'host_control_v4_test')) {
    # The legacy ring deliberately pads aligned cache-line structures (C4324).
    & $compiler /nologo /std:c++20 /EHsc /W4 /WX /wd4324 /O2 /MT /DNOMINMAX /DWIN32_LEAN_AND_MEAN /UNDEBUG "/I$repo/native/texture-bridge/include" "/Fo$output/$testName.obj" "/Fe$output/$testName.exe" "$repo/tests/native/$testName.cc"
    if ($LASTEXITCODE -ne 0) { throw "$testName compilation failed" }
    $testProcess = Start-Process -FilePath "$output/$testName.exe" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$output/$testName.out" -RedirectStandardError "$output/$testName.err"
    # Retain the handle so Windows PowerShell can read even a fast exit code.
    $null = $testProcess.Handle
    if (!$testProcess.WaitForExit(30000)) {
      Stop-Process -Id $testProcess.Id -Force
      throw "$testName exceeded the 30-second CPU test limit"
    }
    $testProcess.Refresh()
    Get-Content -LiteralPath "$output/$testName.out"
    Get-Content -LiteralPath "$output/$testName.err"
    if ($testProcess.ExitCode -ne 0) { throw "$testName failed" }
  }
} finally {
  $env:INCLUDE = $savedInclude
  $env:LIB = $savedLib
}
