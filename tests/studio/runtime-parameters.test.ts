import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {StandaloneClient} from '../../apps/studio/src/standalone-client.ts';
import {normalizeControlDeclarations,canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import {validateSource} from '../../apps/build-worker/src/source-policy.mjs';
import {linkedBody} from '../../apps/build-worker/src/artifact-identity.mjs';
import {deriveAssets} from '../../packages/assets/src/index.mjs';
const hash=(value:any)=>createHash('sha256').update(value).digest('hex');
const schema=normalizeControlDeclarations({height:{type:'number',label:'Height',default:1,min:0,max:4},speed:{type:'number',label:'Speed',default:0.5,min:0,max:2}});
const schemaHash=hash(canonicalControlSchemaJson(schema));
const source={sdkVersion:'0.2.0' as const,entry:'main.ts',files:{'main.ts':'test source'}};
class WorkerFixture {
  static all:WorkerFixture[]=[]; static failNext=false;
  onmessage:any; onerror:any; messages:any[]=[]; init:any;terminated=false;
  constructor(){WorkerFixture.all.push(this);}
  postMessage(message:any){this.messages.push(message);if(message.type==='init'){this.init=message;queueMicrotask(()=>{if(WorkerFixture.failNext){WorkerFixture.failNext=false;this.reply({type:'failure',message:'candidate failed'});}else this.reply({type:'ready'});});}}
  reply(extra:any){this.onmessage?.({data:{...this.init,type:'status',frameId:'1',timeSeconds:0,clockEpoch:0,controlSequence:0,playback:'paused',...extra}});}
  terminate(){this.terminated=true;}
}
async function fixture(t:any,enabled=true){
  const originals=new Map(['Worker','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperty(globalThis,'Worker',{value:WorkerFixture,configurable:true});
  Object.defineProperty(globalThis,'document',{value:{createElement:()=>({style:{},transferControlToOffscreen:()=>({}),remove(){}})},configurable:true});
  WorkerFixture.all=[];WorkerFixture.failNext=false;let compiles=0;
  const client=new StandaloneClient({compile:async(input:any)=>{
    compiles++;const body=linkedBody({linkedVersion:3,code:'accepted',sourceMap:'{}',bundleHash:'b'.repeat(64),linker:{version:'0.28.2',implementationHash:'c'.repeat(64),apiHash:'d'.repeat(64),binaryHash:'e'.repeat(64)},...await deriveAssets({},hash),controls:schema,controlSchemaHash:schemaHash});
    return {ok:true,sourceHash:hash(JSON.stringify(validateSource(input))),linked:{...body,linkedHash:hash(JSON.stringify(body))}};
  }} as any,{codeDeclaredParameters:enabled});
  t.after(()=>{const runtime=(client as any).running;if(runtime)(client as any).stop(runtime,'test complete');for(const [key,value]of originals)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
  const operation=(values:any,extra:any={})=>{const runtime=client.getSnapshot().authoring!;return{name:'lux.parameters.set' as const,input:{requestId:crypto.randomUUID(),instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedControlSchemaHash:schemaHash,values,mode:'live' as const,...extra}};};
  return {client,operation,worker:()=>WorkerFixture.all.at(-1)!,compiles:()=>compiles};
}
test('SDK 0.2 activation is explicitly gated while legacy UI integration is incomplete',async t=>{
  const f=await fixture(t,false);await assert.rejects(f.client.submit(source),/code.declared.*not.*enabled/i);assert.equal(f.compiles(),0);assert.equal(WorkerFixture.all.length,0);
});
test('saved values enter the first candidate frame and generic patches preserve admitted keys atomically',async t=>{
  const f=await fixture(t);await f.client.submit(source,{savedControls:{sourceHash:'a'.repeat(64),schema,schemaHash,values:{height:3,speed:1}}});
  assert.deepEqual(f.worker().init.controls,{height:3,speed:1});assert.deepEqual(f.client.getSnapshot().authoring!.controls,{height:3,speed:1});
  assert.equal('intensity' in f.client.getSnapshot().authoring!,false);
  const w=f.worker();let firstDone=false;const first=f.client.invoke(f.operation({height:2})).then(()=>{firstDone=true;}), second=f.client.invoke(f.operation({speed:1.5}));
  const one=w.messages.at(-2),two=w.messages.at(-1);assert.deepEqual(one.values,{height:2,speed:1});assert.deepEqual(two.values,{height:2,speed:1.5});
  const count=w.messages.length;
  await assert.rejects(f.client.invoke(f.operation({height:1,speed:99})),/speed/);
  await assert.rejects(f.client.invoke(f.operation({height:1},{expectedControlSchemaHash:'f'.repeat(64)})),/schema/i);
  await assert.rejects(f.client.invoke(f.operation({height:1},{expectedControlSchemaHash:undefined})),/schema/i);
  assert.equal(w.messages.length,count);assert.deepEqual(f.client.getSnapshot().authoring!.controls,{height:3,speed:1});
  w.reply({requestId:one.requestId,controls:{height:3,speed:1},controlSequence:0});await new Promise(resolve=>setImmediate(resolve));assert.equal(firstDone,false,'stale frame must not acknowledge newer parameter intent');
  w.reply({requestId:one.requestId,controls:one.values,controlSequence:1});await first;
  w.reply({requestId:two.requestId,controls:two.values,controlSequence:2});await second;
  assert.deepEqual(f.client.getSnapshot().authoring!.controls,{height:2,speed:1.5});
  const capture=f.client.capture(),captureRequest=w.messages.at(-1);w.reply({type:'capture',requestId:captureRequest.requestId,bytes:new ArrayBuffer(4),metadata:{controls:two.values,controlSchemaHash:schemaHash,controlSequence:2,frameId:'1'}});
  assert.deepEqual((await capture).metadata.controls,two.values);
});
test('failed candidates retain schema/values and restart restores admitted intent without recompiling',async t=>{
  const f=await fixture(t);await f.client.submit(source);const original=f.client.getSnapshot().authoring!,old=f.worker();
  WorkerFixture.failNext=true;await assert.rejects(f.client.submit({...source,files:{'main.ts':'changed'}}),/candidate failed/);
  assert.equal(f.client.getSnapshot().authoring,original);assert.equal(old.terminated,false);
  const pending=assert.rejects(f.client.invoke(f.operation({height:3})),/render failed/);old.reply({type:'failure',message:'render failed'});await pending;
  assert.equal(f.client.getSnapshot().authoring!.controls!.height,1);
  const compiles=f.compiles();await f.client.invoke({name:'lux.runtime.restart',input:{requestId:'restart',instanceId:original.instanceId,expectedGeneration:original.generation}});
  assert.equal(f.compiles(),compiles);assert.deepEqual(f.worker().init.controls,{height:3,speed:0.5});assert.deepEqual(f.client.getSnapshot().authoring!.controls,{height:3,speed:0.5});
});
