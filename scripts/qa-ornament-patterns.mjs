import assert from 'node:assert/strict';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {isAbsolute,join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {decode} from 'fast-png';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readDesktopInstallation} from './studio-desktop.mjs';

// One milestone check against the explicitly selected live desktop session.
// Owns only its adapter. Never launches/closes Studio or publishes Library entries.
const [prototypePath,sceneDirectory,...extra]=process.argv.slice(2);
assert.ok(prototypePath&&sceneDirectory&&isAbsolute(prototypePath)&&isAbsolute(sceneDirectory)&&!extra.length,
  'Usage: node scripts/qa-ornament-patterns.mjs <absolute-prototype.lux-scene> <absolute-persistent-scene-directory>');
const sessionId=process.env.LUX_STUDIO_SESSION_ID;assert.ok(sessionId,'LUX_STUDIO_SESSION_ID is required');
assert.ok((await stat(sceneDirectory)).isDirectory());
const root=resolve(import.meta.dirname,'..'),folder=join(root,'examples/components/wandering-tracers');
const runId=new Date().toISOString().replaceAll(':','-').replaceAll('.','-')+'-'+randomUUID().slice(0,8);
const output=join(root,'artifacts/living-ornament','milestone172-qa-'+runId);
await mkdir(output,{recursive:true});
const scenePath=join(sceneDirectory,`Living Ornament - Reusable Patterns QA - ${runId}.lux-scene`);
const prototype=JSON.parse(await readFile(prototypePath,'utf8')).source;
assert.equal(prototype?.entry,'ornament-composition.ts');
const candidate={sdkVersion:'0.4.0',entry:'ornament-composition.ts',files:{}};
async function visit(file){if(Object.hasOwn(candidate.files,file))return;const text=await readFile(join(folder,file),'utf8');candidate.files[file]=text;for(const match of text.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g))await visit(match[1]);}
await visit(candidate.entry);
const hash=value=>createHash('sha256').update(value).digest('hex');
const report={ok:false,sessionId,scenePath,prototypePath,checks:[],captures:{},
  sourceHashes:{prototype:hash(JSON.stringify(prototype)),candidate:hash(JSON.stringify(candidate))},
  provenance:'Live installed Studio MCP capture and scripted controls. No native-input provenance claim. Comparison uses paused reset at time zero. Restoration resets the animation clock.'};
