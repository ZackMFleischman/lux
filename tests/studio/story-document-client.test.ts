import test from 'node:test';
import assert from 'node:assert/strict';
import {StoryDocumentClient} from '../../apps/studio/src/story/story-document-client.ts';
import {normalizeControlSchema} from '../../packages/runtime-contracts/src/parameters.mjs';
import {createStorySchedule} from '../../apps/studio/src/controls/story-schedule.mjs';

const scheduleHash='a'.repeat(64),capsuleHash='b'.repeat(64),storyHash='c'.repeat(64),schemaHash='d'.repeat(64);
const schema=normalizeControlSchema([
 {id:'gain',type:'number',label:'Gain',default:0,min:0,max:1,step:.1,changeCost:'live'},
 {id:'mix',type:'number',label:'Mix',default:0,min:0,max:1,step:.1,changeCost:'live'},
]);
const story={version:2,normalVisualId:'visual',crossfadeSeconds:0,beats:[{id:'hold',label:'Hold',timing:{kind:'sustained' as const},visualId:'visual'}],sequence:[]} as const;
const storyCapability={version:1,beats:[{id:'hold',kind:'sustained' as const,seek:'none' as const}]} as const;

function fixture(command:(message:any)=>Promise<any>){
 const client=new StoryDocumentClient({} as any,()=>{},()=>({}), 'routine');
 const state={visualId:'visual',sdkVersion:'0.2.0',controlSchema:schema,controlSchemaHash:schemaHash,controls:{gain:0,mix:0},controlSequence:0,controlAnimations:[],animationSequence:0};
 const document={format:'lux-scene',version:7,visuals:[{id:'visual',source:{sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':'export default 1'}},controls:{sourceHash:'e'.repeat(64),schema,schemaHash,values:state.controls},controlAnimations:[]}],settings:{width:640,height:360,fps:60,seed:0},tempo:{bpm:120},story};
 const identity={instanceId:'instance',generation:1,scheduleHash,capsuleHash};
 const schedule=createStorySchedule({story,storyHash,visualCapabilities:[{visualId:'visual',storyCapability}],identity});
 const prepared=schedule.initialize(0);schedule.prepared(prepared.preparation.token,{slotId:'normal'});const storySchedule=schedule.publishCommit(schedule.stageCommit(prepared.preparation.token,0,'1')).status;
 const current:any={document,capsule:{visuals:[{id:'visual',storyCapability}]},prepared:{manifest:{scheduleHash,capsuleHash,storyHash,story,visuals:[{visualId:'visual',sourceHash:'e'.repeat(64)}]}},
  host:{identity,closed:false,command,canvas:{remove(){}}},states:[state],
  message:{playback:'paused',clockEpoch:0,timeSeconds:0,frameId:'1',tempo:{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:0},tempoSequence:0,storySchedule},
  desired:new Map(),commands:new Map(),pendingWrites:new Set(),pendingVisuals:new Set(),tempoCommands:0,pendingTempo:false};
 (client as any).current=current;
 return {client,current};
}

function status(current:any,controls:Record<string,number>,controlSequence:number){
 return {instanceId:'instance',generation:1,revisionId:scheduleHash,scheduleHash,capsuleHash,frameId:'2',playback:'paused',timeSeconds:0,clockEpoch:0,
  tempo:current.message.tempo,tempoSequence:0,storySchedule:current.message.storySchedule,visualStates:[{...current.states[0],controls,controlSequence}]};
}

const parameters=(values:Record<string,number>,requestId:string)=>({name:'lux.parameters.set',input:{requestId,instanceId:'instance',expectedGeneration:1,expectedRevisionId:scheduleHash,expectedControlSchemaHash:schemaHash,visualId:'visual',values,mode:'live'}} as any);

test('a deterministic control rejection restores desired state before the next edit',async()=>{
 const messages:any[]=[];
 const {client}=fixture(async message=>{messages.push(message);if(messages.length===1)throw Object.assign(Error('rejected'),{code:'CONTROL_REJECTED'});return {};});
 await assert.rejects(client.invoke(parameters({gain:.8},'first')),/rejected/);
 await client.invoke(parameters({mix:.6},'second'));
 assert.deepEqual(messages[1].values,{gain:0,mix:.6});
 assert.equal(messages[1].controlSequence,1);
});

test('edits to one visual serialize until the first completion settles',async()=>{
 let release!:(value:any)=>void;
 const {client}=fixture(()=>new Promise(resolve=>{release=resolve;}));
 const first=client.invoke(parameters({gain:.4},'first'));
 while(!release)await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(client.invoke(parameters({mix:.5},'second')),/already pending/i);
 release({});await first;
});

test('restart remains reachable after the accepted host has failed',async t=>{
 const {client,current}=fixture(async()=>({}));current.host.closed=true;
 let replacement:any;
 t.mock.method(client,'submitDocument',async (value:any)=>{replacement=value;});
 await client.invoke({name:'lux.runtime.restart',input:{requestId:'restart',instanceId:'instance',expectedGeneration:1}} as any);
 assert.equal(replacement.version,7);
 assert.deepEqual(replacement.visuals[0].controls.values,{gain:0,mix:0});
});

test('accepted scene remains readable during replacement and after a runtime failure',()=>{
 const {client,current}=fixture(async()=>({}));
 const accepted=client.acceptedDocument();
 (client as any).building=true;
 assert.deepEqual(client.acceptedDocument(),accepted);
 current.host.closed=true;
 assert.deepEqual(client.acceptedDocument(),accepted);
 assert.deepEqual(client.acceptedDocument().visuals[0]!.controls.values,{gain:0,mix:0});
});

test('an admitted pending edit still accepts an older acknowledged telemetry frame',()=>{
 const {client,current}=fixture(async()=>({}));
 current.desired.set('visual',{...current.states[0],controls:{gain:.8,mix:0},controlSequence:1});
 assert.doesNotThrow(()=>(client as any).validateStatus(current,status(current,{gain:0,mix:0},0)));
 assert.doesNotThrow(()=>(client as any).validateStatus(current,status(current,{gain:.8,mix:0},1)));
});
import {runtimeEditSignature} from '../../apps/studio/src/service-client.ts';
test('choosing another source does not dirty the scene, while editing an inactive source does',()=>{
 const {client,current}=fixture(async()=>({}));current.states.push({...current.states[0],visualId:'second',controls:{gain:1,mix:1}});
 const before=runtimeEditSignature((client as any).view(current));client.selectVisual('second');
 assert.equal(runtimeEditSignature((client as any).view(current)),before);
 current.states[0]={...current.states[0],controls:{gain:.5,mix:0},controlSequence:1};
 assert.notEqual(runtimeEditSignature((client as any).view(current)),before);
});
