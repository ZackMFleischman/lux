param([Parameter(Mandatory=$true)][string]$Record,
    [string]$DesktopFolder = [Environment]::GetFolderPath('Desktop'),
    [string]$ProgramsFolder = [Environment]::GetFolderPath('Programs'))
$ErrorActionPreference = 'Stop'
$installation = Get-Content -LiteralPath $Record -Raw | ConvertFrom-Json
$root = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\Lux'))
$target = [IO.Path]::GetFullPath($installation.executable)
if (-not $target.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Shortcut target must be inside the Lux installation' }
$icon = Join-Path $installation.workspace 'apps\studio\assets\branding\lux.ico'
if (-not (Test-Path -LiteralPath $icon -PathType Leaf)) { throw 'Lux icon is missing' }
$shell = New-Object -ComObject WScript.Shell
$changes = @()
# Preflight both destinations before changing either shortcut.
foreach ($folder in @($DesktopFolder, $ProgramsFolder)) {
    $linkPath = Join-Path $folder 'Lux.lnk'
    $shortcut = $shell.CreateShortcut($linkPath)
    $exists = Test-Path -LiteralPath $linkPath
    if ($exists -and (-not $shortcut.TargetPath -or -not $shortcut.TargetPath.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase))) { throw "An unrelated shortcut already exists: $linkPath" }
    $previous = if ($exists) { [IO.File]::ReadAllBytes($linkPath) } else { $null }
    $changes += @{ Path=$linkPath; Shortcut=$shortcut; Previous=$previous; Existed=$exists }
}
$receipt = Join-Path $root 'installation.json'
$tempReceipt = Join-Path $root ('installation-' + [guid]::NewGuid().ToString() + '.tmp')
try {
    foreach ($change in $changes) {
        $shortcut = $change.Shortcut
        $shortcut.TargetPath = $target
        $shortcut.WorkingDirectory = $installation.directory
        $shortcut.Description = 'Lux - create live visuals'
        $shortcut.IconLocation = "$icon,0"
        $shortcut.Save()
    }
    Copy-Item -LiteralPath $Record -Destination $tempReceipt
    Move-Item -LiteralPath $tempReceipt -Destination $receipt -Force
} catch {
    foreach ($change in $changes) {
        if ($change.Existed) { [IO.File]::WriteAllBytes($change.Path, $change.Previous) }
        elseif (Test-Path -LiteralPath $change.Path) { Remove-Item -LiteralPath $change.Path }
    }
    throw
} finally {
    if (Test-Path -LiteralPath $tempReceipt) { Remove-Item -LiteralPath $tempReceipt }
}
