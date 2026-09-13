import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {normalizeComponentDeclaration,canonicalComponentMetadataJson} from '../../packages/runtime-contracts/src/components.mjs';
import {canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import {linkedBody} from '../../apps/build-worker/src/artifact-identity.mjs';
import {deriveAssets} from '../../packages/assets/src/index.mjs';
import {declaration} from '../compiler/component-fixture.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const metadata=normalizeComponentDeclaration(declaration);
const bundle=(await build({entryPoints:[fileURLToPath(new URL('../../apps/studio/src/visual-worker.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',logLevel:'silent'})).outputFiles[0].text;
async function fixture({mutation='',declared=JSON.stringify(metadata),create='',update='',evaluate='return {image:await context.render({}, {})};',reset='',dispose='',targetDispose='',rendererDispose='',profile=metadata,backendGate=false,queueGate=false,renderFailure=false,initGate=false,captureGate=false}={}){
 const events=[],messages=[],frames=[],blobs=new Map(),intervals=new Map();let imports=0;
 let finishBackend,finishQueue,finishLifecycle,loseDevice;
 const backendWait=new Promise(r=>finishBackend=r),queueWait=new Promise(r=>finishQueue=r),lifecycleWait=new Promise(r=>finishLifecycle=r);
 const device={lost:new Promise(r=>loseDevice=()=>r({message:'test loss'})),features:new Set(),queue:{async onSubmittedWorkDone(){events.push('queue-start');if(queueGate)await queueWait;events.push('queue');}},destroy(){events.push('device-dispose');}};
 const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,Uint8ClampedArray,ArrayBuffer,Blob,crypto:webcrypto,onmessage:null,performance:{now:()=>0},postMessage:m=>{messages.push(structuredClone(m));events.push(m.type);},setTimeout:()=>1,clearTimeout(){},setInterval:(f,ms)=>{intervals.set(ms,f);return ms;},clearInterval:id=>intervals.delete(id),close:()=>events.push('close'),record:e=>events.push(e),recordFrame:f=>frames.push(structuredClone(f)),URL:{createObjectURL:b=>{blobs.set('blob:actual',b);return 'blob:actual';},revokeObjectURL:u=>blobs.delete(u)},navigator:{gpu:{requestAdapter:async()=>({features:new Set(),requestDevice:async()=>device})}}});
 vm.runInContext('const parseForHarness=JSON.parse;globalThis.deliver=raw=>onmessage({data:parseForHarness(raw)});',context);
 context.waitBackend=()=>backendWait;
 context.waitLifecycle=()=>lifecycleWait;
 const code=`${mutation}
 export class WebGPURenderer {backend={isWebGPUBackend:true};setSize(){}async init(){record('renderer-init');${initGate?'await waitLifecycle();':''}}setRenderTarget(t){record(t?'target':'restore');}async render(){record('write');${backendGate?'await waitBackend();':''}${renderFailure?"throw Error('backend failed');":''}record('write-complete');}dispose(){record('renderer-dispose');${rendererDispose}}async readRenderTargetPixelsAsync(){record('capture-target');${captureGate?'await waitLifecycle();':''}return new Uint8Array(1920*1080*4);}}
 export class RenderTarget {texture={};dispose(){record('target-dispose');${targetDispose}}}export const SRGBColorSpace='srgb';
 export class MeshBasicNodeMaterial {dispose(){record('material-dispose');}}export class QuadMesh {constructor(material){this.material=material;}render(){record('present');}}export const sampleTexture=()=>({});
 export default {kind:'component',sdkVersion:'0.3.0',metadata:${declared},async create(context){record('create');${create}return {update(frame){record('update');recordFrame(frame);${update}},async evaluate(inputs,context){record('evaluate');${evaluate}},reset(seed){record('reset');${reset}},dispose(){record('authored-dispose');${dispose}}};}};`;
 const body=linkedBody({linkedVersion:4,sdkVersion:'0.3.0',executionModel:'single-image-source-v1',component:profile,componentMetadataHash:hash(canonicalComponentMetadataJson(profile)),controls:profile.controls,controlSchemaHash:hash(canonicalControlSchemaJson(profile.controls)),code,sourceMap:'',bundleHash:'a'.repeat(64),linker:{version:'0.28.2',implementationHash:'a'.repeat(64),apiHash:'b'.repeat(64),binaryHash:'c'.repeat(64)},...await deriveAssets({},hash)});
 const linked={...body,linkedHash:hash(JSON.stringify(body))};
 const module=new vm.SourceTextModule(bundle,{context,importModuleDynamically:async url=>{imports++;events.push('import');const actual=await blobs.get(url).text();assert.equal(actual,linked.code,'evaluate the verified envelope bytes');const authored=new vm.SourceTextModule(actual,{context});await authored.link(()=>{throw Error('External fixture import');});await authored.evaluate();return authored;}});
 await module.link(()=>{throw Error('External worker import');});await module.evaluate();
 const identity={instanceId:'instance',generation:1,revisionId:'revision'};
 const initial={...identity,type:'init',requestId:'init',linked,canvas:{},settings:{width:1920,height:1080,fps:60,seed:3},sdkVersion:'0.3.0',controlSchema:metadata.controls,controlSchemaHash:hash(canonicalControlSchemaJson(metadata.controls)),controls:{speed:1},playing:false,performanceMode:'baseline'};
 const post=message=>context.deliver(JSON.stringify({...identity,...message}));
 const flush=async()=>{await new Promise(r=>setTimeout(r,30));};
 async function send(message){const n=messages.length;post(message);const response=()=>messages.slice(n).find(m=>m.type!=='heartbeat'&&m.type!=='cleanup');for(let i=0;i<500&&!response();i++)await new Promise(r=>setTimeout(r,1));assert.ok(response(),JSON.stringify(messages));return response();}
 const until=async event=>{for(let i=0;i<500&&!events.includes(event);i++)await new Promise(r=>setTimeout(r,1));assert.ok(events.includes(event),`${event}: ${events}`);};
 return {initial,post,send,flush,until,events,messages,frames,imports:()=>imports,finishBackend,finishQueue,finishLifecycle,loseDevice,holdQueue:()=>queueGate=true};
}
test('device loss during a post-init update retains resources until settlement and prevents evaluation',async()=>{
 const f=await fixture({update:"if(frame.tick>0){record('update-wait');return waitLifecycle();}"});await f.send(f.initial);
 f.post({type:'frame',requestId:'later'});await f.until('update-wait');f.loseDevice();await f.until('failure');await f.flush();
 assert.ok(!f.events.includes('authored-dispose'),'pending update retains authored instance');assert.ok(!f.events.includes('target-dispose'));
 f.finishLifecycle();await f.until('device-dispose');assert.equal(f.events.filter(e=>e==='evaluate').length,1);assert.equal(f.events.filter(e=>e==='present').length,1);assert.equal(f.messages.filter(m=>m.type==='frame').length,0);assert.equal(f.messages.filter(m=>m.type==='failure').length,1);
});
test('device loss during frame queue completion prevents late frame publication',async()=>{
 const f=await fixture();await f.send(f.initial);f.events.length=0;f.holdQueue();f.post({type:'frame',requestId:'later'});await f.until('queue-start');f.loseDevice();await f.until('failure');await f.flush();assert.ok(!f.events.includes('target-dispose'));
 f.finishQueue();await f.until('device-dispose');assert.equal(f.messages.filter(m=>m.type==='frame').length,0);assert.equal(f.messages.filter(m=>m.type==='failure').length,1);
});
test('device loss during reset or readback drains the command before cleanup and publishes no late result',async()=>{
 for(const capture of [false,true]){
  const f=await fixture(capture?{captureGate:true}:{reset:"record('reset-wait');return waitLifecycle();"});await f.send(f.initial);f.events.length=0;
  f.post(capture?{type:'capture',requestId:'late'}:{type:'playback',action:'reset'});await f.until(capture?'capture-target':'reset-wait');f.loseDevice();await f.until('failure');await f.flush();assert.ok(!f.events.includes('authored-dispose'));assert.ok(!f.events.includes('target-dispose'));
  f.finishLifecycle();await f.until('device-dispose');assert.ok(!f.events.includes('evaluate'));assert.ok(!f.events.includes('capture'));assert.ok(!f.events.includes('status'));assert.equal(f.messages.filter(m=>m.type==='failure').length,1);
 }
});
test('device loss during renderer initialization prevents factory creation after settlement',async()=>{
 const f=await fixture({initGate:true});f.post(f.initial);await f.until('renderer-init');f.loseDevice();await f.until('failure');assert.ok(!f.events.includes('renderer-dispose'));f.finishLifecycle();await f.until('device-dispose');assert.ok(!f.events.includes('create'));assert.ok(!f.events.includes('ready'));
});
test('real worker executes submitted v4 code: heartbeat, update, evaluate, validated presentation, queue, ready and same-target capture',async()=>{
 const f=await fixture();assert.equal((await f.send(f.initial)).type,'ready');
 for(const [a,b] of [['heartbeat','import'],['import','create'],['update','evaluate'],['write','restore'],['restore','present'],['present','queue'],['queue','ready']])assert.ok(f.events.indexOf(a)<f.events.indexOf(b),`${a} before ${b}: ${f.events}`);
 const changed=await f.send({type:'controls',controlSequence:1,controlSchemaHash:f.initial.controlSchemaHash,values:{speed:2}});assert.equal(changed.type,'status');assert.equal(f.frames.at(-1).timeSeconds,0);assert.equal(f.frames.at(-1).controls.speed,2);assert.equal(f.events.filter(x=>x==='create').length,1);assert.ok(!f.events.includes('reset'));
 const capture=await f.send({type:'capture',requestId:'capture'});assert.equal(capture.type,'capture');assert.equal(capture.metadata.controlSequence,1);assert.ok(f.events.includes('capture-target'));
 f.post({type:'dispose'});await f.flush();f.post({type:'dispose'});await f.flush();for(const e of ['authored-dispose','target-dispose','material-dispose','renderer-dispose','device-dispose'])assert.equal(f.events.filter(x=>x===e).length,1,e);
});
test('message/profile mismatches reject before import; definition disagreement rejects before create',async()=>{
 const message=await fixture();assert.equal((await message.send({...message.initial,sdkVersion:'0.2.0'})).type,'failure');assert.equal(message.imports(),0);
 const profile=await fixture({profile:{...metadata,inputs:metadata.outputs}});assert.equal((await profile.send(profile.initial)).type,'failure');assert.equal(profile.imports(),0);
 const definition=await fixture({declared:JSON.stringify({...metadata,label:'Mismatch'})});assert.equal((await definition.send(definition.initial)).type,'failure');assert.equal(definition.imports(),1);assert.ok(!definition.events.includes('create'));
});
test('partial and terminal failures retain original errors and attempt independent cleanup once',async()=>{
 for(const options of [{create:"throw Error('primary');"},{create:"return {dispose(){record('authored-dispose')}};"},{update:"throw Error('primary');"},{evaluate:"throw Error('primary');"},{evaluate:'return {image:{}};'},{dispose:"throw Error('dispose failure');",targetDispose:"throw Error('target failure');"}]){
  const f=await fixture(options);const response=await f.send(f.initial);if(options.dispose)f.post({type:'dispose'});else {assert.equal(response.type,'failure');assert.ok(!f.events.includes('present'));}
  await f.flush();f.post({type:'dispose'});await f.flush();
  for(const e of ['target-dispose','material-dispose','renderer-dispose','device-dispose'])assert.equal(f.events.filter(x=>x===e).length,1,e);
  assert.equal(f.events.filter(x=>x==='authored-dispose').length,options.create?.startsWith('throw')?0:1);
 }
});
test('post-import captured descriptor and resource checks survive modified validation globals',async()=>{
 const mutation="Object.getOwnPropertyDescriptor=()=>({value:undefined});Reflect.ownKeys=()=>[];JSON.stringify=()=>'';Object.freeze=x=>x;WeakMap.prototype.get=()=>({});WeakMap.prototype.set=()=>{};WeakMap=function(){throw Error('mutable constructor');};";
 const f=await fixture({mutation,declared:JSON.stringify({...metadata,label:'Mismatch'})});assert.equal((await f.send(f.initial)).type,'failure');assert.ok(!f.events.includes('create'));
 const token=await fixture({mutation,evaluate:'return {image:{}};'});assert.equal((await token.send(token.initial)).type,'failure');assert.ok(!token.events.includes('present'));
});
test('abandoned backend and GPU work delay cleanup independently; failure never presents or permits capture',async()=>{
 for(const evaluate of ["context.render({},{});throw Error('primary');",'context.render({},{});return {};']){
  const f=await fixture({backendGate:true,queueGate:true,evaluate});const failure=await f.send(f.initial);assert.equal(failure.type,'failure');
  assert.ok(f.events.includes('write'));assert.ok(!f.events.includes('queue-start'));assert.ok(!f.events.includes('authored-dispose'));assert.ok(!f.events.includes('present'));
  f.post({type:'capture',requestId:'late-capture'});await f.flush();assert.ok(!f.events.includes('capture-target'));
  f.finishBackend();await f.flush();assert.ok(f.events.includes('restore'));assert.ok(f.events.includes('queue-start'));assert.ok(!f.events.includes('queue'));assert.ok(!f.events.includes('target-dispose'));
  f.finishQueue();await f.flush();assert.ok(f.events.indexOf('queue')<f.events.indexOf('authored-dispose'));assert.ok(f.events.indexOf('authored-dispose')<f.events.indexOf('target-dispose'));assert.equal(f.messages.filter(x=>x.type==='failure').length,1);assert.ok(!f.events.includes('ready'));
 }
});
test('explicit resets run individually, preserve controls, and reset rejection terminates once with the primary error',async()=>{
 const f=await fixture();await f.send(f.initial);for(let i=0;i<2;i++)assert.equal((await f.send({type:'playback',action:'reset'})).type,'status');assert.equal(f.events.filter(x=>x==='reset').length,2);assert.equal(f.frames.at(-1).controls.speed,1);
 const bad=await fixture({reset:"throw Error('reset primary');"});await bad.send(bad.initial);const failure=await bad.send({type:'playback',action:'reset'});assert.equal(failure.type,'failure');assert.equal(failure.message,'reset primary');await bad.flush();assert.equal(bad.events.filter(x=>x==='authored-dispose').length,1);
});
test('backend rejection restores target; forced termination remains separate from graceful cleanup',async()=>{
 const rejected=await fixture({renderFailure:true});assert.equal((await rejected.send(rejected.initial)).type,'failure');assert.ok(rejected.events.includes('restore'));assert.ok(!rejected.events.includes('present'));
 const stuck=await fixture({create:'await new Promise(()=>{});'});stuck.post(stuck.initial);await stuck.flush();assert.ok(stuck.events.includes('create'));assert.ok(!stuck.events.includes('authored-dispose'));assert.ok(!stuck.events.includes('ready'));
 // This VM is abandoned like a terminated worker. No graceful acknowledgment,
 // authored disposal, backend settlement or GPU drain is inferred from it.
});
