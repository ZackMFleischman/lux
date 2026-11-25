import {readFile,writeFile} from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const install=JSON.parse(await readFile(process.env.LOCALAPPDATA+'/Programs/Lux/installation.json','utf8'));
const root='../hummingbird-art',dir=root+'/artifacts/hummingbirds';
const c=new Client({name:'bird-polish',version:'1'});const json=r=>JSON.parse(r.content.find(x=>x.type==='text').text);const call=async(name,args={})=>{const r=await c.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:75000});if(r.isError)throw Error(JSON.stringify(r.content));return r};const read=async()=>json(await call('read'));
try{await c.connect(new StdioClientTransport({command:install.node,args:[install.adapter],cwd:install.workspace,env:{...process.env,LUX_STUDIO_PROFILE:'desktop',LUX_STUDIO_DESKTOP:'1',LUX_STUDIO_SESSION_ID:'4ae503cb641468433362dde10a52237201f0'}}));
const mode=process.argv[2];
if(mode==='open'){await call('discover');const r=await read();await call('open',{path:'C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/Living Ornament - Bird Polish.lux-scene',expectedDraftVersion:r.draftVersion});const a=json(await call('status')).authoring;console.log(JSON.stringify({playback:a.playback,fault:a.fault,frame:a.frameId}));}
if(mode==='restart'){const a=(await read()).status.authoring;console.log(json(await call('restart',{instanceId:a.instanceId,expectedGeneration:a.generation})));}
if(mode==='build'){const r=await read();const source=structuredClone(r.source);console.log(Object.keys(source.files));for(const name of ['ornament-birds','ornament-bird-social','ornament-renderer','ornament-composition']){const key=Object.keys(source.files).find(k=>k.endsWith(name+'.ts'))??(name==='ornament-composition'?source.entry:undefined);if(!key)throw Error('Missing '+name);if(name==='ornament-composition'){const old=JSON.parse(await readFile(dir+'/polish-before.json','utf8')).source.files[key];const line=old.split('\n').find(l=>l.includes("id: 'birdThoughts'"));source.files[key]=old.replace(line,line+'\n'+line.replaceAll('birdThoughts','birdThoughtDuration'));}else source.files[key]=await readFile(root+'/examples/components/wandering-tracers/'+name+'.ts','utf8');}const a=r.status.authoring;await call('playback',{instanceId:a.instanceId,expectedGeneration:a.generation,action:'pause'});await new Promise(r=>setTimeout(r,1000));console.log(json(await call('build',{expectedDraftVersion:r.draftVersion,source,libraryLinks:r.libraryLinks.map(({componentId,mountPath})=>({componentId,mountPath}))})).draftVersion);}
if(mode==='persist'){const r=await read();await writeFile(dir+'/polish-final.json',JSON.stringify(r));console.log(JSON.stringify({fault:r.status.authoring.fault,playback:r.status.authoring.playback,frame:r.status.authoring.frameId}));await call('save',{path:'C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/Living Ornament - Bird Polish.lux-scene',expectedDraftVersion:r.draftVersion});}
if(mode==='capture'||mode==='save'){for(let n=0;n<3;n++){const r=await call('capture');await writeFile(dir+'/polish-'+n+'.png',Buffer.from(r.content.find(x=>x.type==='image').data,'base64'));await new Promise(r=>setTimeout(r,700));}const r=await read();await writeFile(dir+'/polish-final.json',JSON.stringify(r));console.log(JSON.stringify({fault:r.status.authoring.fault,playback:r.status.authoring.playback,controls:r.status.authoring.controls}));if(mode==='save')await call('save',{path:'C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/Living Ornament - Bird Polish.lux-scene',expectedDraftVersion:r.draftVersion,overwrite:true});}
}finally{await c.close()}







