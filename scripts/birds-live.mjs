import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const install=JSON.parse(await readFile(process.env.LOCALAPPDATA+'/Programs/Lux/installation.json','utf8'));
const client=new Client({name:'birds-iteration',version:'1'});
const dir='C:/Users/zFlei/repos/lux/.worktrees/bird-iteration/artifacts/birds';
await mkdir(dir,{recursive:true});
const call=async(name,args={})=>{const r=await client.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:75000});if(r.isError)throw Error(JSON.stringify(r.content));return r};
const json=r=>JSON.parse(r.content.find(c=>c.type==='text').text);
try{
await client.connect(new StdioClientTransport({command:install.node,args:[install.adapter],cwd:install.workspace,env:{...process.env,LUX_STUDIO_PROFILE:'desktop',LUX_STUDIO_DESKTOP:'1',LUX_STUDIO_SESSION_ID:'552d95c4d5fed7e01d911575b0d6a37fd86a'}}));
const mode=process.argv[2]||'read';
if(mode==='pause'||mode==='play'){const s=json(await call('status')).authoring;await call('playback',{instanceId:s.instanceId,expectedGeneration:s.generation,action:mode});}
if(mode==='finish'){
 const r=json(await call('read'));const scene='C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/Living Ornament - Bird Variations.lux-scene';
 await call('save',{path:scene,expectedDraftVersion:r.draftVersion,overwrite:true});
 const before=json(await call('status'));const start=performance.now();await new Promise(r=>setTimeout(r,5000));const after=json(await call('status'));
 const report={scene, fps:Number(BigInt(after.authoring.frameId)-BigInt(before.authoring.frameId))/((performance.now()-start)/1000),fault:after.authoring.fault,controls:after.authoring.controls};
 await writeFile(dir+'/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 const capture=await call('capture');await writeFile(dir+'/final.png',Buffer.from(capture.content.find(c=>c.type==='image').data,'base64'));
}
if(mode==='baseline'){const r=json(await call('read'));const b=JSON.parse(await readFile(dir+'/before.json','utf8'));console.log(JSON.stringify(json(await call('build',{expectedDraftVersion:r.draftVersion,source:b.source,libraryLinks:b.libraryLinks.map(({componentId,mountPath})=>({componentId,mountPath}))})).draftVersion));}
if(mode==='read') {const d=json(await call('discover'));await writeFile(dir+'/discovery.json',JSON.stringify(d));const r=json(await call('read'));await writeFile(dir+'/before.json',JSON.stringify(r,null,2));console.log(JSON.stringify({draft:r.draftVersion,files:Object.keys(r.source.files),authoring:r.status?.authoring}));}
if(mode==='build'){const r=json(await call('read'));const source=structuredClone(r.source);for(const name of ['ornament-birds.ts','ornament-renderer.ts','ornament-bird-social.ts']){const key=Object.keys(source.files).find(k=>k.endsWith(name));source.files[key ?? ('components/renderer/'+name)]=await readFile('C:/Users/zFlei/repos/lux/.worktrees/bird-iteration/examples/components/wandering-tracers/'+name,'utf8');}for(const id of ["birdPitch","birdExcursionSpeed","birdSpecies","birdPalette","birdPerchDuration","birdSociability","birdThoughts"]){if(!source.files['ornament-composition.ts'].includes(`id: '${id}'`))source.files['ornament-composition.ts']=source.files['ornament-composition.ts'].replace('  expose: [',`  expose: [\n    { id: '${id}', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: '${id}' },`);}const b=json(await call('build',{expectedDraftVersion:r.draftVersion,source,libraryLinks:r.libraryLinks.map(({componentId,mountPath})=>({componentId,mountPath}))}));await writeFile(dir+'/build.json',JSON.stringify(b,null,2));console.log(JSON.stringify({draft:b.draftVersion,build:b.status?.build,fault:b.status?.authoring?.fault}));}
if(mode==='capture'){const r=await call('capture');const im=r.content.find(c=>c.type==='image');const p=dir+'/'+(process.argv[3]||'preview')+'.png';await writeFile(p,Buffer.from(im.data,'base64'));console.log(p);const m=json(r); console.log(JSON.stringify({frame:m.frameId,time:m.timeSeconds}));}
if(mode==='status'){const s=json(await call('status')); console.log(JSON.stringify({controls:s.authoring?.controls, fps:s.visualFps,keys:Object.keys(s),build:s.build,diagnostics:s.diagnostics,authoring:s.authoring?{fault:s.authoring.fault,frame:s.authoring.frameId}:null}));}
}finally{await client.close()}







