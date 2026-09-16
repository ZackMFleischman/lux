import assert from 'node:assert/strict';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {isAbsolute,join,posix,resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readDesktopInstallation} from './studio-desktop.mjs';

// Publish an already-reviewed LUX-173 or LUX-174 live milestone. This process
// owns only its MCP adapter and never starts or closes Studio.
const [milestone,sceneDirectory,...extra]=process.argv.slice(2);
assert.ok((milestone==='173'||milestone==='174')&&sceneDirectory&&isAbsolute(sceneDirectory)&&!extra.length,
  'Usage: node scripts/publish-ornament-evolution.mjs <173|174> <absolute-persistent-scene-directory>');
const sessionId=process.env.LUX_STUDIO_SESSION_ID;
assert.ok(sessionId,'LUX_STUDIO_SESSION_ID must identify the reviewed live desktop session');
assert.ok((await stat(sceneDirectory)).isDirectory(),'Persistent scene directory must already exist');

const root=resolve(import.meta.dirname,'..');
const folder=join(root,'examples/components/wandering-tracers');
const output=join(root,'artifacts/living-ornament');
await mkdir(output,{recursive:true});
const runId=new Date().toISOString().replaceAll(':','-').replaceAll('.','-')+'-'+randomUUID().slice(0,8);
const sceneLabel=milestone==='173'?'Expressive Motion':'Structural Transformations';
const scenePath=join(sceneDirectory,`Living Ornament - ${sceneLabel} - ${runId}.lux-scene`);
const receiptPath=join(output,`milestone${milestone}-publication.json`);
const priorReceipt=JSON.parse(await readFile(join(output,'milestone172-publication.json'),'utf8'));
assert.equal(priorReceipt.ok,true,'Milestone 172 publication receipt must be complete');
assert.equal(priorReceipt.parts?.length,11,'Milestone 172 must supply exactly eleven existing Library IDs');

