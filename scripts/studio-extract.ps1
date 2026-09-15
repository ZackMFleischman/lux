param([Parameter(Mandatory=$true)][string]$Archive,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
if ((Get-ChildItem -LiteralPath $Destination -Force | Measure-Object).Count -ne 0) { throw 'The package destination must be empty' }
Expand-Archive -LiteralPath $Archive -DestinationPath $Destination
