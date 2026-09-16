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
  static autoReady=true;
  onmessage:any;onerror:any;messages:any[]=[];init:any;terminated=false;
  constructor(){FlatWorker.all.push(this);}
  postMessage(message:any){
    this.messages.push(message);
    if(message.type==='init'){
      this.init=message;
      if(FlatWorker.autoReady)queueMicrotask(()=>this.reply({type:'ready',effectiveControls:{height:2,speed:.5}}));
    }
  }
  reply(extra:any={}){
    this.onmessage?.({data:{...this.init,type:'status',frameId:'1',timeSeconds:0,clockEpoch:0,controlSequence:0,
      playback:this.init.playing?'playing':'paused',controls:this.init.controls,effectiveControls:this.init.controls,
      controlAnimations:this.init.controlAnimations??[],controlAnimationIssues:[],animationSequence:0,...extra}});
  }
  terminate(){this.terminated=true;}
}

async function fixture(t:any,compileGate:{wait?:()=>Promise<void>}={}){
  const originals=new Map(['Worker','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperty(globalThis,'Worker',{value:FlatWorker,configurable:true});
  Object.defineProperty(globalThis,'document',{value:{createElement:()=>({style:{},transferControlToOffscreen:()=>({}),remove(){}})},configurable:true});
  FlatWorker.all=[];FlatWorker.autoReady=true;
  const client=new StandaloneClient({compile:async(input:any)=>{
    await compileGate.wait?.();
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

test('animation operation schema accepts exact audio bindings without widening legacy LFOs',()=>{
  const audio={kind:'audio' as const,nodePath:[] as const,definitionHash:schemaHash,schemaHash,controlId:'height',
    source:{kind:'audio-band' as const,logicalInputId:'primary-audio' as const,band:'bass' as const,
      analyzer:{version:1 as const,fftSize:2048 as const,minDecibels:-100,maxDecibels:-30}},
    amount:.5,attackMs:50,releaseMs:400,enabled:true};
  const input={requestId:'audio-animation',instanceId:'instance',expectedGeneration:1,expectedRevisionId:'revision',
    expectedControlSchemaHash:schemaHash,nodePath:[],controlId:'height'};
  assert.equal(studioOperationSchema.safeParse({name:'lux.node.animation.set',input:{...input,animation:audio}}).success,true);
  assert.equal(studioOperationSchema.safeParse({name:'lux.node.animation.set',input:{...input,animation:{...audio,shape:'sine'}}}).success,false);
  assert.equal(studioOperationSchema.safeParse({name:'lux.node.animation.set',input:{...input,animation:{...binding(),kind:'audio'}}}).success,false);
  assert.equal(studioOperationSchema.safeParse({name:'lux.node.animation.set',input:{...input,animation:{...audio,
    source:{...audio.source,analyzer:{...audio.source.analyzer,maxDecibels:-95}}}}}).success,false);
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

test('background build promotes only after the latest compatible controls and animation reach its candidate',async t=>{
  const client=await fixture(t);await client.submit(source);
  const old=FlatWorker.all.at(-1)!,before=client.getSnapshot().authoring!;
  let request=0;const controller=new StudioController(client,()=> `build-animation-${++request}`);
  const pendingControl=client.invoke({name:'lux.parameters.set',input:{requestId:'pending-build-control',instanceId:before.instanceId,
    expectedGeneration:before.generation,expectedRevisionId:before.revisionId,expectedControlSchemaHash:schemaHash,values:{height:2},mode:'live'}});
  const pendingAnimation=controller.setNodeAnimation([],'height',binding(1.5));
  void pendingControl.catch(()=>{});void pendingAnimation.catch(()=>{});
  const pendingControlRequest=old.messages.at(-2)!,pendingAnimationRequest=old.messages.at(-1)!;
  FlatWorker.autoReady=false;
  let promoted=false;
  const build=client.submit({...source,files:{'main.ts':'replacement'}}).then(()=>{promoted=true;});
  for(let i=0;i<200&&FlatWorker.all.length<2;i++)await new Promise(resolve=>setTimeout(resolve,10));
  const candidate=FlatWorker.all.at(-1)!;
  assert.notEqual(candidate,old);assert.deepEqual(candidate.init.controls,{height:1,speed:.5});

  const control=client.invoke({name:'lux.parameters.set',input:{requestId:'build-control',instanceId:before.instanceId,
    expectedGeneration:before.generation,expectedRevisionId:before.revisionId,expectedControlSchemaHash:schemaHash,values:{height:3},mode:'live'}});
  const animation=controller.setNodeAnimation([],'height',binding(2));
  void control.catch(()=>{});void animation.catch(()=>{});
  const controlRequest=old.messages.at(-2)!,animationRequest=old.messages.at(-1)!;
  candidate.reply({type:'ready',effectiveControls:{height:2,speed:.5}});await Promise.resolve();
  assert.equal(promoted,false);assert.equal(old.terminated,false);

  old.reply({requestId:pendingControlRequest.requestId,controls:{height:2,speed:.5},effectiveControls:{height:2,speed:.5},controlSequence:1});
  old.reply({requestId:pendingAnimationRequest.requestId,controls:{height:2,speed:.5},effectiveControls:{height:2,speed:.5},controlSequence:1,
    controlAnimations:[binding(1.5)],animationSequence:1});
  await Promise.all([pendingControl,pendingAnimation]);await Promise.resolve();
  assert.equal(promoted,false,'commands started before the build remain part of the promotion gate');
  const pendingCandidateControl=candidate.messages.at(-1)!;
  assert.equal(pendingCandidateControl.type,'controls');assert.deepEqual(pendingCandidateControl.values,{height:2,speed:.5});
  candidate.reply({requestId:pendingCandidateControl.requestId,controls:pendingCandidateControl.values,effectiveControls:pendingCandidateControl.values,
    controlSequence:pendingCandidateControl.controlSequence});
  for(let i=0;i<8;i++)await Promise.resolve();
  const pendingCandidateAnimation=candidate.messages.at(-1)!;
  assert.equal(pendingCandidateAnimation.type,'animations');assert.deepEqual(pendingCandidateAnimation.controlAnimations,[binding(1.5)]);
  candidate.reply({requestId:pendingCandidateAnimation.requestId,controls:{height:2,speed:.5},effectiveControls:{height:2,speed:.5},
    controlSequence:pendingCandidateControl.controlSequence,controlAnimations:pendingCandidateAnimation.controlAnimations,
    animationSequence:pendingCandidateAnimation.animationSequence});
  await Promise.resolve();assert.equal(promoted,false,'candidate synchronization cannot bypass later pending commands');
  old.reply({requestId:controlRequest.requestId,controls:{height:3,speed:.5},effectiveControls:{height:3,speed:.5},controlSequence:2,
    controlAnimations:[binding(1.5)],animationSequence:1});
  old.reply({requestId:animationRequest.requestId,controls:{height:3,speed:.5},effectiveControls:{height:3,speed:.5},controlSequence:2,
    controlAnimations:[binding(2)],animationSequence:2});
  await Promise.all([control,animation]);for(let i=0;i<8;i++)await Promise.resolve();
  const candidateControl=candidate.messages.at(-1)!;
  assert.equal(candidateControl.type,'controls');assert.deepEqual(candidateControl.values,{height:3,speed:.5});
  candidate.reply({requestId:candidateControl.requestId,controls:candidateControl.values,effectiveControls:candidateControl.values,controlSequence:candidateControl.controlSequence,
    controlAnimations:pendingCandidateAnimation.controlAnimations,animationSequence:pendingCandidateAnimation.animationSequence});
  for(let i=0;i<8;i++)await Promise.resolve();
  const candidateAnimation=candidate.messages.at(-1)!;
  assert.equal(candidateAnimation.type,'animations');assert.deepEqual(candidateAnimation.controlAnimations,[binding(2)]);
  candidate.reply({requestId:candidateAnimation.requestId,controls:{height:3,speed:.5},effectiveControls:{height:3,speed:.5},controlSequence:candidateControl.controlSequence,
    controlAnimations:[binding(.25)],animationSequence:candidateAnimation.animationSequence});
  await Promise.resolve();assert.equal(promoted,false,'a forged candidate synchronization acknowledgement cannot promote or publish');
  candidate.reply({requestId:candidateAnimation.requestId,controls:{height:3,speed:.5},effectiveControls:{height:3,speed:.5},controlSequence:candidateControl.controlSequence,
    controlAnimations:candidateAnimation.controlAnimations,animationSequence:candidateAnimation.animationSequence});
  await build;

  const after=client.getSnapshot().authoring!;
  assert.equal(promoted,true);assert.equal(old.terminated,true);assert.deepEqual(after.controls,{height:3,speed:.5});
  assert.deepEqual(getRuntimeControlState(after).controlAnimations,[binding(2)]);
  const accepted:any=client.acceptedDocument();assert.deepEqual(accepted.controls.values,{height:3,speed:.5});assert.deepEqual(accepted.controlAnimations,[binding(2)]);
  await assert.rejects(client.invoke({name:'lux.parameters.set',input:{requestId:'stale-build-control',instanceId:before.instanceId,
    expectedGeneration:before.generation,expectedRevisionId:before.revisionId,expectedControlSchemaHash:schemaHash,values:{height:2},mode:'live'}}),/Runtime changed/);
});

test('edits acknowledged during compilation initialize the eventual candidate with the latest state',async t=>{
  const gate:{wait?:()=>Promise<void>}={};const client=await fixture(t,gate);await client.submit(source);
  const old=FlatWorker.all.at(-1)!,before=client.getSnapshot().authoring!;let release!:()=>void,compiling=false;
  gate.wait=()=>new Promise<void>(resolve=>{compiling=true;release=resolve;});
  const build=client.submit({...source,files:{'main.ts':'compiled later'}});
  while(!compiling)await new Promise(resolve=>setImmediate(resolve));
  const control=client.invoke({name:'lux.parameters.set',input:{requestId:'compile-control',instanceId:before.instanceId,
    expectedGeneration:before.generation,expectedRevisionId:before.revisionId,expectedControlSchemaHash:schemaHash,values:{height:2.5},mode:'live'}});
  const animation=new StudioController(client,()=> 'compile-animation').setNodeAnimation([],'height',binding(3));
  const controlRequest=old.messages.at(-2)!,animationRequest=old.messages.at(-1)!;
  old.reply({requestId:controlRequest.requestId,controls:{height:2.5,speed:.5},effectiveControls:{height:2.5,speed:.5},controlSequence:1});
  old.reply({requestId:animationRequest.requestId,controls:{height:2.5,speed:.5},effectiveControls:{height:2.5,speed:.5},controlSequence:1,
    controlAnimations:[binding(3)],animationSequence:1});
  await Promise.all([control,animation]);release();
  for(let i=0;i<200&&FlatWorker.all.length<2;i++)await new Promise(resolve=>setTimeout(resolve,10));
  const candidate=FlatWorker.all.at(-1)!;
  assert.deepEqual(candidate.init.controls,{height:2.5,speed:.5});assert.deepEqual(candidate.init.controlAnimations,[binding(3)]);
  candidate.reply({type:'ready',controls:candidate.init.controls,effectiveControls:candidate.init.controls,controlAnimations:candidate.init.controlAnimations});
  await build;assert.deepEqual(client.getSnapshot().authoring!.controls,{height:2.5,speed:.5});
  assert.deepEqual(getRuntimeControlState(client.getSnapshot().authoring!).controlAnimations,[binding(3)]);
});

test('legacy runtime state preserves scene animation fields',()=>{
  const legacy:any={sdkVersion:'0.1.0',intensity:.5,effectiveControls:{intensity:.75},controlAnimations:[{...binding(),definitionHash:'2f686a688523e2aa6e5368cd286974b87b324cfa4c67507563658b25cadd5a87',schemaHash:'2f686a688523e2aa6e5368cd286974b87b324cfa4c67507563658b25cadd5a87',controlId:'intensity'}],controlAnimationIssues:[],animationSequence:3};
  const state=getRuntimeControlState(legacy);
  assert.deepEqual(state.effectiveControls,{intensity:.75});
  assert.equal(state.animationSequence,3);
  assert.equal(state.controlAnimations?.length,1);
});
