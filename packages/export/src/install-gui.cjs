'use strict';
// Native dialogs only. This helper never creates a BrowserWindow, loads the
// texture bridge or starts an installed rendering producer.
const {app,dialog} = require('electron');
const path = require('node:path');
const {validatePackage,installPackage} = require('./package.cjs');
const {registerSource} = require('./register.cjs');
const {assertRuntimeCapabilities} = require('./runtime-capability.cjs');
const {runInstallFlow,queryResolumeProcesses} = require('./install-flow.cjs');
app.setName('Lux Source Installer');
app.disableHardwareAcceleration(); app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  try {
    const result = await runInstallFlow({
      packageDirectory:process.argv[2] && path.resolve(process.argv[2]),localAppData:process.env.LOCALAPPDATA,
      ports:{
        validate:directory => { const result = validatePackage(directory); assertRuntimeCapabilities(path.join(directory,'runtime')); return result; },
        welcome:async ({name}) => (await dialog.showMessageBox({type:'info',title:'Install Lux source',
          message:'Install “' + name + '” for Resolume?',detail:'Close Resolume before continuing. You will choose its configured Extra Effects folder. The source includes its own playback runtime.',
          buttons:['Continue','Cancel'],defaultId:0,cancelId:1,noLink:true})).response === 0,
        chooseFolder:async () => {
          const choice = await dialog.showOpenDialog({title:'Choose Resolume’s Extra Effects folder',buttonLabel:'Use this folder',properties:['openDirectory','dontAddToRecent']});
          return choice.canceled ? null : choice.filePaths[0];
        },
        confirm:async ({name,installRoot,pluginDirectory}) => (await dialog.showMessageBox({type:'question',title:'Install Lux source',
          message:'Install “' + name + '”?',detail:'Source folder:\n' + pluginDirectory + '\n\nPlayback runtime:\n' + installRoot,
          buttons:['Install','Cancel'],defaultId:0,cancelId:1,noLink:true})).response === 0,
        queryHosts:queryResolumeProcesses,install:installPackage,register:registerSource,
      },
    });
    if (!result.cancelled) await dialog.showMessageBox({type:'info',title:'Lux source installed',message:'“' + result.name + '” is installed.',
      detail:'Open Resolume and find “' + result.registration.displayName + '” in Sources. Lux Studio can stay closed.',buttons:['Done']});
    app.exit(0);
  } catch (error) {
    dialog.showErrorBox('Lux source installation failed',String(error.message || error)); app.exit(1);
  }
}).catch(error => {dialog.showErrorBox('Lux installer could not start',String(error.message || error));app.exit(1);});
