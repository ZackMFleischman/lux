import {PerformanceReceiver} from '../performance/performance-state.ts';
import {validateStoryScheduleReceipt} from './story-status-admission.mjs';
import type {StoryAssetGenerationIdentity} from '../assets/story-asset-leases.mjs';

type Ports={broker:any;identity:StoryAssetGenerationIdentity;capsule:any;storyDefinition?:any;width:number;height:number;validateStatus:(value:any)=>void;validateCapture?:(value:any)=>void;onStatus:(value:any)=>void;onFailure:(error:Error)=>void;onPerformance?:(snapshot:any)=>void;createWorker?:()=>Worker;createDecoder?:()=>Worker;createCanvas?:()=>HTMLCanvasElement};
/** One supervised generation. Resource receipts are independent of command timeouts. */
export function createStoryRuntimeHost(ports:Ports){
 const {identity,broker}=ports;
 const performanceReceiver=new PerformanceReceiver({...identity,revisionId:identity.scheduleHash},performance.now());
 const canvas=ports.createCanvas?.()??document.createElement('canvas');canvas.width=ports.width;canvas.height=ports.height;canvas.style.cssText='width:100%;height:100%;position:absolute;inset:0;object-fit:contain';
 const reservationGrant=broker.reserveGeneration(identity,ports.width,ports.height,ports.capsule.visuals);
 let worker:Worker,decoder:Worker|undefined,closing=false,closed=false,unreclaimed=false,latest:any,lastHeartbeat=performance.now(),lastFrameAt=performance.now(),readyResolve:(value:any)=>void,readyReject:(error:Error)=>void,cleanupResolve:()=>void;
 const readbackGrants=new Map<string,{requestId:string;released:boolean}>();
 const pending=new Map<string,{message:any;resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>(),decodePending=new Map<string,{request:any;resolve:(value:any)=>void;reject:(error:Error)=>void}>();
 const ready=new Promise<any>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const cleanup=new Promise<void>(resolve=>{cleanupResolve=resolve;});
 let cleanupRequestId:string|undefined;let audioInFlight:any;let audioLatest:any;
 let startTimer:ReturnType<typeof setTimeout>|undefined,cleanupTimer:ReturnType<typeof setTimeout>|undefined;
 const matches=(value:any)=>value?.instanceId===identity.instanceId&&value.generation===identity.generation&&value.revisionId===identity.scheduleHash&&value.scheduleHash===identity.scheduleHash&&value.capsuleHash===identity.capsuleHash;
 const post=(message:any,transfer:Transferable[]=[])=>worker.postMessage({...message,...identity,revisionId:identity.scheduleHash},transfer);
 const rejectPending=(error:Error,includeDecoder=true)=>{for(const row of pending.values()){clearTimeout(row.timer);row.reject(error);}pending.clear();if(includeDecoder){for(const row of decodePending.values())row.reject(error);decodePending.clear();}};
 function terminate(error:Error){if(closed)return;performanceReceiver.fail();ports.onPerformance?.(performanceReceiver.snapshot);closed=true;unreclaimed=true;clearTimeout(startTimer);clearTimeout(cleanupTimer);clearInterval(watchdog);broker.markUnreclaimed(identity);worker?.terminate();decoder?.terminate();readyReject(error);rejectPending(error);ports.onFailure(error);cleanupResolve();}
 function dispose(){if(closing||closed)return cleanup;closing=true;clearTimeout(startTimer);clearInterval(watchdog);rejectPending(Error('Story generation is retiring'),false);cleanupTimer=setTimeout(()=>terminate(Error('Story cleanup did not settle; resources remain reserved. Reload the client to recover.')),5000);try{cleanupRequestId=crypto.randomUUID();post({type:'dispose',requestId:cleanupRequestId});}catch(error){terminate(error instanceof Error?error:Error(String(error)));}return cleanup;}
 function fail(error:Error){performanceReceiver.fail();ports.onPerformance?.(performanceReceiver.snapshot);readyReject(error);ports.onFailure(error);void dispose();}
 function decode(request:any){
  const admitted=broker.authorizeDecode(request);
  if(!decoder){decoder=ports.createDecoder?.()??new Worker(new URL('./story-asset-decoder-worker.js',import.meta.url),{type:'module'});decoder.onmessage=event=>{const result=event.data,row=decodePending.get(result?.requestId);if(!row)return;if(JSON.stringify(result.identity)!==JSON.stringify(identity)){row.reject(Error('Decoder generation identity mismatch'));decodePending.delete(result.requestId);return;}if(result.stagingGrantId!==row.request.stagingGrantId||result.visualId!==row.request.visualId||result.assetSetHash!==row.request.assetSetHash){row.reject(Error('Decoder grant identity mismatch'));return;}broker.finishDecode(identity,row.request.stagingGrantId,result.requestId,result.kind==='story-assets-decoded'?'decoded':'failed');decodePending.delete(result.requestId);row.resolve(result);};decoder.onerror=event=>{for(const row of decodePending.values())row.reject(Error(event.message));decodePending.clear();};}
  return new Promise<any>((resolve,reject)=>{if(decodePending.has(request.requestId))return reject(Error('Decoder request already pending'));decodePending.set(request.requestId,{request:admitted,resolve,reject});decoder!.postMessage(admitted);});
 }
 const watchdog=setInterval(()=>{if(performanceReceiver.age(performance.now()))ports.onPerformance?.(performanceReceiver.snapshot);if(!closed&&!closing&&(performance.now()-lastHeartbeat>=1250||latest?.playback==='playing'&&performance.now()-lastFrameAt>=1250))terminate(Error('Story worker stopped making progress; resources remain reserved.'));},250);
 try{worker=ports.createWorker?.()??new Worker(new URL('./visual-worker.js',import.meta.url),{type:'module'});}catch(error){terminate(error instanceof Error?error:Error(String(error)));throw error;}
 worker.onerror=event=>terminate(Error(event.message));
 worker.onmessage=event=>{const message=event.data;if(closed||!matches(message))return;
  if(message.type==='story-resource-request'){
   void (async()=>{try{const request=message.request;if(JSON.stringify(request?.identity)!==JSON.stringify(identity))throw Error('Resource identity mismatch');const response=request.kind==='story-assets-decode'?await decode(request):broker.handle(request);if(!closed){const transfer:Transferable[]=[];for(const row of response.rows??[])transfer.push(row.encoded.buffer,row.pixels.buffer);post({type:'story-resource-response',requestId:request.requestId,response},transfer);}}catch(error){if(!closed)post({type:'story-resource-response',requestId:message.request?.requestId,error:{code:(error as any)?.code??'STORY_RESOURCE_REJECTED',message:String(error).slice(0,500)}});}})();return;
  }
  if(message.type==='story-readback-release'){try{const grant=readbackGrants.get(message.grantId);if(!grant||grant.released)throw Error('Unexpected readback release');broker.releaseCapture(identity,message.grantId);grant.released=true;if(!pending.has(grant.requestId))readbackGrants.delete(message.grantId);}catch(error){fail(error as Error);}return;}
  if(message.type==='story-cleanup'){
   if(!closing||message.requestId!==cleanupRequestId)return;
   try{if(message.disposition!=='settled')throw Error('Story cleanup remains unreclaimed');broker.releaseGeneration(identity,message.resources);closed=true;clearTimeout(cleanupTimer);clearInterval(watchdog);worker.terminate();decoder?.terminate();cleanupResolve();}catch(error){terminate(error as Error);}return;
  }
  if(closing)return;
  if(message.type==='performance'){if(performanceReceiver.receive(message.summary,performance.now()))ports.onPerformance?.(performanceReceiver.snapshot);return;}
  if(message.type==='heartbeat'){lastHeartbeat=performance.now();return;}
  if(message.type==='audio-ack'){if(audioInFlight&&message.providerGeneration===audioInFlight.generation&&message.sampleSequence===audioInFlight.sequence){audioInFlight=undefined;const next=audioLatest;audioLatest=undefined;if(next)postAudio(next);}return;}
  if(message.type==='failure'){fail(Error(String(message.message)));return;}
  if(message.type==='command-error'||message.type==='capture-error'){const row=pending.get(message.requestId);if(row){if(row.message.type==='capture'){const grantId=row.message.readbackGrant.grantId;if(!readbackGrants.get(grantId)?.released){fail(Error('Capture failed before readback settlement'));return;}readbackGrants.delete(grantId);}clearTimeout(row.timer);pending.delete(message.requestId);row.reject(Object.assign(Error(String(message.message)),{code:message.code??'STORY_COMMAND_FAILED',candidates:message.candidates}));}return;}
  if(message.type==='capture'){const row=pending.get(message.requestId);if(!row)return;const grantId=row.message.readbackGrant?.grantId;if(!grantId||!readbackGrants.get(grantId)?.released){fail(Error('Capture completed before readback settlement'));return;}readbackGrants.delete(grantId);if(!(message.bytes instanceof ArrayBuffer)||message.bytes.byteLength>41943040){fail(Error('Invalid Story capture'));return;}try{if(message.metadata?.width!==ports.width||message.metadata?.height!==ports.height||message.metadata?.colorSpace!=='srgb'||message.metadata?.alphaMode!=='straight')throw Error('Invalid capture metadata');if(!ports.validateCapture)throw Error('Capture admission is unavailable');ports.validateCapture(message.metadata);}catch(error){fail(error as Error);return;}clearTimeout(row.timer);pending.delete(message.requestId);row.resolve({bytes:message.bytes,metadata:message.metadata});return;}
  if(message.type==='ready'||message.type==='status'||message.type==='frame'){
   try{
    const expected=pending.get(message.requestId)?.message;
    if(expected){
     const state=message.visualStates?.find((row:any)=>row.visualId===expected.visualId);
     if(expected.type==='controls'&&(!state||state.controlSequence!==expected.controlSequence||Object.keys(expected.values).some(key=>state.controls?.[key]!==expected.values[key])))throw Error('Story control completion mismatch');
     if(expected.type==='animations'&&(!state||state.animationSequence!==expected.animationSequence||JSON.stringify(state.controlAnimations)!==JSON.stringify(expected.controlAnimations)))throw Error('Story animation completion mismatch');
     if(expected.type==='trigger'&&(message.triggerReceipt?.commandId!==expected.commandId||message.triggerReceipt?.controlId!==expected.controlId||message.triggerReceipt?.visualId!==expected.visualId||message.triggerReceipt?.activationId!==expected.activationId||message.triggerReceipt?.result!=='applied'||!Array.isArray(message.triggerReceipt?.nodePath)||message.triggerReceipt.nodePath.length!==0||!Number.isSafeInteger(message.triggerReceipt?.sequence)||message.triggerReceipt.sequence<1||!/^\d{1,20}$/.test(message.triggerReceipt?.frameId)||!Number.isFinite(message.triggerReceipt?.timeSeconds)))throw Error('Story trigger completion mismatch');
     if(expected.type==='story-transport'){if(!ports.storyDefinition)throw Error('Missing Story definition');validateStoryScheduleReceipt(message.storyReceipt,{definition:ports.storyDefinition,commandId:expected.commandId,action:expected.action,previous:{storyRevision:expected.expectedStoryRevision}});}
     if(expected.type==='tempo'&&(message.tempoSequence!==expected.tempoSequence||message.tempo?.tempoSequence!==expected.tempoSequence||expected.action!=='tap'&&message.tempo?.bpm!==expected.bpm))throw Error('Story tempo completion mismatch');
     if(expected.type==='playback'&&expected.action!=='reset'&&message.playback!==(expected.action==='play'?'playing':'paused'))throw Error('Story playback completion mismatch');
    }
    ports.validateStatus(message);
   }catch(error){fail(error as Error);return;}
   lastHeartbeat=performance.now();if(!latest||message.frameId!==latest.frameId)lastFrameAt=performance.now();latest=message;ports.onStatus(message);if(message.type==='ready'){clearTimeout(startTimer);readyResolve(message);}
   const row=pending.get(message.requestId);if(row){clearTimeout(row.timer);pending.delete(message.requestId);row.resolve(message);}return;
  }
 };
 function postAudio(snapshot:any){if(closing||closed)return;if(audioInFlight){audioLatest=snapshot;return;}audioInFlight=snapshot;post({type:'audio',audioSnapshot:snapshot});}
 function start(payload:any){if(startTimer||latest||closing||closed)throw Error('Story generation already started');startTimer=setTimeout(()=>fail(Error('Story preparation exceeded five seconds')),5000);try{const offscreen=canvas.transferControlToOffscreen();post({...payload,type:'init',sharedCapsule:ports.capsule,reservationGrant,canvas:offscreen},[offscreen]);}catch(error){fail(error as Error);}return ready;}
 function command(message:any){if(closing||closed)throw Error('Story generation is unavailable');const requestId=message.requestId??crypto.randomUUID();if(pending.has(requestId))throw Error('Request already pending');return new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);if(message.type==='trigger'||message.type==='story-transport')reject(Object.assign(Error('Story result is uncertain; retry the same command ID'),{code:message.type==='trigger'?'TRIGGER_TIMEOUT':'STORY_TIMEOUT'}));else{const error=Error('Story runtime command timed out');reject(error);fail(error);}},8000);pending.set(requestId,{message,resolve,reject,timer});try{post({...message,requestId});}catch(error){clearTimeout(timer);pending.delete(requestId);reject(error);}});}
 async function captureFrame(){if(closing||closed)throw Error('Story generation is unavailable');const requestId=crypto.randomUUID(),readbackGrant=broker.reserveCapture(identity,requestId);readbackGrants.set(readbackGrant.grantId,{requestId,released:false});return command({type:'capture',requestId,readbackGrant});}
 return Object.freeze({identity,canvas,start,command,capture:captureFrame,dispose,post,postAudio,get performanceSnapshot(){return performanceReceiver.snapshot;},get status(){return latest;},get closed(){return closed;},get unreclaimed(){return unreclaimed;}});
}
export type StoryRuntimeHost=ReturnType<typeof createStoryRuntimeHost>;
