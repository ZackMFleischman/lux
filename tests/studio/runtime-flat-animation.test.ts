import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {StandaloneClient} from '../../apps/studio/src/standalone-client.ts';
import {StudioController, getRuntimeControlState} from '../../apps/studio/src/service-client.ts';
import {studioOperationSchema} from '../../apps/studio/src/runtime-operations.ts';
import {normalizeControlDeclarations,canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import {validateSource} from '../../apps/build-worker/src/source-policy.mjs';
import {linkedBody} from '../../apps/build-worker/src/artifact-identity.mjs';
import {deriveAssets} from '../../packages/assets/src/index.mjs';

const hash=(value:any)=>createHash('sha256').update(value).digest('hex');
const schema=normalizeControlDeclarations({height:{type:'number',label:'Height',default:1,min:0,max:4},speed:{type:'number',label:'Speed',default:.5,min:0,max:2}});
const schemaHash=hash(canonicalControlSchemaJson(schema));
const source={sdkVersion:'0.2.0' as const,entry:'main.ts',files:{'main.ts':'test source'}};
const binding=(amount=1)=>({nodePath:[] as const,definitionHash:schemaHash,schemaHash,controlId:'height',shape:'sine' as const,periodSeconds:2,amount,phase:.25,enabled:true});

class FlatWorker {
  static all:FlatWorker[]=[];
  onmessage:any;onerror:any;messages:any[]=[];init:any;
  constructor(){FlatWorker.all.push(this);}
  postMessage(message:any){
    this.messages.push(message);
    if(message.type==='init'){
      this.init=message;
      queueMicrotask(()=>this.reply({type:'ready',effectiveControls:{height:2,speed:.5}}));
    }
  }
  reply(extra:any={}){
    this.onmessage?.({data:{...this.init,type:'status',frameId:'1',timeSeconds:0,clockEpoch:0,controlSequence:0,
      playback:this.init.playing?'playing':'paused',controls:this.init.controls,effectiveControls:this.init.controls,
      controlAnimations:this.init.controlAnimations??[],controlAnimationIssues:[],animationSequence:0,...extra}});
  }
  terminate(){}
}

async function fixture(t:any){
  const originals=new Map(['Worker','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperty(globalThis,'Worker',{value:FlatWorker,configurable:true});
  Object.defineProperty(globalThis,'document',{value:{createElement:()=>({style:{},transferControlToOffscreen:()=>({}),remove(){}})},configurable:true});
  FlatWorker.all=[];
  const client=new StandaloneClient({compile:async(input:any)=>{
    const body=linkedBody({linkedVersion:3,code:'accepted',sourceMap:'{}',bundleHash:'b'.repeat(64),linker:{version:'0.28.2',implementationHash:'c'.repeat(64),apiHash:'d'.repeat(64),binaryHash:'e'.repeat(64)},...await deriveAssets({},hash),controls:schema,controlSchemaHash:schemaHash});
    return {ok:true,sourceHash:hash(JSON.stringify(validateSource(input))),linked:{...body,linkedHash:hash(JSON.stringify(body))}};
  }} as any,{codeDeclaredParameters:true});
  t.after(()=>{const runtime=(client as any).running;if(runtime)(client as any).stop(runtime,'test complete');for(const [key,value] of originals)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
  return client;
}

test('animation operation schema admits the empty scene path',()=>{
  const target={requestId:'animation',instanceId:'instance',expectedGeneration:1,expectedRevisionId:'revision',expectedControlSchemaHash:schemaHash,controlId:'height',animation:binding()};
  assert.equal(studioOperationSchema.safeParse({name:'lux.node.animation.set',input:{...target,nodePath:[]}}).success,true);
  assert.equal(studioOperationSchema.safeParse({name:'lux.node.animation.set',input:{...target,nodePath:['not valid']}}).success,false);
});

test('flat runtime keeps base controls while accepting guarded animation state and rejecting stale or forged targets',async t=>{
  const client=await fixture(t),saved=binding();
  await client.submit(source,{savedControlAnimations:[saved]});
  const worker=FlatWorker.all.at(-1)!,initial=client.getSnapshot().authoring!;
  assert.deepEqual(worker.init.controlAnimations,[saved]);
  assert.deepEqual(getRuntimeControlState(initial).controlAnimations,[saved]);
  assert.deepEqual(getRuntimeControlState(initial).effectiveControls,{height:2,speed:.5});

  let request=0;const controller=new StudioController(client,()=> `animation-${++request}`),next=binding(2),latest=binding(3);
  let firstSettled=false,secondSettled=false;
  const write=controller.setNodeAnimation([],'height',next).then(()=>{firstSettled=true;});
  const secondWrite=controller.setNodeAnimation([],'height',latest).then(()=>{secondSettled=true;});
  assert.deepEqual(worker.messages.at(-2),{type:'animations',requestId:'animation-1',instanceId:initial.instanceId,generation:initial.generation,animationSequence:1,controlAnimations:[next]});
  assert.deepEqual(worker.messages.at(-1),{type:'animations',requestId:'animation-2',instanceId:initial.instanceId,generation:initial.generation,animationSequence:2,controlAnimations:[latest]});
  worker.reply({requestId:'animation-1',effectiveControls:{height:1.25,speed:.5},controlAnimations:[binding(.25)],animationSequence:1});
  await Promise.resolve();
  assert.equal(firstSettled,false,'a mismatched pending acknowledgement cannot resolve its write');
  assert.equal(secondSettled,false);
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).controlAnimations,[saved],'a mismatched pending acknowledgement cannot publish');
  worker.reply({requestId:'animation-1',effectiveControls:{height:3,speed:.5},controlAnimations:[next],animationSequence:1});
  await write;
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).controls,{height:1,speed:.5});
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).effectiveControls,{height:3,speed:.5});

  worker.reply({effectiveControls:{height:2.5,speed:.5},controlAnimations:[next],animationSequence:1});
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).effectiveControls,{height:2.5,speed:.5},'render frames may resample the accepted binding');
  worker.reply({effectiveControls:{height:1.25,speed:.5},controlAnimations:[binding(.25)],animationSequence:1});
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).effectiveControls,{height:2.5,speed:.5},'equal animation sequences cannot substitute different bindings');

  worker.reply({requestId:'animation-2',effectiveControls:{height:1.25,speed:.5},controlAnimations:[binding(.25)],animationSequence:2});
  await Promise.resolve();
  assert.equal(secondSettled,false,'a mismatched pending acknowledgement cannot resolve the write');
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).controlAnimations,[next],'a mismatched pending acknowledgement cannot publish');
  worker.reply({requestId:'animation-2',effectiveControls:{height:4,speed:.5},controlAnimations:[latest],animationSequence:2});
  await secondWrite;
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).controlAnimations,[latest]);

  worker.reply({effectiveControls:{height:2,speed:.5},controlAnimations:[saved],animationSequence:0});
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).controlAnimations,[latest]);
  worker.reply({effectiveControls:{height:99,speed:.5},controlAnimations:[latest],animationSequence:2});
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).effectiveControls,{height:4,speed:.5});
  worker.reply({effectiveControls:{height:4,speed:.5},controlAnimations:[{...latest,nodePath:['forged']}],animationSequence:3});
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).effectiveControls,{height:4,speed:.5});
  await assert.rejects(controller.setNodeAnimation([],'height',{...latest,schemaHash:'0'.repeat(64)}),/identity/i);

  const document:any=client.acceptedDocument();
  assert.deepEqual(document.controls.values,{height:1,speed:.5},'saved controls must exclude the sampled animation value');
  assert.deepEqual(document.controlAnimations,[latest]);
});

test('legacy runtime state preserves scene animation fields',()=>{
  const legacy:any={sdkVersion:'0.1.0',intensity:.5,effectiveControls:{intensity:.75},controlAnimations:[{...binding(),definitionHash:'2f686a688523e2aa6e5368cd286974b87b324cfa4c67507563658b25cadd5a87',schemaHash:'2f686a688523e2aa6e5368cd286974b87b324cfa4c67507563658b25cadd5a87',controlId:'intensity'}],controlAnimationIssues:[],animationSequence:3};
  const state=getRuntimeControlState(legacy);
  assert.deepEqual(state.effectiveControls,{intensity:.75});
  assert.equal(state.animationSequence,3);
  assert.equal(state.controlAnimations?.length,1);
});
