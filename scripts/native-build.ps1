param([string]$VsWhere = "${env:ProgramFiles(x86)}/Microsoft Visual Studio/Installer/vswhere.exe")
$ErrorActionPreference = 'Stop'
try {
  if (!(Test-Path -LiteralPath $VsWhere)) { throw 'TR-01 prerequisite missing: Visual Studio Installer vswhere.exe and x64 C++ workload' }
  $install = & $VsWhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if (!$install) { throw 'TR-01 prerequisite missing: Visual Studio x64 C++ workload' }
  $cmake = Join-Path $install 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
  if (!(Test-Path -LiteralPath $cmake)) { throw 'TR-01 prerequisite missing: Visual Studio CMake component' }
  $repo = Split-Path $PSScriptRoot -Parent
  & $cmake -S "$repo/native" -B "$repo/native/build" -G 'Visual Studio 18 2026' -A x64 -T 'v145,version=14.50.35717' '-DCMAKE_SYSTEM_VERSION=10.0.26100.0'
  if ($LASTEXITCODE -ne 0) { throw 'TR-01 CMake configuration failed; requires MSVC 14.50.35717 and Windows SDK 10.0.26100.0' }
  & $cmake --build "$repo/native/build" --config Release
  if ($LASTEXITCODE -ne 0) { throw 'TR-01 native build failed' }
  $ctest = Join-Path (Split-Path $cmake -Parent) 'ctest.exe'
  & $ctest --test-dir "$repo/native/build" -C Release --output-on-failure
  if ($LASTEXITCODE -ne 0) { throw 'TR-01 native clock smoke failed' }
  & "$repo/native/build/Release/lux_native_smoke.exe"
  exit $LASTEXITCODE
} catch { Write-Error $_ -ErrorAction Continue; exit 1 }
