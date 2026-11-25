import {spawn} from 'node:child_process';
import {openSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {installedElectron} from './studio-electron.mjs';
import {studioTestEnvironment,resolveStudioSession,createStudioConnection} from './studio-session.mjs';
const root=resolve(import.meta.dirname,'..');
const env=studioTestEnvironment({...process.env,LUX_WORKSPACE:root,LUX_NODE_EXECUTABLE:process.execPath});delete env.ELECTRON_RUN_AS_NODE;delete env.LUX_STUDIO_SMOKE;delete env.LUX_STUDIO_MCP_TEST;
const log=openSync(resolve(root,'artifacts/birds/studio.log'),'a');
const child=spawn(installedElectron(root),[resolve(root,'apps/studio/dist/main.cjs')],{cwd:root,env,detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();
const connect=createStudioConnection(resolveStudioSession({workspace:root,env}));let status;
for(let i=0;i<50;i++){try{status=await connect('status');break;}catch{await new Promise(r=>setTimeout(r,500));}}
if(!status)throw Error('No preview connection');
const receipt={profile:env.LUX_STUDIO_PROFILE,sessionId:status.studioSession.sessionId,pid:child.pid,workspace:root};writeFileSync(resolve(root,'artifacts/birds/preview-session.json'),JSON.stringify(receipt));console.log(JSON.stringify(receipt));

