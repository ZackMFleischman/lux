// Coordinates asynchronous authored preparation with one serialized draw owner.
// Preparation never waits on the draw chain; only its validated completion is
// re-entered to render the first frame and publish ownership.
const freeze=Object.freeze,RuntimeError=Error,RuntimeString=String,define=Object.defineProperty,call=Function.prototype.call;
const MapCtor=Map,mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set),mapDelete=call.bind(Map.prototype.delete),mapValues=call.bind(Map.prototype.values),mapSize=call.bind(Object.getOwnPropertyDescriptor(Map.prototype,'size').get);
const SetCtor=Set,setAdd=call.bind(Set.prototype.add),setDelete=call.bind(Set.prototype.delete),setHas=call.bind(Set.prototype.has),setValues=call.bind(Set.prototype.values),setSize=call.bind(Object.getOwnPropertyDescriptor(Set.prototype,'size').get);
const RuntimePromise=Promise,allSettled=RuntimePromise.allSettled.bind(RuntimePromise),promiseThen=call.bind(RuntimePromise.prototype.then),promiseCatch=call.bind(RuntimePromise.prototype.catch),promiseFinally=call.bind(RuntimePromise.prototype.finally),arrayFrom=Array.from.bind(Array);

export function createStoryGenerationRuntime({schedule,prepareSlot,renderSlot,compose,settleGpu,disposeSlot,sampleTime,onReceipt=()=>{},onIntermediateFrame=()=>{},onError=()=>{}}){
 const slots=new MapCtor(),preparations=new SetCtor();let chain=RuntimePromise.resolve(),frame=0,closing=false,cleanup;
 const enqueue=operation=>{const result=promiseThen(chain,operation);chain=promiseCatch(result,()=>{});return result;};
 function slotForFrame(frameRow){const slot=mapGet(slots,frameRow.slotId);if(!slot)throw new RuntimeError('Story frame slot is unavailable');return freeze({...frameRow,slot});}
 async function composeCurrent(now){const rows=schedule.frames(now),resolved=[];for(let index=0;index<rows.length;index++)resolved[index]=slotForFrame(rows[index]);await compose(freeze(resolved));await settleGpu();frame++;}
 async function retireInvisible(now){
  const visible=new SetCtor(),rows=schedule.frames(now);for(let index=0;index<rows.length;index++)setAdd(visible,rows[index].slotId);
  const values=arrayFrom(mapValues(slots));
  for(let index=0;index<values.length;index++){const slot=values[index];if(setHas(visible,slot.id))continue;await disposeSlot(slot);mapDelete(slots,slot.id);schedule.settleRetirement(slot.id);}
 }
 function startPreparation(decision,requestedAt){
  const preparation=decision.preparation;
  const task=(async()=>{
   let slot,published=false;
   try{
    slot=await prepareSlot(preparation);
    await enqueue(async()=>{
     const admission=schedule.prepared(preparation.token,{slotId:slot.id});
     if(closing||!admission.accepted){await disposeSlot(slot);schedule.settleRetirement(slot.id);const error=new RuntimeError(closing?'Story generation is closing':'Story preparation was cancelled');error.code=closing?'STORY_CLOSING':'STORY_CANCELLED';onError(error,preparation);return;}
     mapSet(slots,slot.id,slot);
     const commitTime=sampleTime?sampleTime():requestedAt;
     await renderSlot(slot,preparation.storyFrame,commitTime);await settleGpu();
     const staged=schedule.stageCommit(preparation.token,commitTime,RuntimeString(frame+1));
     const resolved=[];for(let index=0;index<staged.rows.length;index++)resolved[index]=slotForFrame(staged.rows[index]);await compose(freeze(resolved));await settleGpu();frame++;
     const receipt=schedule.publishCommit(staged);published=true;onReceipt(freeze({...receipt,frameId:RuntimeString(frame)}));
     await retireInvisible(commitTime);
    });
   }catch(error){
    await enqueue(async()=>{if(published){define(error,'code',{value:'STORY_POST_COMMIT_FAILED',enumerable:true,configurable:true});onError(error,preparation);return;}try{if(slot){await disposeSlot(slot);mapDelete(slots,slot.id);schedule.settleRetirement(slot.id);schedule.preparationFailed(preparation.token,error);}else if(!schedule.preparationSettled(preparation.token))schedule.preparationFailed(preparation.token,error);onError(error,preparation);}catch(cleanupError){define(cleanupError,'code',{value:'STORY_CLEANUP_FAILED',enumerable:true,configurable:true});onError(cleanupError,preparation);}});
   }
  })();
  setAdd(preparations,task);void promiseFinally(task,()=>setDelete(preparations,task));return decision;
 }
 function initialize(now){const decision=schedule.initialize(now);return startPreparation(decision,now);}
 function command(input,now){
  if(closing)throw new RuntimeError('Story generation is closing');
  const decision=schedule.request(input,now);
  if(decision.result==='preparing')return startPreparation(decision,now);
  return decision;
 }
 async function drawOperation(now,frameId,previewPlaying=true){
  if(closing)return;schedule.beginFrame(now,previewPlaying);const rows=schedule.frames(now);
  for(let index=0;index<rows.length;index++){const row=rows[index],slot=mapGet(slots,row.slotId);if(!slot)throw new RuntimeError('Story draw slot is unavailable');await renderSlot(slot,row.story);}
  await composeCurrent(now);schedule.completePresentedFrame(now,previewPlaying);if(schedule.restartPending()){onIntermediateFrame(freeze({frameId:RuntimeString(frame),timeSeconds:now,status:schedule.status(now,previewPlaying)}));schedule.restartAfterEndpoint(now);const restarted=schedule.frames(now);for(let index=0;index<restarted.length;index++){const row=restarted[index],slot=mapGet(slots,row.slotId);if(!slot)throw new RuntimeError('Story restart slot is unavailable');await renderSlot(slot,row.story);}await composeCurrent(now);}await retireInvisible(now);const due=schedule.takeDue(now);if(due.result==='preparing')startPreparation(due,now);return freeze({frameId:RuntimeString(frame),status:schedule.status(now,previewPlaying)});
 }
 function draw(now,frameId,previewPlaying=true){return enqueue(()=>drawOperation(now,frameId,previewPlaying));}
 function transaction(operation){return enqueue(()=>operation(freeze({draw:drawOperation})));}
 async function idle(){while(setSize(preparations))await allSettled(arrayFrom(setValues(preparations)));await chain;}
 function resources(){const status=schedule.status(0).resources;if(mapSize(slots)>status.slots)throw new RuntimeError('Story slot accounting is inconsistent');return status;}
 function forEachSlot(callback){const values=arrayFrom(mapValues(slots));for(let index=0;index<values.length;index++)callback(values[index]);}
 function getSlot(slotId){return mapGet(slots,slotId);}
 function dispose(){
  if(cleanup)return cleanup;closing=true;const pending=schedule.status(0).pendingPreparation;if(pending)schedule.cancel(pending.token,'dispose');
  cleanup=(async()=>{
   await idle();await enqueue(async()=>{const values=arrayFrom(mapValues(slots));for(let index=0;index<values.length;index++){await disposeSlot(values[index]);mapDelete(slots,values[index].id);schedule.releaseSlot(values[index].id);}await settleGpu();});
   const current=resources();return freeze({disposition:current.slots===0&&current.pendingCreates===0?'settled':'unreclaimed',resources:current});
  })();return cleanup;
 }
 return freeze({initialize,command,draw,transaction,idle,dispose,status:(now,previewPlaying=true)=>schedule.status(now,previewPlaying),resources,forEachSlot,getSlot});
}
