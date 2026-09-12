const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const bridge = require(path.resolve(__dirname, '../../../native/build/Release/lux_texture_bridge.node'));
const output = process.env.LUX_GPU_OUTPUT || path.resolve(__dirname, '../../../evidence/tracer-0.1/tr02-probe');
fs.mkdirSync(output, {recursive:true});
const records=[]; const held = new Map(); let count=0, dropped=0;
function record(value) { if(records.length<10000) records.push({time:process.hrtime.bigint().toString(),...value}); else dropped++; }
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('force-device-scale-factor','1');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.setPath('userData',path.join(output,'profile'));
app.whenReady().then(async()=>{
 record({kind:'versions',versions:process.versions,pid:process.pid});
 const win = new BrowserWindow({width:1920,height:1080,frame:false,useContentSize:true,show:false,transparent:true,webPreferences:{offscreen:{useSharedTexture:true},sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.on('console-message',(_e,...args)=>record({kind:'console',args}));
 win.webContents.on('paint',(event)=>{
   if(!event.texture) {record({kind:'failure',reason:'paint without shared texture'});return;}
   const texture=event.texture;
   try {const result=JSON.parse(bridge.submit(texture.textureInfo.handle.ntHandle)); if(result.id) held.set(result.id,texture); else texture.release(); if(count++<10)record({kind:'paint',...result,info:{...texture.textureInfo,handle:'borrowed-local-NT'}});}
   catch(error){record({kind:'failure',reason:String(error)});texture.release();}
 });
 const timer=setInterval(()=>{try{for(const id of JSON.parse(bridge.poll())) {held.get(id).release();held.delete(id);record({kind:'copy-complete',id});}}catch(error){record({kind:'failure',reason:String(error)});}},1);
 win.webContents.setFrameRate(60);
 await win.loadFile(path.join(__dirname,'output.html'));
 record({kind:'gpu',info:await app.getGPUInfo('complete')});
 setTimeout(()=>{clearInterval(timer);record({kind:'summary',paint:count,held:held.size,dropped});fs.writeFileSync(path.join(output,'probe.json'),JSON.stringify(records,null,2));app.exit(0);},15000);
});

