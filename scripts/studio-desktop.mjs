import { readFile, realpath } from 'node:fs/promises';
import { join, resolve, relative, sep, isAbsolute } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { desktopInstallRoot } from './studio-package.mjs';
import { resolveStudioSession, createStudioConnection } from './studio-session.mjs';

const inside=(root,path)=>{const rel=relative(root,path);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);};
export async function readDesktopInstallation({root=desktopInstallRoot(),recordPath=join(root,'installation.json')}={}) {
 const record=JSON.parse(await readFile(recordPath,'utf8'));
 if(record.version!==1||record.profile!=='desktop'||!inside(resolve(root,'builds'),resolve(record.directory)))throw Error('Invalid Lux installation record');
 const expected={executable:join(record.directory,'Lux.exe'),workspace:join(record.directory,'resources','app','runtime'),node:join(record.directory,'resources','app','node.exe'),adapter:join(record.directory,'resources','app','runtime','scripts','studio-installed-mcp.mjs')};
 for(const [key,path] of Object.entries(expected)) {
  if(resolve(record[key])!==resolve(path)||!inside(await realpath(root),await realpath(path)))throw Error(`Invalid installed ${key}`);
 }
 const own=JSON.parse(await readFile(join(record.directory,'installation.json'),'utf8'));
 if(JSON.stringify(own)!==JSON.stringify(record))throw Error('Installation record differs from its build');
 return record;
}
function alive(pid) { if(!Number.isSafeInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';} }
export async function desktopInfo(record,{start=false}={}) {
 const env={...process.env,LUX_STUDIO_PROFILE:record.profile};
 for(const key of ['LUX_STUDIO_SESSION_ID','LUX_STUDIO_MCP_TEST','LUX_STUDIO_SMOKE','ELECTRON_RUN_AS_NODE','LUX_STUDIO_DIST']) delete env[key];
 const session=resolveStudioSession({workspace:record.workspace,env});
 const connect=createStudioConnection(session,{timeoutMs:2000});
 let status;
 try { status=await connect('status'); }
 catch(error) {
  let endpoint;try{endpoint=JSON.parse(await readFile(session.endpointPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(alive(endpoint?.pid))throw Error(`An existing desktop Lux is running but does not match this installation: ${error.message}`);
  if(!start)return {installed:true,running:false,...record};
  const child=spawn(record.executable,[],{cwd:record.directory,env,detached:true,windowsHide:false,stdio:'ignore'});
  await new Promise((yes,no)=>{child.once('spawn',yes);child.once('error',no);});child.unref();
  const deadline=Date.now()+60000;
  while(Date.now()<deadline) {try{status=await connect('status');break;}catch{await setTimeout(250);}}
  if(!status)throw Error('Installed Lux did not become ready within 60 seconds; inspect the desktop app before retrying.');
 }
 return {installed:true,running:true,...record,studioSession:status.studioSession,
  mcp:{command:record.node,args:[record.adapter],cwd:record.workspace,env:{LUX_STUDIO_PROFILE:record.profile,LUX_STUDIO_DESKTOP:'1',LUX_STUDIO_SESSION_ID:status.studioSession.sessionId}}};
}
export async function activateDesktop(recordPath,{root=desktopInstallRoot()}={}) {
 const record=await readDesktopInstallation({root,recordPath});
 const session=resolveStudioSession({workspace:record.workspace,env:{...process.env,LUX_STUDIO_PROFILE:'desktop'}});
 let endpoint;try{endpoint=JSON.parse(await readFile(session.endpointPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(alive(endpoint?.pid)&&endpoint.workspace!==session.workspace)throw Error('Close the previous desktop Lux before activating this build. Its scene has been preserved.');
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(import.meta.dirname,'studio-shortcuts.ps1'),'-Record',recordPath],{windowsHide:true,stdio:'pipe'});
 await readDesktopInstallation({root});
 return {...record,installed:true,shortcuts:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const args=process.argv.slice(2);
 const operation=args.length===2&&args[0]==='--activate'?activateDesktop(args[1]):
  args.length===1&&['--start','--status'].includes(args[0])?readDesktopInstallation().then(record=>desktopInfo(record,{start:args[0]==='--start'})):
  Promise.reject(Error('Usage: node scripts/studio-desktop.mjs --start | --status | --activate <installation.json>'));
 operation.then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
