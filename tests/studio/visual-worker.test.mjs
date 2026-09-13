import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { canonicalControlSchemaJson, normalizeControlDeclarations } from '../../packages/runtime-contracts/src/parameters.mjs';
const schema=normalizeControlDeclarations({height:{type:'number',label:'Height',default:1,min:0,max:4},speed:{type:'number',label:'Speed',default:0.5,min:0,max:2}});
const hash=value=>createHash('sha256').update(value).digest('hex');
const bundle=(await build({entryPoints:[fileURLToPath(new URL('../../apps/studio/src/visual-worker.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',logLevel:'silent'})).outputFiles[0].text;
async function fixture(controls=schema,declared=controls,mutation='',sdkVersion='0.2.0',timed=false,gpuTimed=false) {
  const messages=[],frames=[],intervals=new Map(),scheduled=[];let created=0,imports=0,now=0;
  const requested=[];
  const device={lost:new Promise(()=>{}),features:new Set(gpuTimed?['timestamp-query']:[]),pushErrorScope(){},popErrorScope:async()=>null,queue:{onSubmittedWorkDone:async()=>{if(timed)now+=17;},submit(){}},destroy(){},
    createQuerySet(){return {destroy(){}};},createBuffer(){return {mapAsync:async()=>{},getMappedRange:()=>new BigUint64Array([100n,1000100n]).buffer,unmap(){},destroy(){}};},
    createCommandEncoder(){return {beginRenderPass:()=>({end(){}}),beginComputePass:()=>({end(){}}),resolveQuerySet(){},copyBufferToBuffer(){},finish:()=>({})};}};
  const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,Uint8ClampedArray,ArrayBuffer,Blob,crypto:webcrypto,performance:{now:()=>now},onmessage:null,
    postMessage:message=>messages.push(structuredClone(message)),setTimeout:(fn,ms)=>{scheduled.push(ms);return 1;},clearTimeout(){},setInterval:(callback,ms)=>{intervals.set(ms,callback);return ms;},clearInterval:id=>intervals.delete(id),close(){},
    URL:{createObjectURL:()=> 'memory:visual',revokeObjectURL(){}},
    navigator:{gpu:{requestAdapter:async()=>({features:new Set(['timestamp-query']),requestDevice:async options=>{requested.push(options);return device;}})}},
    gpuDraw(){const e=device.createCommandEncoder();e.beginRenderPass({}).end();device.queue.submit([e.finish()]);},
    recordCreate:()=>created++,recordFrame:frame=>{frames.push(structuredClone(frame));if(timed)now+=3;},advanceClock:ms=>{now+=ms;},
    ImageData:class{},OffscreenCanvas:class{getContext(){return {putImageData(){}}}async convertToBlob(){return new Blob(['png']);}},
  });
  vm.runInContext('const parseForHarness=JSON.parse; globalThis.deliver=raw=>onmessage({data:parseForHarness(raw)});',context);
  const visualCode=`${mutation}
    export class WebGPURenderer {backend={isWebGPUBackend:true};setSize(){}async init(){}setRenderTarget(){}render(){}dispose(){}async readRenderTargetPixelsAsync(){return new Uint8Array(4);}}
    export class RenderTarget{texture={};dispose(){}} export const SRGBColorSpace='srgb';
    export class MeshBasicNodeMaterial {dispose(){}} export class QuadMesh {constructor(material){this.material=material;}render(){}} export const sampleTexture=()=>({});
    export default {sdkVersion:${JSON.stringify(sdkVersion)},controls:${typeof declared==='string'?declared:JSON.stringify(declared)},async create(){recordCreate();return {update(frame){recordFrame(frame)},${gpuTimed?'render(){gpuDraw();}':timed?'async render(){advanceClock(7);await Promise.resolve();advanceClock(11);}':'render(){}'},reset(){},dispose(){}}}};`;
  const module=new vm.SourceTextModule(bundle,{context,importModuleDynamically:async()=>{
    imports++;const visual=new vm.SourceTextModule(visualCode,{context});await visual.link(()=>{throw Error('Unexpected import')});await visual.evaluate();return visual;
  }});
  await module.link(()=>{throw Error('Unexpected bundled import')});await module.evaluate();
  const identity={instanceId:'instance',generation:1,revisionId:'revision'};
  const initial={type:'init',requestId:'init',...identity,moduleSource:'fixture',canvas:{},settings:{width:1920,height:1080,fps:60,seed:0},sdkVersion,controlSchema:controls,controlSchemaHash:hash(canonicalControlSchemaJson(controls)),controls:Object.fromEntries(controls.map(row=>[row.id,row.default])),playing:false};
  async function send(message){const before=messages.length;context.deliver(JSON.stringify({...identity,...message}));for(let i=0;i<200 && messages.length===before;i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(messages.length>before,'worker must respond');return messages.at(-1);}
  return {send,initial,messages,frames,requested,scheduled,created:()=>created,imports:()=>imports,telemetry(){now=500;intervals.get(500)?.();return messages.at(-1);},intervals};
}

test('actual worker requests timestamp support and publishes a fresh correlated GPU pass result',async()=>{
 const f=await fixture(schema,schema,'','0.2.0',false,true);await f.send(f.initial);for(let i=0;i<10;i++)await Promise.resolve();
 assert.deepEqual(structuredClone(f.requested),[{requiredFeatures:['timestamp-query']}]);
 const gpu=f.telemetry().summary.gpu;assert.equal(gpu.timestampQueryEnabled,true);assert.equal(gpu.p95,1);assert.equal(gpu.sampleCount,1);assert.equal(gpu.failedSamples,0);assert.equal(gpu.validity,'complete');
});
test('externally driven worker advances only for explicit frames and existing control draws',async()=>{
 const f=await fixture();await f.send({...f.initial,externallyDriven:true,playing:true});assert.equal(f.frames.length,1);assert.deepEqual(f.scheduled,[]);
 const frame=await f.send({type:'frame',requestId:'external-frame'});assert.equal(frame.type,'frame');assert.equal(frame.requestId,'external-frame');assert.equal(f.frames.length,2);assert.deepEqual(f.scheduled,[]);
 await f.send({type:'controls',controlSequence:1,controlSchemaHash:f.initial.controlSchemaHash,values:{height:2,speed:1}});assert.equal(f.frames.length,3);assert.deepEqual(f.scheduled,[]);
 const normal=await fixture();await normal.send({...normal.initial,playing:true});assert.equal(normal.scheduled.length,1);
});

test('actual worker reports separate CPU calls, asynchronous render wait, queue wait and honest GPU capability',async()=>{
  const f=await fixture(schema,schema,'','0.2.0',true);await f.send(f.initial);
  const message=f.telemetry();assert.equal(message.type,'performance');
  assert.equal(message.summary.update.p95,3);assert.equal(message.summary.renderCall.p95,7);
  assert.equal(message.summary.renderAwait.p95,11);assert.equal(message.summary.queueWait.p95,17);
  assert.equal(message.summary.cpuCall.p95,10);assert.equal(message.summary.cpuCall.validity,'incomplete');
  assert.equal(message.summary.gpu.timestampQuerySupported,true);assert.equal(message.summary.gpu.timestampQueryEnabled,false);
  assert.equal(message.summary.gpu.availability,'unsupported');assert.equal('p95' in message.summary.gpu,false);
  await f.send({type:'controls',controlSequence:1,values:{height:99,speed:1},controlSchemaHash:f.initial.controlSchemaHash});
  assert.equal(f.intervals.has(500),false,'fault releases collector interval');
});
test('actual worker applies complete initial/live controls and captures exact metadata; reset preserves values',async()=>{
  const f=await fixture();const ready=await f.send({...f.initial,controls:{height:3,speed:1}});
  assert.equal(ready.type,'ready',JSON.stringify(ready));assert.deepEqual(ready.controls,{height:3,speed:1});assert.equal('intensity' in ready,false);
  const applied=await f.send({type:'controls',requestId:'set',controlSequence:1,controlSchemaHash:f.initial.controlSchemaHash,values:{height:2,speed:1.5}});
  assert.equal(applied.type,'status');assert.deepEqual(f.frames.at(-1).controls,{height:2,speed:1.5});
  const reset=await f.send({type:'playback',requestId:'reset',action:'reset'});assert.deepEqual(reset.controls,applied.controls);assert.equal(reset.clockEpoch,1);
  const capture=await f.send({type:'capture',requestId:'capture'});assert.equal(capture.type,'capture');assert.deepEqual(capture.metadata.controls,applied.controls);assert.equal(capture.metadata.controlSchemaHash,f.initial.controlSchemaHash);assert.equal(capture.metadata.controlSequence,1);
});
test('actual worker supports empty controls and rejects mismatched metadata before create',async()=>{
  const empty=await fixture([]);assert.equal((await empty.send(empty.initial)).type,'ready');assert.deepEqual(empty.frames[0].controls,{});
  const f=await fixture(schema,[]);const result=await f.send(f.initial);assert.equal(result.type,'failure');assert.match(result.message,/schema/i);assert.equal(f.created(),0);
  const invalid=await fixture();assert.equal((await invalid.send({...invalid.initial,controls:{height:99,speed:1}})).type,'failure');assert.equal(invalid.imports(),0);
});
test('post-import verification survives mutated Object/JSON/Map intrinsics and does not invoke getters',async()=>{
  const mutation=`Object.getOwnPropertyDescriptor=()=>({value:undefined});Object.keys=()=>[];Object.freeze=x=>x;JSON.stringify=()=> '[]';Map=function(){throw Error('mutated Map');};`;
  const f=await fixture(schema,[],mutation);const result=await f.send(f.initial);
  assert.equal(result.type,'failure');assert.match(result.message,/schema/i);assert.equal(f.created(),0);
  const getter=await fixture(schema,`[{...${JSON.stringify(schema[0])},get label(){recordCreate();return 'Height'}},${JSON.stringify(schema[1])}]`);
  assert.equal((await getter.send(getter.initial)).type,'failure');assert.equal(getter.created(),0);
  const valid=await fixture(schema,schema,mutation);assert.equal((await valid.send(valid.initial)).type,'ready');
  assert.equal((await valid.send({type:'controls',requestId:'live',controlSequence:1,controlSchemaHash:valid.initial.controlSchemaHash,values:{height:2,speed:1}})).type,'status');
});
test('legacy worker protocol remains scalar-compatible and invalid generic snapshots cannot draw a partial update',async()=>{
  const legacy=normalizeControlDeclarations({intensity:{type:'number',label:'Intensity',default:0.5,min:0,max:1}});
  const f=await fixture(legacy,legacy,'','0.1.0');const initial={...f.initial};delete initial.sdkVersion;delete initial.controlSchema;delete initial.controlSchemaHash;
  const ready=await f.send(initial);assert.equal(ready.type,'ready');assert.equal(ready.intensity,0.5);
  assert.equal((await f.send({type:'controls',requestId:'legacy',controlSequence:1,values:{intensity:0.8}})).intensity,0.8);
  const generic=await fixture();await generic.send(generic.initial);
  const bad=await generic.send({type:'controls',requestId:'bad',controlSequence:1,controlSchemaHash:generic.initial.controlSchemaHash,values:{height:2,speed:99}});
  assert.equal(bad.type,'failure');assert.equal(generic.frames.length,1);assert.deepEqual(generic.frames[0].controls,{height:1,speed:0.5});
});
