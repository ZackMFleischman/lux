import {readFile,writeFile,readdir} from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const installation=JSON.parse(await readFile(process.env.LOCALAPPDATA+'/Programs/Lux/installation.json','utf8'));
const client=new Client({name:'living-ornament-live',version:'1.0.0'});
const base='C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/';
try{
 await client.connect(new StdioClientTransport({command:installation.node,args:[installation.adapter],cwd:installation.workspace,env:{...process.env,LUX_STUDIO_PROFILE:'desktop',LUX_STUDIO_DESKTOP:'1',LUX_STUDIO_SESSION_ID:'552d95c4d5fed7e01d911575b0d6a37fd86a'}}));
 const call=async(name,args={})=>{const r=await client.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:75000});if(r.isError)throw Error(JSON.stringify(r.content));return r;};
 const json=r=>JSON.parse(r.content.find(c=>c.type==='text').text);
 const action=process.argv[2]??'capture';const current=json(await call('read'));
 if(['pause','play','reset'].includes(action)){const s=json(await call('status')).authoring;await call('playback',{action,instanceId:s.instanceId,expectedGeneration:s.generation});}
 if(action==='open')await call('open',{path:base+'Living Ornament - Pattern Prototype.lux-scene',expectedDraftVersion:current.draftVersion,discardDirty:false});
 if(action==='build'){
  if(current.source.entry!=='ornament-composition.ts')throw Error('Live scene changed; refusing replacement');
  const runtime=json(await call('status')).authoring;
  if(runtime.playback==='playing')await call('playback',{action:'pause',instanceId:runtime.instanceId,expectedGeneration:runtime.generation});
  const source=structuredClone(current.source),dir='examples/components/wandering-tracers/';
  source.files={};
  const visit=async f=>{if(source.files[f])return;const text=await readFile(dir+f,'utf8');source.files[f]=text;for(const match of text.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g))await visit(match[1]);};
  await visit('ornament-composition.ts');
  await call('build',{source,expectedDraftVersion:current.draftVersion,libraryLinks:[]});
 }
 if(action==='link-foundation'){
  const parts=JSON.parse(await readFile('artifacts/living-ornament/live-foundation-publication.json'));
  let composition=await readFile('examples/components/wandering-tracers/ornament-composition.ts','utf8');
  for(const part of parts)composition=composition.replace("'./"+part.entry+"'","'./components/"+part.mount+"/"+part.entry+"'");
  await call('build',{source:{sdkVersion:'0.4.0',entry:'ornament-composition.ts',files:{'ornament-composition.ts':composition}},expectedDraftVersion:current.draftVersion,libraryLinks:parts.map(p=>({componentId:p.id,mountPath:'components/'+p.mount}))});
  const linked=json(await call('read'));await call('save',{path:base+'Living Ornament - Shape and Pattern.lux-scene',expectedDraftVersion:linked.draftVersion,overwrite:false});
  await writeFile('artifacts/living-ornament/linked-foundation.json',JSON.stringify({draftVersion:linked.draftVersion,libraryLinks:linked.libraryLinks,source:linked.source},null,2));
 }
 if(action==='publish-foundation'){

  const parts=[
   ['909bf033-22df-4ccc-afdb-431b6a83f9d4','regions.ts',['regions.ts','ornament-regions.ts'],'regions'],
   ['998130df-ca1f-4b58-9917-1ee7045275cb','watercolor.ts',['watercolor.ts','ornament-watercolor.ts'],'watercolor'],
   ['d5718a1e-de84-477c-8330-4633fd91df85','boundary.ts',['boundary.ts','ornament-boundary.ts'],'boundary'],
   ['83a60efc-ec4b-4f94-a122-6d2b38b504ee','phrasing.ts',['phrasing.ts'],'phrasing'],
   ['0b92b112-f315-4479-9331-7a815deec27e','ornament-renderer.ts',['ornament-renderer.ts','ornament-packed-patterns.ts','ornament-line-patterns.ts','ornament-ribbon-patterns.ts'],'renderer']
  ];
  const receipts=[];
  for(const [id,entry,names,mount]of parts){
   const lib=async(name,args)=>{const r=await client.callTool({name:'lux.library.'+name,arguments:args},undefined,{timeout:75000});if(r.isError)throw Error(JSON.stringify(r.content));return json(r);};
   const before=await lib('read',{id});
   const source={sdkVersion:'0.4.0',entry,files:Object.fromEntries(await Promise.all(names.map(async f=>[f,await readFile('examples/components/wandering-tracers/'+f,'utf8')])))};
   const same=JSON.stringify(before.source)===JSON.stringify(source);
   const after=same?before:await lib('update',{id,expectedRevision:before.revision,name:before.name,description:before.description,source});
   receipts.push({id,entry,mount,revision:after.revision});
   await writeFile('artifacts/living-ornament/live-foundation-publication.json',JSON.stringify(receipts,null,2));
  }
 }
 if(action==='publish-renderer'){

  const names=['ornament-renderer.ts','ornament-packed-patterns.ts','ornament-line-patterns.ts','ornament-ribbon-patterns.ts'];
  const source={sdkVersion:'0.4.0',entry:'ornament-renderer.ts',files:Object.fromEntries(await Promise.all(names.map(async f=>[f,await readFile('examples/components/wandering-tracers/'+f,'utf8')])))};
  const result=await client.callTool({name:'lux.library.create',arguments:{name:'Ornament Region Styles',description:'Paints organic regions with watercolor, ink and six local motif families. Pattern helpers are scene-prototype internals pending separate reusable extraction.',source}},undefined,{timeout:75000});
  if(result.isError)throw Error(JSON.stringify(result.content));
  await writeFile('artifacts/living-ornament/live-renderer-publication.json',JSON.stringify(result,null,2));
 }
 if(action==='save')await call('save',{path:base+'Living Ornament - Pattern Prototype.lux-scene',expectedDraftVersion:current.draftVersion,overwrite:true});
 if(action==='save-final')await call('save',{path:base+'Living Ornament - Finished.lux-scene',expectedDraftVersion:current.draftVersion,overwrite:false});
 if(action==='parameters'){
  const s=json(await call('status')).authoring;
  await call('parameters',{instanceId:s.instanceId,expectedGeneration:s.generation,expectedRevisionId:s.revisionId,expectedControlSchemaHash:s.controlSchemaHash,values:JSON.parse(process.argv[3]),mode:'live'});
 }
 const capture=await call('capture');const png=capture.content.find(c=>c.type==='image');const path='artifacts/living-ornament/live-'+Date.now()+'.png';await writeFile(path,Buffer.from(png.data,'base64'));
 const status=json(await call('status'));console.log(JSON.stringify({path,status:status.authoring?.playback,fault:status.authoring?.fault,session:status.studioSession}));
}finally{await client.close();}
