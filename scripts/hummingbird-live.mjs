import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const host=resolve(import.meta.dirname,'..'),root=resolve(host,'../hummingbird-art'),dir=root+'/artifacts/hummingbirds';
const receipt=JSON.parse(await readFile(host+'/artifacts/birds/preview-session.json','utf8'));
const client=new Client({name:'hummingbird-art',version:'1'});
const call=async(name,args={})=>{const r=await client.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:75000});if(r.isError)throw Error(JSON.stringify(r.content));return r};
const json=r=>JSON.parse(r.content.find(c=>c.type==='text').text);
const status=async()=>json(await call('status'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function capture(label){const r=await call('capture');await writeFile(dir+'/'+label+'.png',Buffer.from(r.content.find(c=>c.type==='image').data,'base64'));await writeFile(dir+'/'+label+'.json',JSON.stringify(json(r)));console.log('capture '+label);}
async function parameters(values){const a=(await status()).authoring;await call('parameters',{instanceId:a.instanceId,expectedGeneration:a.generation,expectedRevisionId:a.revisionId,expectedControlSchemaHash:a.controlSchemaHash,values,mode:'live'});}
try{
await client.connect(new StdioClientTransport({command:process.execPath,args:[host+'/scripts/studio-mcp.mjs'],cwd:host,env:{...process.env,LUX_STUDIO_PROFILE:receipt.profile,LUX_STUDIO_SESSION_ID:receipt.sessionId}}));
const mode=process.argv[2]||'audit';
if(mode==='pause'){const a=(await status()).authoring;await call('playback',{instanceId:a.instanceId,expectedGeneration:a.generation,action:'pause'});}
if(mode==='audit'){
 const d=json(await call('discover'));const r=json(await call('read'));await writeFile(dir+'/before.json',JSON.stringify(r));await writeFile(dir+'/discovery.json',JSON.stringify(d));console.log(JSON.stringify({session:r.status?.studioSession,draft:r.draftVersion,controls:r.status?.authoring?.controls}));
 for(let i=0;i<3;i++){await capture('before-'+i);await delay(400);}
}
if(mode==='build'){
 const r=json(await call('read'));const a=(await status()).authoring;await call('playback',{instanceId:a.instanceId,expectedGeneration:a.generation,action:'pause'});await delay(500);
 const source=structuredClone(r.source);source.files['components/renderer/ornament-birds.ts']=await readFile(root+'/examples/components/wandering-tracers/ornament-birds.ts','utf8');
 source.files['components/renderer/ornament-hummingbird.ts']=await readFile(root+'/examples/components/wandering-tracers/ornament-hummingbird.ts','utf8');
 const b=json(await call('build',{expectedDraftVersion:r.draftVersion,source,libraryLinks:r.libraryLinks.map(({componentId,mountPath})=>({componentId,mountPath}))}));console.log(JSON.stringify({draft:b.draftVersion,fault:b.status?.authoring?.fault}));
}
if(mode==='capture'){for(let i=0;i<3;i++){await capture((process.argv[3]||'after')+'-'+i);await delay(350);}}
if(mode==='detail'){await parameters({birdSize:5});for(let i=0;i<3;i++){await capture('detail-'+i);await delay(500);}}
if(mode==='restore'){const before=JSON.parse(await readFile(dir+'/before.json','utf8'));await parameters({birdSize:before.status.authoring.controls.birdSize});}
if(mode==='finish'){
 const before=JSON.parse(await readFile(dir+'/before.json','utf8'));await parameters({birdSize:before.status.authoring.controls.birdSize});
 const a=(await status()).authoring;await delay(5000);const b=(await status()).authoring;const fps=Number(BigInt(b.frameId)-BigInt(a.frameId))/(b.timeSeconds-a.timeSeconds);await capture('final');
 const r=json(await call('read'));const path='C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/Living Ornament - Opalescent Birds.lux-scene';await call('save',{path,expectedDraftVersion:r.draftVersion,overwrite:true});const evidence={fps,fault:b.fault,path,source:r.source,controls:b.controls,animations:b.controlAnimations};await writeFile(dir+'/final.json',JSON.stringify(evidence));console.log(JSON.stringify({fps,fault:b.fault,path}));
}
}finally{await client.close()}

