import assert from 'node:assert/strict';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {isAbsolute,join,resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readDesktopInstallation} from './studio-desktop.mjs';

// Invoke only after the live eleven-node milestone has been visually accepted.
// This process owns the MCP adapter only. It never starts or closes Studio.
const [sceneDirectory,option,overwritePath,...extra]=process.argv.slice(2);
assert.ok(sceneDirectory&&isAbsolute(sceneDirectory)&&!extra.length&&(!option||(option==='--overwrite'&&overwritePath)),
  'Usage: node scripts/publish-ornament-patterns.mjs <absolute-persistent-scene-directory> [--overwrite <absolute-scene-path>]');
const sessionId=process.env.LUX_STUDIO_SESSION_ID;assert.ok(sessionId,'LUX_STUDIO_SESSION_ID must identify the reviewed live desktop session');
assert.ok((await stat(sceneDirectory)).isDirectory(),'Persistent scene directory must already exist');
if(overwritePath)assert.ok(isAbsolute(overwritePath)&&overwritePath.toLowerCase().endsWith('.lux-scene'),'Explicit overwrite target must be an absolute .lux-scene path');
const root=resolve(import.meta.dirname,'..'),folder=join(root,'examples/components/wandering-tracers'),output=join(root,'artifacts/living-ornament');
await mkdir(output,{recursive:true});
const runId=new Date().toISOString().replaceAll(':','-').replaceAll('.','-')+'-'+randomUUID().slice(0,8);
const scenePath=overwritePath??join(sceneDirectory,`Living Ornament - Reusable Patterns - ${runId}.lux-scene`);
const entry='ornament-composition.ts',composition=await readFile(join(folder,entry),'utf8');
const parts=[
  {mount:'regions',entry:'regions.ts',id:'909bf033-22df-4ccc-afdb-431b6a83f9d4',foundation:true},
  {mount:'watercolor',entry:'watercolor.ts',id:'998130df-ca1f-4b58-9917-1ee7045275cb',foundation:true},
  {mount:'boundary',entry:'boundary.ts',id:'d5718a1e-de84-477c-8330-4633fd91df85',foundation:true},
  {mount:'phrasing',entry:'phrasing.ts',id:'83a60efc-ec4b-4f94-a122-6d2b38b504ee',foundation:true},
  {mount:'spirals',entry:'spirals.ts',name:'Spiral Fill',description:'Attached regional spiral motifs with independent density, width, variation, and motion.'},
  {mount:'rings',entry:'rings.ts',name:'Packed Circles & Rings',description:'Packed regional circle and ring motifs with independent live pattern controls.'},
  {mount:'membranes',entry:'membranes.ts',name:'Membrane Divisions',description:'Region-attached membrane divisions with independent live pattern controls.'},
  {mount:'contours',entry:'contours.ts',name:'Nested Contours',description:'Nested regional contour marks with independent live pattern controls.'},
  {mount:'ribbons',entry:'ribbons.ts',name:'Decorated Ribbons',description:'Attached ladders, pearl beads, and transverse ribbon stripes with independent live multipliers.'},
  {mount:'hatching',entry:'hatching.ts',files:['hatching.ts','ornament-hatching.ts'],id:'f564a771-028a-4031-abaa-e64a1cfc8bec'},
  {mount:'renderer',entry:'ornament-renderer.ts',id:'0b92b112-f315-4479-9331-7a815deec27e',description:'Paints independent region, watercolor, ink, phrasing, and six reusable motif fields in one ornament image.'},
];
const receipt={ok:false,runId,sessionId,scenePath,parts:[],captures:[],checks:[]};
const saveReceipt=()=>writeFile(join(output,'milestone172-publication.json'),JSON.stringify(receipt,null,2));
const installation=await readDesktopInstallation(),client=new Client({name:'living-ornament-pattern-publication',version:'1.0.0'});
const env={...process.env,LUX_STUDIO_PROFILE:'desktop',LUX_STUDIO_DESKTOP:'1',LUX_STUDIO_SESSION_ID:sessionId};
for(const key of ['LUX_STUDIO_MCP_TEST','LUX_STUDIO_SMOKE','LUX_STUDIO_LIBRARY_ROOT','LUX_STUDIO_DIST','ELECTRON_RUN_AS_NODE'])delete env[key];
async function raw(name,args={}){const result=await client.callTool({name,arguments:args},undefined,{timeout:75000});if(result.isError)throw Error(JSON.stringify(result.content));return result;}
async function call(name,args={}){const result=await raw(name,args),text=result.content.find(item=>item.type==='text');assert.ok(text,'Missing MCP JSON result: '+name);return JSON.parse(text.text);}
function healthy(status){assert.equal(status.studioSession.sessionId,sessionId);assert.equal(status.studioSession.profile,'desktop');const runtime=status.authoring;assert.ok(runtime?.revisionId&&runtime.frameId);assert.equal(runtime.fault,null);assert.equal(runtime.playback,'playing');assert.equal(runtime.nodeControls.nodes.length,11,'The reviewed live scene must have eleven executable nodes');return runtime;}
function liveFile(source,file){const matches=Object.keys(source.files).filter(path=>path===file||path.endsWith('/'+file));assert.equal(matches.length,1,'Ambiguous/missing reviewed source file: '+file);return source.files[matches[0]];}
async function capture(label){const result=await raw('lux.studio.capture'),png=result.content.find(item=>item.type==='image'&&item.mimeType==='image/png');assert.ok(png,'MCP capture did not return a PNG image');const path=join(output,`milestone172-${runId}-${label}.png`);await writeFile(path,Buffer.from(png.data,'base64'));receipt.captures.push(path);}
try{
  await client.connect(new StdioClientTransport({command:installation.node,args:[installation.adapter],cwd:installation.workspace,env}));
  const initial=await call('lux.studio.read'),initialRuntime=healthy(await call('lux.studio.status'));assert.equal(initial.source.entry,entry);receipt.beforeRevision=initialRuntime.revisionId;
  const catalog=await call('lux.library.list');
  // Read and capture every guarded update before the first publication.
  for(const part of parts){
    if(!part.id){const matches=catalog.filter(row=>row.name===part.name);assert.ok(matches.length<=1,'Ambiguous Library name: '+part.name);part.id=matches[0]?.id;}
    if(part.id){part.before=await call('lux.library.read',{id:part.id});assert.equal(part.before.source.entry,part.entry);assert.ok(!part.before.dependencies?.length,'Expected an independent leaf: '+part.entry);}
    part.source=part.foundation?part.before.source:{sdkVersion:'0.4.0',entry:part.entry,files:Object.fromEntries(await Promise.all((part.files??[part.entry]).map(async file=>[file,await readFile(join(folder,file),'utf8')])))};
    for(const [file,text] of Object.entries(part.source.files))assert.equal(liveFile(initial.source,file),text,'Live reviewed scene differs from publication source: '+file);
  }
  let wiring=composition;
  for(const part of parts){const local=`'./${part.entry}'`;assert.equal(wiring.split(local).length,2,'Expected one root import for '+part.entry);wiring=wiring.replace(local,`'./components/${part.mount}/${part.entry}'`);}
  let reviewedRoot=initial.source.files[entry];for(const part of parts)reviewedRoot=reviewedRoot.replace(`'./components/${part.mount}/${part.entry}'`,`'./${part.entry}'`);
  assert.equal(reviewedRoot,composition,'Live root wiring differs from the publication composition');
  await capture('before');receipt.checks.push('Session-bound live playing eleven-node scene matches all publication sources');await saveReceipt();
  for(const part of parts){
    const before=part.before;let stored=before,action='unchanged';
    if(!part.foundation&&(!before||!isDeepStrictEqual(before.source,part.source))){
      action=before?'updated':'created';stored=await call('lux.library.'+(before?'update':'create'),{
        ...(before?{id:before.id,expectedRevision:before.revision}:{}),name:before?.name??part.name,
        description:part.description??before.description,source:part.source,
      });assert.equal(stored.revision,before?before.revision+1:1);
    }
    part.id=stored.id;part.revision=stored.revision;
    receipt.parts.push({name:stored.name,id:stored.id,entry:part.entry,mountPath:'components/'+part.mount,revision:stored.revision,previousRevision:before?.revision,action});await saveReceipt();
    const verified=await call('lux.library.read',{id:stored.id,revision:stored.revision});assert.deepEqual(verified.source,part.source);assert.ok(!verified.dependencies?.length);
    if(before){const historical=await call('lux.library.read',{id:before.id,revision:before.revision});assert.deepEqual(historical.source,before.source,'Historical revision changed: '+part.entry);}
  }
  // Do not overwrite edits made while the Library operations were running.
  const latest=await call('lux.studio.read');assert.equal(latest.draftVersion,initial.draftVersion,'Live draft changed during publication');assert.deepEqual(latest.source,initial.source);
  const runtimeBeforeBuild=healthy(await call('lux.studio.status'));
  const source={sdkVersion:'0.4.0',entry,files:{[entry]:wiring}},libraryLinks=receipt.parts.map(({id,mountPath})=>({componentId:id,mountPath}));
  await call('lux.studio.build',{source,expectedDraftVersion:latest.draftVersion,libraryLinks});
  const linked=await call('lux.studio.read'),runtime=healthy(await call('lux.studio.status'));assert.equal(linked.libraryLinks.length,11);assert.deepEqual(runtime.controls,runtimeBeforeBuild.controls);
  for(const node of runtimeBeforeBuild.nodeControls.nodes){const after=runtime.nodeControls.nodes.find(row=>isDeepStrictEqual(row.nodePath,node.nodePath));assert.ok(after);assert.deepEqual(after.values,node.values,'Linked build changed live node controls');}
  for(const part of parts){const link=linked.libraryLinks.find(row=>row.componentId===part.id&&row.mountPath==='components/'+part.mount);assert.equal(link?.resolvedRevision,part.revision,'Library changed during build');for(const [file,text] of Object.entries(part.source.files))assert.equal(linked.source.files['components/'+part.mount+'/'+file],text);}
  assert.equal(Object.keys(linked.source.files).length,1+parts.reduce((count,part)=>count+Object.keys(part.source.files).length,0));
  await call('lux.studio.save',{path:scenePath,expectedDraftVersion:linked.draftVersion,overwrite:!!overwritePath});
  await capture('linked');const final=healthy(await call('lux.studio.status'));receipt.afterRevision=final.revisionId;receipt.playback=final.playback;receipt.nodeCount=final.nodeControls.nodes.length;
  receipt.checks.push('Independent Library sources verified and historical revisions preserved','Minimal eleven-link scene preserves live public and node control values','New persistent scene saved; desktop preview remains playing and open');receipt.ok=true;
}catch(error){receipt.failure=error.stack??String(error);process.exitCode=1;}
finally{await saveReceipt();await client.close();console.log(JSON.stringify({ok:receipt.ok,scenePath,receipt:join(output,'milestone172-publication.json'),parts:receipt.parts,failure:receipt.failure},null,2));}
