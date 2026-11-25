import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {_electron} from 'playwright';
import {studioTestEnvironment} from '../../scripts/studio-session.mjs';
const installation=JSON.parse(await readFile(new URL('./combined-release-installation.json',import.meta.url),'utf8'));
const bytes=await readFile(new URL('./final-installed-qa/shortcuts/shortcut-recording.webm',import.meta.url));
let app;const report={ok:false,sourceCommit:installation.sourceCommit};
try{
 app=await _electron.launch({executablePath:installation.executable,args:[],cwd:installation.directory,env:{...studioTestEnvironment(),LUX_NODE_EXECUTABLE:installation.node},chromiumSandbox:true,timeout:30000});
 report.pid=app.process().pid;await app.firstWindow();
 const opened=app.waitForEvent('window');
 report.webSecurity=await app.evaluate(async({BrowserWindow})=>{
  const decoder=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  await decoder.loadURL('data:text/html,<video muted></video>');
  return decoder.webContents.getLastWebPreferences().webSecurity;
 });
 assert.equal(report.webSecurity,true);
 const page=await opened;
 report.video=await page.evaluate(async encoded=>{
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:'video/webm'}));
  const video=document.querySelector('video');
  const event=name=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`${name} timeout`)),10000);video.addEventListener(name,()=>{clearTimeout(timer);resolve();},{once:true});video.addEventListener('error',()=>{clearTimeout(timer);reject(Error(`video error ${video.error?.message}`));},{once:true});});
  const ready=event('loadeddata');video.src=url;await ready;await video.play();
  await event('timeupdate');const playedAt=video.currentTime;video.pause();
  const target=video.duration*.6;const seek=event('seeked');video.currentTime=target;await seek;
  const result={width:video.videoWidth,height:video.videoHeight,duration:video.duration,playedAt,seekTarget:target,seekedAt:video.currentTime};
  URL.revokeObjectURL(url);return result;
 },bytes.toString('base64'));
 assert.equal(report.video.width,1920);assert.equal(report.video.height,1080);
 assert.ok(Number.isFinite(report.video.duration)&&report.video.duration>0&&report.video.playedAt>0);
 assert.ok(Math.abs(report.video.seekTarget-report.video.seekedAt)<.15);
 report.ok=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}await writeFile(new URL('./final-installed-qa/decoded-clip.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
