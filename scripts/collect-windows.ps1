$ErrorActionPreference = 'Stop'
$os = Get-CimInstance Win32_OperatingSystem
$cpu = @(Get-CimInstance Win32_Processor | Select-Object Name, Architecture, NumberOfCores, NumberOfLogicalProcessors)
$gpus = @(Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, PNPDeviceID)
$hostFile = $env:LUX_PREFLIGHT_HOST
if (!$hostFile) { $hostFile = 'C:/Program Files/Resolume Avenue/Avenue.exe' }
$hostVersion = $null
if (Test-Path -LiteralPath $hostFile) { $hostVersion = (Get-Item -LiteralPath $hostFile).VersionInfo.FileVersion }
$vswhere = "${env:ProgramFiles(x86)}/Microsoft Visual Studio/Installer/vswhere.exe"
$vs = $null
$compiler = $null
$cmakeVersion = $null
if (Test-Path -LiteralPath $vswhere) {
  $instances = @((& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json | ConvertFrom-Json))
  if ($instances.Count -gt 0) {
    $vs = $instances[0]
    $cl = Join-Path $vs.installationPath 'VC/Tools/MSVC/14.50.35717/bin/Hostx64/x64/cl.exe'
    if (Test-Path -LiteralPath $cl) { $compiler = @{ path = $cl; version = (Get-Item -LiteralPath $cl).VersionInfo.FileVersion } }
    $cmake = Join-Path $vs.installationPath 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
    if (Test-Path -LiteralPath $cmake) { $cmakeVersion = (& $cmake --version | Select-Object -First 1) }
  }
}
$sdk = "${env:ProgramFiles(x86)}/Windows Kits/10/Include/10.0.26100.0/um/Windows.h"
@{
  os = @{ caption = $os.Caption; version = $os.Version; build = $os.BuildNumber; architecture = $os.OSArchitecture }
  cpu = $cpu; gpus = $gpus
  host = @{ executable = $hostFile; version = $hostVersion }
  toolchain = @{ visualStudio = $vs.installationVersion; installation = $vs.installationPath; compiler = $compiler; cmake = $cmakeVersion; windowsSdk = $(if (Test-Path -LiteralPath $sdk) { '10.0.26100.0' } else { $null }) }
} | ConvertTo-Json -Depth 8
