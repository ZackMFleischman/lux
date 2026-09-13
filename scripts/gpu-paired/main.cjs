const {app,BrowserWindow}=require('electron');const path=require('node:path');
app.commandLine.appendSwitch('enable-unsafe-webgpu');app.commandLine.appendSwitch('force_high_performance_gpu');
app.setPath('userData',path.join(process.env.LUX_PAIRED_OUT,'electron-profile'));
setTimeout(()=>app.exit(2),120000).unref();
app.whenReady().then(()=>{const window=new BrowserWindow({width:960,height:540,show:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});window.loadFile(path.join(process.env.LUX_PAIRED_OUT,'index.html'));});
app.on('window-all-closed',()=>app.quit());