await writeFile(join(output,'candidate-source.json'),JSON.stringify(candidate,null,2));
const installation=await readDesktopInstallation(),client=new Client({name:'ornament-pattern-milestone-qa',version:'1.0.0'});
const env={...process.env,LUX_STUDIO_PROFILE:'desktop',LUX_STUDIO_DESKTOP:'1',LUX_STUDIO_SESSION_ID:sessionId};
for(const key of ['LUX_STUDIO_MCP_TEST','LUX_STUDIO_SMOKE','LUX_STUDIO_LIBRARY_ROOT','LUX_STUDIO_DIST','ELECTRON_RUN_AS_NODE'])delete env[key];
async function raw(name,args={}){const result=await client.callTool({name:'lux.studio.'+name,arguments:args},undefined,{timeout:75000});if(result.isError)throw Error(JSON.stringify(result.content));return result;}
async function call(name,args={}){const result=await raw(name,args);return JSON.parse(result.content.find(item=>item.type==='text').text);}
async function status(count){const state=await call('status');assert.equal(state.studioSession.sessionId,sessionId);assert.equal(state.studioSession.profile,'desktop');const runtime=state.authoring;assert.ok(runtime?.revisionId&&runtime.frameId);assert.equal(runtime.fault,null);if(count!==undefined)assert.equal(runtime.nodeControls.nodes.length,count);return state;}
async function playback(action){const runtime=(await status()).authoring;await call('playback',{instanceId:runtime.instanceId,expectedGeneration:runtime.generation,action});}
async function reset(){await playback('pause');await playback('reset');const runtime=(await status()).authoring;assert.equal(runtime.playback,'paused');assert.equal(runtime.timeSeconds,0);}
async function patch(values){const runtime=(await status()).authoring;await call('parameters',{instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedControlSchemaHash:runtime.controlSchemaHash,values,mode:'live'});}
async function build(source){await playback('pause');const current=await call('read');await call('build',{source,expectedDraftVersion:current.draftVersion,libraryLinks:[]});}
async function reopen(){await playback('pause');const current=await call('read');await call('open',{path:scenePath,expectedDraftVersion:current.draftVersion,discardDirty:true});}
async function capture(label){
  const result=await raw('capture'),image=result.content.find(item=>item.type==='image'&&item.mimeType==='image/png');assert.ok(image,'Expected MCP PNG');
  const bytes=Buffer.from(image.data,'base64'),pixels=decode(bytes),path=join(output,label+'.png');await writeFile(path,bytes);
  report.captures[label]={path,width:pixels.width,height:pixels.height,pixelSha256:hash(pixels.data)};
  const text=result.content.find(item=>item.type==='text');if(text)await writeFile(join(output,label+'-metadata.json'),text.text);
  return pixels;
}
function compare(a,b){assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.equal(a.channels,b.channels);let changedChannels=0,maxDelta=0,totalDelta=0;for(let i=0;i<a.data.length;i++){const delta=Math.abs(a.data[i]-b.data[i]);if(delta)changedChannels++;maxDelta=Math.max(maxDelta,delta);totalDelta+=delta;}return {changedChannels,totalChannels:a.data.length,maxDelta,meanDelta:totalDelta/a.data.length};}
let initial,saved=false,connected=false;
try{
  await client.connect(new StdioClientTransport({command:installation.node,args:[installation.adapter],cwd:installation.workspace,env}));connected=true;
  initial=await status(11);assert.equal(initial.authoring.playback,'playing','Start from the accepted playing eleven-node scene');
  await writeFile(join(output,'initial-status.json'),JSON.stringify(initial,null,2));
  const current=await call('read');await call('save',{path:scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});saved=true;
  const savedBytes=await readFile(scenePath);report.savedSceneSha256=hash(savedBytes);
  // Sample completed frame counters over actual wall time, retaining host metrics.
  const samples=[];
  for(let i=0;i<=4;i++){
    if(i)await delay(5000);
    const begin=performance.now(),state=await status(11),end=performance.now();assert.equal(state.authoring.playback,'playing');
    assert.equal(state.authoring.revisionId,initial.authoring.revisionId,'Revision changed during FPS sampling');
    samples.push({wallMs:(begin+end)/2,requestMs:end-begin,frameId:state.authoring.frameId,timeSeconds:state.authoring.timeSeconds,performance:state.performance});
  }
  const elapsedSeconds=(samples.at(-1).wallMs-samples[0].wallMs)/1000,frames=Number(BigInt(samples.at(-1).frameId)-BigInt(samples[0].frameId));
  report.performance={elapsedSeconds,completedFrames:frames,measuredFps:frames/elapsedSeconds,samples};assert.ok(frames>0,'Playing preview did not advance');
  report.checks.push('Healthy eleven-node playback sampled for at least twenty seconds; FPS uses completed frame delta');
  await reset();const originalPixels=await capture('original-reset');

  await build(prototype);await reset();const beforeRuntime=(await status(5)).authoring;
  const common=Object.fromEntries(Object.entries(initial.authoring.controls).filter(([key])=>Object.hasOwn(beforeRuntime.controls,key)));
  await patch(common);await reset();const before=await capture('prototype-reset');
  await build(candidate);await reset();await status(11);
  const unity=Object.fromEntries(['spirals','rings','membranes','contours','hatching','ribbons'].flatMap(name=>[[name+'Density',1],[name+'Width',1]]));
  await patch({...common,...unity});await reset();
  // New motif nodes must supply unity variation/motion as well as public controls.
  const extracted=(await status(11)).authoring;
  for(const node of extracted.nodeControls.nodes.filter(node=>node.nodePath[0].startsWith('d172'))){
    for(const key of ['density','width','variation','motion'])assert.equal(node.values[Object.hasOwn(node.values,'ornamentDensity')?'ornament'+key[0].toUpperCase()+key.slice(1):key],1,'Non-unity motif multiplier: '+key);
  }
  report.comparisonControls={...common,...unity};const after=await capture('extracted-reset');report.extractionComparison=compare(before,after);
  report.checks.push('Prototype and extracted sources captured at time zero with matching shared controls and unity leaf multipliers');
  for(const seed of [7,19,43]){await patch({seed});await reset();await capture('seed-'+seed);}
  await patch({seed:7,ornamentSize:1.5});await reset();await capture('detail-large-regions');
  report.detailControls={seed:7,ornamentSize:1.5};

  await reopen();await reset();const reopened=(await status(11)).authoring;
  assert.deepEqual(reopened.controls,initial.authoring.controls);
  for(const node of initial.authoring.nodeControls.nodes){const after=reopened.nodeControls.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(node.nodePath));assert.ok(after);assert.deepEqual(after.values,node.values);}
  assert.deepEqual((await call('read')).source,current.source);
  const reopenedPixels=await capture('saved-reopened-reset');report.reopenComparison=compare(originalPixels,reopenedPixels);assert.equal(report.reopenComparison.changedChannels,0);
  report.checks.push('Unique persistent scene reopens with eleven nodes, original source, all node controls, and identical reset pixels');
  const valid=await call('read'),invalid=structuredClone(valid.source);invalid.files[invalid.entry]='invalid syntax !';
  await assert.rejects(()=>call('build',{source:invalid,expectedDraftVersion:valid.draftVersion,libraryLinks:(valid.libraryLinks??[]).map(({componentId,mountPath})=>({componentId,mountPath}))}));
  const retained=(await status(11)).authoring;assert.equal(retained.revisionId,reopened.revisionId);assert.equal(retained.playback,'paused');
  assert.deepEqual(retained.controls,reopened.controls);report.invalidComparison=compare(reopenedPixels,await capture('invalid-edit-retained'));assert.equal(report.invalidComparison.changedChannels,0);
  assert.equal(hash(await readFile(scenePath)),report.savedSceneSha256);
  report.checks.push('Invalid build retains accepted revision, controls, rendered pixels and saved scene bytes');
  assert.equal(report.extractionComparison.changedChannels,0,'Extracted patterns differ from the prototype; inspect paired PNGs');
  report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;}
finally{
  if(saved&&connected){try{await reopen();await playback(initial.authoring.playback==='playing'?'play':'pause');const restored=await status(11);assert.deepEqual(restored.authoring.controls,initial.authoring.controls);report.restored={playback:restored.authoring.playback,revisionId:restored.authoring.revisionId};}catch(error){report.ok=false;report.restorationFailure=error.stack??String(error);process.exitCode=1;}}
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));await client.close();
  console.log(JSON.stringify({ok:report.ok,output,scenePath,measuredFps:report.performance?.measuredFps,extractionComparison:report.extractionComparison,failure:report.failure,restorationFailure:report.restorationFailure},null,2));
}