const entry='ornament-composition.ts';
const composition=await readFile(join(folder,entry),'utf8');
const parts=[
  {mount:'regions',entry:'regions.ts'},
  {mount:'watercolor',entry:'watercolor.ts'},
  {mount:'boundary',entry:'boundary.ts'},
  {mount:'phrasing',entry:'phrasing.ts'},
  {mount:'spirals',entry:'spirals.ts'},
  {mount:'rings',entry:'rings.ts'},
  {mount:'membranes',entry:'membranes.ts'},
  {mount:'contours',entry:'contours.ts'},
  {mount:'ribbons',entry:'ribbons.ts'},
  {mount:'hatching',entry:'hatching.ts'},
  {mount:'renderer',entry:'ornament-renderer.ts'},
];
const priorIds=new Set();
for(const part of parts){
  const published=priorReceipt.parts.find(row=>row.entry===part.entry&&row.mountPath===`components/${part.mount}`);
  assert.match(published?.id??'',/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Missing milestone 172 Library ID for '+part.entry);
  assert.ok(!priorIds.has(published.id),'Milestone 172 Library IDs must be unique');
  priorIds.add(published.id);part.id=published.id;
}

const importFrom=/^\s*(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s*['"](\.[^'"]+\.ts)['"]\s*;?/gm;
const sideEffectImport=/^\s*import\s*['"](\.[^'"]+\.ts)['"]\s*;?/gm;
async function reachableSource(componentEntry){
  const files={},pending=[componentEntry];
  while(pending.length){
    const file=pending.shift();if(Object.hasOwn(files,file))continue;
    assert.ok(!file.startsWith('../')&&!posix.isAbsolute(file)&&file.endsWith('.ts'),'Invalid local source path: '+file);
    const text=await readFile(join(folder,file),'utf8');files[file]=text;
    for(const pattern of [importFrom,sideEffectImport]){
      pattern.lastIndex=0;let match;
      while((match=pattern.exec(text))){
        const target=posix.normalize(posix.join(posix.dirname(file),match[1]));
        assert.ok(!target.startsWith('../')&&!posix.isAbsolute(target),'Local import escapes component folder: '+match[1]);
        if(!Object.hasOwn(files,target)&&!pending.includes(target))pending.push(target);
      }
    }
  }
  return {sdkVersion:'0.4.0',entry:componentEntry,files};
}

const receipt={ok:false,milestone,runId,sessionId,scenePath,parts:[],captures:[],checks:[]};
const saveReceipt=()=>writeFile(receiptPath,JSON.stringify(receipt,null,2));
const installation=await readDesktopInstallation();
const client=new Client({name:'living-ornament-evolution-publication',version:'1.0.0'});
const env={...process.env,LUX_STUDIO_PROFILE:'desktop',LUX_STUDIO_DESKTOP:'1',LUX_STUDIO_SESSION_ID:sessionId};
for(const key of ['LUX_STUDIO_MCP_TEST','LUX_STUDIO_SMOKE','LUX_STUDIO_LIBRARY_ROOT','LUX_STUDIO_DIST','ELECTRON_RUN_AS_NODE'])delete env[key];
async function raw(name,args={}){const result=await client.callTool({name,arguments:args},undefined,{timeout:75000});if(result.isError)throw Error(JSON.stringify(result.content));return result;}
async function call(name,args={}){const result=await raw(name,args),text=result.content.find(item=>item.type==='text');assert.ok(text,'Missing MCP JSON result: '+name);return JSON.parse(text.text);}
function runtime(status,playback){
  assert.equal(status.studioSession.sessionId,sessionId);assert.equal(status.studioSession.profile,'desktop');
  const current=status.authoring;assert.ok(current?.revisionId&&current.frameId);assert.equal(current.fault,null);
  if(playback)assert.equal(current.playback,playback);assert.equal(current.nodeControls.nodes.length,11,'Reviewed scene must have eleven executable nodes');
  return current;
}
function liveFile(source,part,file){
  const mounted=`components/${part.mount}/${file}`;
  if(Object.hasOwn(source.files,mounted))return source.files[mounted];
  if(Object.hasOwn(source.files,file))return source.files[file];
  const matches=Object.keys(source.files).filter(path=>path.endsWith('/'+file));
  assert.equal(matches.length,1,'Ambiguous/missing reviewed source file: '+file);return source.files[matches[0]];
}
async function capture(label){
  const result=await raw('lux.studio.capture');const png=result.content.find(item=>item.type==='image'&&item.mimeType==='image/png');
  assert.ok(png,'MCP capture did not return a PNG image');const path=join(output,`milestone${milestone}-${runId}-${label}.png`);
  await writeFile(path,Buffer.from(png.data,'base64'));receipt.captures.push(path);
}

try{
  await client.connect(new StdioClientTransport({command:installation.node,args:[installation.adapter],cwd:installation.workspace,env}));
  const initial=await call('lux.studio.read');const initialRuntime=runtime(await call('lux.studio.status'),'playing');
  assert.equal(initial.source.entry,entry);receipt.beforeRevision=initialRuntime.revisionId;

  // Resolve and verify every exact live source before any Library mutation.
  for(const part of parts){
    part.before=await call('lux.library.read',{id:part.id});assert.equal(part.before.source.entry,part.entry);
    assert.ok(!part.before.dependencies?.length,'Expected an independent leaf: '+part.entry);
    part.source=await reachableSource(part.entry);
    for(const [file,text] of Object.entries(part.source.files))assert.equal(liveFile(initial.source,part,file),text,'Live reviewed scene differs from publication source: '+part.entry+'/'+file);
  }
  let wiring=composition;
  for(const part of parts){const local=`'./${part.entry}'`;assert.equal(wiring.split(local).length,2,'Expected one root import for '+part.entry);wiring=wiring.replace(local,`'./components/${part.mount}/${part.entry}'`);}
  let reviewedRoot=initial.source.files[entry];
  for(const part of parts)reviewedRoot=reviewedRoot.replace(`'./components/${part.mount}/${part.entry}'`,`'./${part.entry}'`);
  assert.equal(reviewedRoot,composition,'Live root wiring differs from the publication composition');
  await capture('before');receipt.checks.push('Session-bound live eleven-node scene matches every reachable publication source');await saveReceipt();

  // All entries already exist. Only source changes create guarded revisions.
  for(const part of parts){
    const before=part.before;let stored=before,action='unchanged';
    if(!isDeepStrictEqual(before.source,part.source)){
      action='updated';stored=await call('lux.library.update',{id:before.id,expectedRevision:before.revision,name:before.name,description:before.description,source:part.source});
      assert.equal(stored.revision,before.revision+1);
    }
    part.revision=stored.revision;receipt.parts.push({name:stored.name,id:stored.id,entry:part.entry,mountPath:`components/${part.mount}`,revision:stored.revision,previousRevision:before.revision,action});await saveReceipt();
    const verified=await call('lux.library.read',{id:stored.id,revision:stored.revision});assert.deepEqual(verified.source,part.source);assert.ok(!verified.dependencies?.length);
    const historical=await call('lux.library.read',{id:before.id,revision:before.revision});assert.deepEqual(historical.source,before.source,'Historical revision changed: '+part.entry);
  }

  const latest=await call('lux.studio.read');assert.equal(latest.draftVersion,initial.draftVersion,'Live draft changed during publication');assert.deepEqual(latest.source,initial.source);
  const beforeBuild=runtime(await call('lux.studio.status'),'playing');
  await call('lux.studio.playback',{instanceId:beforeBuild.instanceId,expectedGeneration:beforeBuild.generation,action:'pause'});
  runtime(await call('lux.studio.status'),'paused');
  const source={sdkVersion:'0.4.0',entry,files:{[entry]:wiring}};
  const libraryLinks=receipt.parts.map(({id,mountPath})=>({componentId:id,mountPath}));
  await call('lux.studio.build',{source,expectedDraftVersion:latest.draftVersion,libraryLinks});
  const linked=await call('lux.studio.read');const paused=runtime(await call('lux.studio.status'));
  assert.equal(linked.libraryLinks.length,11);assert.deepEqual(paused.controls,beforeBuild.controls);
  for(const node of beforeBuild.nodeControls.nodes){const after=paused.nodeControls.nodes.find(row=>isDeepStrictEqual(row.nodePath,node.nodePath));assert.ok(after);assert.deepEqual(after.values,node.values,'Linked build changed live node controls');}
  for(const part of parts){
    const link=linked.libraryLinks.find(row=>row.componentId===part.id&&row.mountPath===`components/${part.mount}`);assert.equal(link?.resolvedRevision,part.revision,'Library changed during build');
    for(const [file,text] of Object.entries(part.source.files))assert.equal(linked.source.files[`components/${part.mount}/${file}`],text);
  }
  assert.equal(Object.keys(linked.source.files).length,1+parts.reduce((count,part)=>count+Object.keys(part.source.files).length,0));
  await call('lux.studio.save',{path:scenePath,expectedDraftVersion:linked.draftVersion,overwrite:false});
  await call('lux.studio.playback',{instanceId:paused.instanceId,expectedGeneration:paused.generation,action:'play'});
  const final=runtime(await call('lux.studio.status'),'playing');await capture('linked');
  receipt.afterRevision=final.revisionId;receipt.playback=final.playback;receipt.nodeCount=final.nodeControls.nodes.length;
  receipt.checks.push('Changed sources received guarded revisions; unchanged entries retained their revisions and all history remains readable','Linked build requested after pause preserved public and node controls; final playback verified playing','Unique persistent milestone scene saved; desktop preview remains playing and open');receipt.ok=true;
}catch(error){receipt.failure=error.stack??String(error);process.exitCode=1;}
finally{
  await saveReceipt();await client.close();
  console.log(JSON.stringify({ok:receipt.ok,milestone,scenePath,receipt:receiptPath,parts:receipt.parts,failure:receipt.failure},null,2));
}
