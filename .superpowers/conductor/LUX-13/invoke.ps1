param([string]$Operation,[string[]]$Arguments)
$ErrorActionPreference='Stop'
$env:GIT_CONFIG_COUNT='1'
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='C:/Users/zFlei/repos/lux/.worktrees/input-mapping'
$taskArgs=@($Arguments)+@('--request',"lux-input-mapping-01a09967-$Operation",'--json')
$taskArgs | ConvertTo-Json | Set-Content ".superpowers/conductor/LUX-13/$Operation-request.json"
$result=& 'C:/Users/zFlei/AppData/Local/Conductor/bin/conductor.exe' --home 'C:/Users/zFlei/AppData/Local/Conductor' @taskArgs
$taskExit=$LASTEXITCODE
$result | Set-Content ".superpowers/conductor/LUX-13/$Operation-result.json"
$result
if($taskExit -ne 0){throw "Conductor failed: $taskExit"}
