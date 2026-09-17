import {SeededRandom} from '../../../../packages/runtime/src/seed.ts';
import {createStorySchedule} from '../controls/story-schedule.mjs';
import {createStoryGenerationRuntime} from '../controls/story-generation-runtime.mjs';
import {prepareStoryRenderScopeFactory} from '../controls/story-render-scope.mjs';

const freeze=Object.freeze,RuntimeError=Error,RuntimeString=String,define=Object.defineProperty,apply=Reflect.apply,call=Function.prototype.call,arraySplice=call.bind(Array.prototype.splice),arrayPush=call.bind(Array.prototype.push);
const MapCtor=Map,mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set),mapValues=call.bind(Map.prototype.values),arrayFrom=Array.from.bind(Array);
const SetCtor=Set,setAdd=call.bind(Set.prototype.add),setDelete=call.bind(Set.prototype.delete),setValues=call.bind(Set.prototype.values),setSize=call.bind(Object.getOwnPropertyDescriptor(Set.prototype,'size').get);
const descriptor=Object.getOwnPropertyDescriptor,createObject=Object.create;
function method(instance,name){const value=instance?.[name];if(typeof value!=='function')throw new RuntimeError('Visual missing '+name);return value;}

export function createStoryWorkerGeneration({identity,manifest,initialVisualStates,factories,sharedModules,renderer,device,compositor,settings,tempoClock,sampleTime,onPreparedReceipt,onIntermediateFrame,onError}){
 const visualRows=new MapCtor(),baseControls=new MapCtor(),slotsByVisual=new MapCtor(),pendingControlsByVisual=new MapCtor(),freeTargets=new SetCtor([0,1]);
 for(let index=0;index<manifest.visuals.length;index++)mapSet(visualRows,manifest.visuals[index].visualId,manifest.visuals[index]);
 for(let index=0;index<initialVisualStates.length;index++){const state=initialVisualStates[index],prepared=factories.visual(state.visualId);mapSet(baseControls,state.visualId,prepared.controls.createSlot());mapSet(slotsByVisual,state.visualId,new SetCtor());mapSet(pendingControlsByVisual,state.visualId,new SetCtor());}
 const capabilities=[];for(let index=0;index<sharedModules.capsule.visuals.length;index++){const row=sharedModules.capsule.visuals[index];capabilities[index]=freeze({visualId:row.id,storyCapability:row.artifactVersion===6?row.storyCapability:null});}
 const schedule=createStorySchedule({story:manifest.story,storyHash:manifest.storyHash,visualCapabilities:freeze(capabilities),identity});
 const scopeFactory=prepareStoryRenderScopeFactory({renderer}),orphaned=new SetCtor(),queueDone=device.queue.onSubmittedWorkDone;let tick=0,closed=false,disposal,latestAudio;
 function targetIndex(){const values=arrayFrom(setValues(freeTargets));if(!values.length)throw new RuntimeError('Story slot target capacity exhausted');const index=values[0];setDelete(freeTargets,index);return index;}
 function slotSnapshot(base,timeSeconds){const state=base.state(timeSeconds,tempoClock.snapshot(timeSeconds).beatPosition);return {controls:state.controls,controlSequence:state.controlSequence,controlSchemaHash:state.controlSchemaHash,controlAnimations:state.controlAnimations,animationSequence:state.animationSequence};}
 async function prepareSlot(preparation){
  if(closed)throw new RuntimeError('Story generation is closing');
  const visual=factories.visual(preparation.visualId),base=mapGet(baseControls,preparation.visualId),index=targetIndex(),controls=visual.controls.createSlot(slotSnapshot(base,0)),pendingControl=freeze({controls});if(latestAudio)controls.applyAudioSnapshot(latestAudio.snapshot,latestAudio.context);setAdd(mapGet(pendingControlsByVisual,preparation.visualId),pendingControl);let lease,scope,instance;
  try{
   lease=await factories.assets.acquire(preparation.visualId,preparation.slotKey);if(closed)throw new RuntimeError('Story generation is closing');
   const module=await sharedModules.importVisual(preparation.visualId);if(closed)throw new RuntimeError('Story generation is closing');
   const create=controls.checkDefinition(module),random=new SeededRandom((settings.seed+index+1)>>>0);
   scope=scopeFactory.create({target:compositor.slotTarget(index)});
   const context=freeze({settings:freeze({...settings}),assets:lease.assets,images:lease.images,random:()=>random.next(),reportError:value=>{throw new RuntimeError(RuntimeString(value));},renderer:scope.renderer});
   instance=await create(context);if(!instance||typeof instance!=='object')throw new RuntimeError('Invalid Story visual instance');
   const captured=freeze({update:method(instance,'update'),render:method(instance,'render'),reset:method(instance,'reset'),dispose:method(instance,'dispose')});
   const slot={id:preparation.slotKey,visualId:preparation.visualId,targetIndex:index,controls,scope,instance,captured,lease,lastTime:preparation.requestedAt,renderTime:preparation.requestedAt,events:[],firstRender:true,disposed:false,disposal:null};
   setDelete(mapGet(pendingControlsByVisual,slot.visualId),pendingControl);setAdd(mapGet(slotsByVisual,slot.visualId),slot);return slot;
  }catch(error){
   setDelete(mapGet(pendingControlsByVisual,preparation.visualId),pendingControl);const cleanup=(async()=>{await scope?.close();if(instance)await apply(method(instance,'dispose'),instance,[]);await lease?.release();})();
   try{await cleanup;setAdd(freeTargets,index);}catch(cleanupError){setAdd(orphaned,freeze({index,cleanup,error:cleanupError}));throw cleanupError;}throw error;
  }
 }
 async function renderSlot(slot,storyFrame,now=slot.renderTime??0){
  const tempo=tempoClock.snapshot(now),events=freeze(arraySplice(slot.events,0));
  await apply(slot.captured.update,slot.instance,[freeze({tick:tick++,timeSeconds:now,deltaSeconds:slot.firstRender?0:maxDelta(now-slot.lastTime),controls:slot.controls.values(now,tempo.beatPosition),events,story:storyFrame,sampleControl:(controlId,instanceKey)=>slot.controls.sample(freeze([]),controlId,instanceKey,now,tempo.beatPosition)})]);
  await slot.scope.run(()=>apply(slot.captured.render,slot.instance,[freeze({width:settings.width,height:settings.height,colorSpace:'linear-srgb',alphaMode:'premultiplied'})]));slot.lastTime=now;slot.firstRender=false;
 }
 const maxDelta=value=>value>0?value:0;
 async function disposeSlot(slot){
  if(slot.disposal)return slot.disposal;
  slot.disposal=(async()=>{await slot.scope.close();await apply(queueDone,device.queue,[]);await apply(slot.captured.dispose,slot.instance,[]);await apply(queueDone,device.queue,[]);await slot.lease.release();slot.disposed=true;setDelete(mapGet(slotsByVisual,slot.visualId),slot);setAdd(freeTargets,slot.targetIndex);})();return slot.disposal;
 }
 const runtime=createStoryGenerationRuntime({schedule,prepareSlot,async renderSlot(slot,frame,renderTime){slot.renderTime=renderTime??slot.renderTime??0;return renderSlot(slot,frame,slot.renderTime);},async compose(rows){const inputs=[];for(let index=0;index<rows.length;index++)inputs[index]={targetIndex:rows[index].slot.targetIndex,weight:rows[index].weight};await compositor.compose(inputs);await compositor.present();},settleGpu:()=>apply(queueDone,device.queue,[]),disposeSlot,sampleTime,onReceipt:onPreparedReceipt,onIntermediateFrame,onError});
 function setRenderTime(now){runtime.forEachSlot(slot=>{slot.renderTime=now;});}
 async function initialize(now){runtime.initialize(now);await runtime.idle();if(!schedule.status(now).committed)throw new RuntimeError('Story Normal visual did not commit');}
 function command(input,now){setRenderTime(now);return runtime.command(input,now);}
 async function draw(now,frameId,previewPlaying=true){setRenderTime(now);return runtime.draw(now,frameId,previewPlaying);}
 async function reset(now){
  const current=schedule.status(now);if(current.outgoing||current.pendingPreparation)throw new RuntimeError('Story reset is unavailable during a transition');
  if(current.committed?.visualId!==manifest.story.normalVisualId){runtime.command({action:'return-normal',commandId:null},now);await runtime.idle();}
  const operations=[];runtime.forEachSlot(slot=>{operations[operations.length]=apply(slot.captured.reset,slot.instance,[settings.seed]);slot.lastTime=now;});for(let index=0;index<operations.length;index++)await operations[index];
 }
 function eachVisualSlot(visualId,callback){const rows=arrayFrom(setValues(mapGet(slotsByVisual,visualId))),pending=arrayFrom(setValues(mapGet(pendingControlsByVisual,visualId)));for(let index=0;index<rows.length;index++)callback(rows[index]);for(let index=0;index<pending.length;index++)callback(pending[index]);}
 function controls(message){const base=mapGet(baseControls,message.visualId);if(!base)throw new RuntimeError('Story visual is unavailable');base.apply(message.values,message.controlSequence,message.controlSchemaHash);eachVisualSlot(message.visualId,slot=>slot.controls.apply(message.values,message.controlSequence,message.controlSchemaHash));}
 function animations(message,now){const base=mapGet(baseControls,message.visualId);if(!base)throw new RuntimeError('Story visual is unavailable');base.applyAnimations(message.controlAnimations,message.animationSequence,now);eachVisualSlot(message.visualId,slot=>slot.controls.applyAnimations(message.controlAnimations,message.animationSequence,now));}
 function audio(snapshot,context){latestAudio=freeze({snapshot,context});const bases=arrayFrom(mapValues(baseControls));for(let index=0;index<bases.length;index++)bases[index].applyAudioSnapshot(snapshot,context);for(let index=0;index<initialVisualStates.length;index++)eachVisualSlot(initialVisualStates[index].visualId,slot=>slot.controls.applyAudioSnapshot(snapshot,context));}
 function visualStates(now){const tempo=tempoClock.snapshot(now),rows=[];for(let index=0;index<initialVisualStates.length;index++){const initial=initialVisualStates[index],visualId=initial.visualId;rows[index]=freeze({visualId,...mapGet(baseControls,visualId).state(now,tempo.beatPosition),controlSchema:initial.controlSchema});}return freeze(rows);}
 function admitTrigger({visualId,activationId,controlId,commandId,sequence}){const status=schedule.status(0),active=status.committed;if(!active||active.visualId!==visualId||active.activationId!==activationId){const error=new RuntimeError('Story trigger activation is unavailable');define(error,'code',{value:'TRIGGER_REJECTED',enumerable:true});throw error;}const slot=runtime.getSlot(active.slotId),target=slot.controls.resolveTrigger(freeze([]),controlId),event=freeze({type:'trigger',controlId:target.controlId,commandId,sequence});arrayPush(slot.events,event);return freeze({slot,target,event});}
 function triggerAndDraw(input,now,previewPlaying=true){setRenderTime(now);return runtime.transaction(async({draw})=>{const target=admitTrigger(input);try{const result=await draw(now,undefined,previewPlaying);return freeze({target,result});}catch(error){const failure=new RuntimeError(RuntimeString(error?.message||error));define(failure,'code',{value:'TRIGGER_DRAW_FAILED',enumerable:true});throw failure;}});}
 function resourceStatus(){
  const scheduleResources=runtime.resources(),assets=factories.assets.status(),modules=sharedModules.status();let pendingCallbacks=0;runtime.forEachSlot(slot=>{pendingCallbacks+=slot.scope.status().pendingCallbacks;});
  const orphanCount=setSize(orphaned);return freeze({...scheduleResources,slots:scheduleResources.slots+orphanCount,slotStates:freeze({...scheduleResources.slotStates,unsettled:scheduleResources.slotStates.unsettled+orphanCount}),storyTargetBytes:compositor.status().storyTargetBytes,assetLeases:assets.leaseCount,assetLeaseBytes:assets.assetLeaseBytes,assetStagingJobs:assets.pendingStagingJobs,assetStagingBytes:assets.assetStagingBytes,pendingImports:modules.pendingImports,ownedModuleURLs:modules.ownedModuleURLs,pendingCallbacks,gpuSubmissions:0,readbackGrants:0,readbackBytes:0});
 }
 function status(now,previewPlaying=true){return freeze({...schedule.status(now,previewPlaying),resources:resourceStatus()});}
 async function capture(){return compositor.capture();}
 function dispose(){if(disposal)return disposal;closed=true;disposal=(async()=>{const runtimeResult=await runtime.dispose();if(setSize(orphaned))throw new RuntimeError('Story preparation cleanup is unreclaimed');await factories.dispose();await compositor.dispose();await sharedModules.dispose();return freeze({...runtimeResult,resources:resourceStatus()});})();return disposal;}
 return freeze({initialize,command,draw,reset,controls,animations,audio,visualStates,triggerAndDraw,status,capture,dispose});
}
