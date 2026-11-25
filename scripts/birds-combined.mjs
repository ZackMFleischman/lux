import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const root=resolve(import.meta.dirname,'..'),dir=resolve(root,'artifacts/birds');
const receipt=JSON.parse(await readFile(dir+'/preview-session.json','utf8'));
const client=new Client({name:'birds-combined-preview',version:'1'});
const call=async(name,args={})=>{const r=await client.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:75000});if(r.isError)throw Error(JSON.stringify(r.content));return r};
const json=r=>JSON.parse(r.content.find(c=>c.type==='text').text);
const status=async()=>json(await call('status'));
async function capture(name){const r=await call('capture');await writeFile(dir+'/'+name+'.png',Buffer.from(r.content.find(c=>c.type==='image').data,'base64'));console.log('capture '+name);}
const scene='C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/Living Ornament - Social Birds.lux-scene';
try{
await client.connect(new StdioClientTransport({command:process.execPath,args:[root+'/scripts/studio-mcp.mjs'],cwd:root,env:{...process.env,LUX_STUDIO_PROFILE:receipt.profile,LUX_STUDIO_SESSION_ID:receipt.sessionId}}));
const mode=process.argv[2]||'build';
if(mode==='build'){
 const current=json(await call('read'));const a=current.status?.authoring;if(a)await call('playback',{instanceId:a.instanceId,expectedGeneration:a.generation,action:'pause'});
 await new Promise(r=>setTimeout(r,500));
 const before=JSON.parse(await readFile(dir+'/before.json','utf8'));const source=structuredClone(before.source);
 for(const name of ['ornament-birds.ts','ornament-bird-social.ts','ornament-renderer.ts'])source.files['components/renderer/'+name]=await readFile(root+'/examples/components/wandering-tracers/'+name,'utf8');
 for(const id of ['birdPitch','birdExcursionSpeed','birdSpecies','birdPalette','birdPerchDuration','birdSociability','birdThoughts'])if(!source.files['ornament-composition.ts'].includes(`id: '${id}'`))source.files['ornament-composition.ts']=source.files['ornament-composition.ts'].replace('  expose: [',`  expose: [\n    { id: '${id}', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: '${id}' },`);
 for(const link of before.libraryLinks)for(const key of Object.keys(source.files))if(key.startsWith(link.mountPath+'/'))delete source.files[key];
 await call('build',{expectedDraftVersion:current.draftVersion,source,libraryLinks:before.libraryLinks.map(({componentId,mountPath})=>({componentId,mountPath}))});
 let a2=(await status()).authoring;
 await call('parameters',{instanceId:a2.instanceId,expectedGeneration:a2.generation,expectedRevisionId:a2.revisionId,expectedControlSchemaHash:a2.controlSchemaHash,values:{...before.status.authoring.controls,birdPitch:2.5,birdPerchDuration:12,birdExcursionSpeed:1.25,birdSociability:0.7,birdThoughts:0.85},mode:'live'});
 for(const [controlId,amount,distribution] of [['birdSize',0.5,'spread'],['birdSpeed',0.3,'centered'],['birdExcursionSpeed',0.4,'random']]){
 const a=(await status()).authoring;const node=a.nodeControls.nodes.find(n=>n.schema.some(c=>c.id===controlId));
 await call('variation',{instanceId:a.instanceId,expectedGeneration:a.generation,expectedRevisionId:a.revisionId,expectedControlSchemaHash:node.schemaHash,nodePath:node.nodePath,controlId,variation:{distribution,amount,enabled:true}});
 }
 const r=json(await call('read'));await call('save',{path:scene,expectedDraftVersion:r.draftVersion,overwrite:true});console.log('built and saved '+scene);
}
if(mode==='capture')await capture(process.argv[3]||'social-preview');
if(mode==='qa'){
 const before=await status();const start=performance.now();await new Promise(r=>setTimeout(r,5000));const after=await status();const fps=Number(BigInt(after.authoring.frameId)-BigInt(before.authoring.frameId))/(after.authoring.timeSeconds-before.authoring.timeSeconds);
 await capture('social-final');const current=json(await call('read'));await call('save',{path:scene,expectedDraftVersion:current.draftVersion,overwrite:true});

 const reopened=await status();const report={fps,fault:reopened.authoring.fault,animations:reopened.authoring.controlAnimations,scene,session:receipt};await writeFile(dir+'/combined-qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
if(mode==='status'){const s=await status();console.log(JSON.stringify({fps:s.visualFps,frame:s.authoring?.frameId,fault:s.authoring?.fault,bindings:s.authoring?.controlAnimations}));}
}finally{await client.close()}



