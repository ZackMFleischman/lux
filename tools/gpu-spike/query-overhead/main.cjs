'use strict';
const fs=require('node:fs'),path=require('node:path');
const runId=process.env.LUX_EXPERIMENT_RUN_ID,directory=process.env.LUX_EXPERIMENT_DIRECTORY;
if(process.env.LUX_EXPERIMENT_MODE!=='hardware'||!/^[a-f0-9-]{36}$/.test(runId??'')||!directory||!path.isAbsolute(directory)||path.basename(directory)!==runId||process.env.LUX_EXPERIMENT_TIMEOUT_MS!=='30000')throw Error('Fresh reviewed30-second experiment required');
for(let cursor=path.resolve(directory);;cursor=path.dirname(cursor)){const stat=fs.lstatSync(cursor);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Redirected experiment output');if(cursor===path.dirname(cursor))break;}
const output=path.join(directory,'query-overhead.json');if(fs.existsSync(output))throw Error('Refusing reused evidence');
const {app,BrowserWindow}=require('electron');
app.setPath('userData',path.join(directory,'profile'));
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('force_high_performance_gpu');
let window,finished=false;
function finish(result){if(finished)return;finished=true;
 try{fs.writeFileSync(output,JSON.stringify({runId,versions:process.versions,pid:process.pid,flags:['enable-unsafe-webgpu','force_high_performance_gpu'],...result},null,2),{flag:'wx'});}catch(error){process.stderr.write(String(error));app.exit(2);return;}
 if(window&&!window.isDestroyed())window.destroy();app.exit(result.ok?0:2);
}
app.whenReady().then(async()=>{
 window=new BrowserWindow({show:false,width:64,height:64,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 window.webContents.on('render-process-gone',(_event,details)=>finish({ok:false,errors:['Renderer gone: '+JSON.stringify(details)]}));
 await window.loadFile(path.join(__dirname,'index.html'));
 const result=await window.webContents.executeJavaScript('window.runQueryOverhead()');finish(result);
}).catch(error=>finish({ok:false,errors:[String(error?.stack??error)]}));
