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
const [milestone,sceneDirectory,...extra]=process.argv.slice(2);
assert.ok(['173','174'].includes(milestone)&&sceneDirectory&&isAbsolute(sceneDirectory)&&!extra.length,
  'Usage: node scripts/qa-ornament-motion.mjs <173|174> <absolute-persistent-scene-directory>');
const checkpointSeconds=process.env.LUX_QA_CHECKPOINTS?JSON.parse(process.env.LUX_QA_CHECKPOINTS):(milestone==='174'?[0,20,40,70]:[0,20,40]);
assert.ok(Array.isArray(checkpointSeconds)&&checkpointSeconds.length>0&&checkpointSeconds.every(t=>Number.isFinite(t)&&t>=0&&t<=120));
const sessionId=process.env.LUX_STUDIO_SESSION_ID;assert.ok(sessionId,'LUX_STUDIO_SESSION_ID is required');
assert.ok((await stat(sceneDirectory)).isDirectory());
const root=resolve(import.meta.dirname,'..'),folder=join(root,'examples/components/wandering-tracers');
const runId=new Date().toISOString().replaceAll(':','-').replaceAll('.','-')+'-'+randomUUID().slice(0,8);
const output=join(root,'artifacts/living-ornament',`milestone${milestone}-qa-${runId}`);
await mkdir(output,{recursive:true});
const scenePath=join(sceneDirectory,`Living Ornament - Motion ${milestone} QA - ${runId}.lux-scene`);
const candidate={sdkVersion:'0.4.0',entry:'ornament-composition.ts',files:{}};
async function visit(file){if(Object.hasOwn(candidate.files,file))return;const text=await readFile(join(folder,file),'utf8');candidate.files[file]=text;for(const match of text.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g))await visit(match[1]);}
await visit(candidate.entry);
const hash=value=>createHash('sha256').update(value).digest('hex');
const report={ok:false,milestone,sessionId,scenePath,checkpointSeconds,checks:[],captures:{},
  sourceHashes:{candidate:hash(JSON.stringify(candidate))},
  provenance:`Live installed Studio MCP capture and scripted controls. No native-input provenance claim. Diagnostic sources freeze every update(frame) at ${checkpointSeconds.join('/')} seconds with deltaSeconds zero. Phrasing accumulates fixed time times pace on its first update after reset. Restoration resets the animation clock.`};
await writeFile(join(output,'candidate-source.json'),JSON.stringify(candidate,null,2));
function freeze(seconds){
  const source=structuredClone(candidate);let updates=0;
  for(const [file,text] of Object.entries(source.files))source.files[file]=text.replace(/update\(frame\)\s*\{/g,()=>{updates++;return `update(frame) { frame = Object.freeze({...frame,timeSeconds:${seconds},deltaSeconds:0});`;});
  assert.equal(updates,11,'Expected one frozen update for each executable ornament node');
  assert.ok(source.files['phrasing.ts'].includes(`timeSeconds:${seconds},deltaSeconds:0`),'Phrasing clock must be frozen');
  return source;
}
const installation=await readDesktopInstallation(),client=new Client({name:'ornament-motion-milestone-qa',version:'1.0.0'});
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
  const current=await call('read');
  // FPS and saved-scene checks must describe the same local candidate as captures.
  for(const [file,text] of Object.entries(candidate.files)){
    const matches=Object.keys(current.source.files).filter(path=>path===file||path.endsWith('/'+file));
    assert.equal(matches.length,1,'Missing/ambiguous candidate source: '+file);
    assert.equal(current.source.files[matches[0]],text,'Build the current local candidate before QA: '+file);
  }
  report.sourceHashes.initial=hash(JSON.stringify(current.source));
  await call('save',{path:scenePath,expectedDraftVersion:current.draftVersion,overwrite:false});saved=true;
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

  let zeroPixels;
  report.checkpointControls=initial.authoring.controls;report.motionComparisons={};
  for(const seconds of checkpointSeconds){
    const diagnostic=freeze(seconds);await writeFile(join(output,`source-${seconds}s.json`),JSON.stringify(diagnostic,null,2));
    await build(diagnostic);await patch(initial.authoring.controls);await reset();await status(11);
    const pixels=await capture(`checkpoint-${seconds}s`);
    if(!zeroPixels)zeroPixels=pixels;else report.motionComparisons[seconds]=compare(zeroPixels,pixels);
  }
  report.checks.push(`Frozen source checkpoints captured at ${checkpointSeconds.join(', ')} seconds with the initial public controls`);
  const lastSeconds=checkpointSeconds.at(-1);
  for(const seed of [7,19,43]){await patch({seed});await reset();await capture(`seed-${seed}-${lastSeconds}s`);}
  await patch({seed:7,ornamentSize:1.5});await reset();await capture(`detail-large-regions-${lastSeconds}s`);
  report.detailControls={seed:7,ornamentSize:1.5,diagnosticSeconds:lastSeconds};

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
  report.ok=true;
}catch(error){report.failure=error.stack??String(error);process.exitCode=1;}
finally{
  if(saved&&connected){try{await reopen();await playback(initial.authoring.playback==='playing'?'play':'pause');const restored=await status(11);assert.deepEqual(restored.authoring.controls,initial.authoring.controls);report.restored={playback:restored.authoring.playback,revisionId:restored.authoring.revisionId};}catch(error){report.ok=false;report.restorationFailure=error.stack??String(error);process.exitCode=1;}}
  await writeFile(join(output,'result.json'),JSON.stringify(report,null,2));await client.close();
  console.log(JSON.stringify({ok:report.ok,output,scenePath,measuredFps:report.performance?.measuredFps,motionComparisons:report.motionComparisons,failure:report.failure,restorationFailure:report.restorationFailure},null,2));
}
