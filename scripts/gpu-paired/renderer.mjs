import {plan,order} from './method.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
window.runPaired=async transport=>{
 const started=performance.now(),legs=[];window.pairedProgress={legs};
 for(const pair of order)for(const mode of pair.modes){
  if(performance.now()-started>plan.trialDeadlineMs)throw Error('100-second trial deadline exceeded');
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.style='width:100%;height:100%;object-fit:contain';document.body.replaceChildren(canvas);
  const worker=new Worker('./worker.js',{type:'module'}),identity={instanceId:crypto.randomUUID(),generation:1,revisionId:transport.sourceHash};
  let heartbeatAt=performance.now(),firstHeartbeat=false,terminalError;const pending=new Map();
  const fail=error=>{terminalError=error;for(const request of pending.values()){clearTimeout(request.timer);request.reject(error);}pending.clear();worker.terminate();};
  const watchdog=setInterval(()=>{if(firstHeartbeat&&performance.now()-heartbeatAt>=1250)fail(Error('Visual worker heartbeat expired'));if(performance.now()-started>plan.trialDeadlineMs)fail(Error('100-second trial deadline exceeded'));},100);
  worker.onerror=event=>fail(Error(event.message));
  worker.onmessage=({data})=>{
   if(data.instanceId!==identity.instanceId||data.generation!==identity.generation)return;
   if(data.type==='heartbeat'){firstHeartbeat=true;heartbeatAt=performance.now();return;}
   if(data.type==='failure'){fail(Error(data.message));return;}
   const wait=pending.get(data.requestId);if(wait){clearTimeout(wait.timer);pending.delete(data.requestId);wait.resolve(data);}
  };
  const request=(type,extra={},transfer=[],timeout=5000)=>new Promise((resolve,reject)=>{
   if(terminalError)return reject(terminalError);const requestId=crypto.randomUUID();pending.set(requestId,{resolve,reject,timer:setTimeout(()=>fail(Error(type+' deadline')),timeout)});
   worker.postMessage({type,...identity,requestId,...extra},transfer);
  });
  const legStarted=performance.now();
  try{
   const offscreen=canvas.transferControlToOffscreen();
   const ready=await request('init',{linked:transport.linked,canvas:offscreen,sdkVersion:'0.2.0',controlSchema:transport.linked.controls,
    controlSchemaHash:transport.linked.controlSchemaHash,controls:transport.savedControls,settings:transport.settings,playing:false,externallyDriven:true,performanceMode:mode},[offscreen],15000);
   if(ready.frameId!=='1'||ready.timeSeconds!==0)throw Error('Fixed-time initialization mismatch');
   const capability=await request('diagnostic-finalize',{},[],6000);
   if(!capability.reference.timestampQueryEnabled)throw Error('GPU timestamp-query reference unavailable');
   const readyMs=performance.now()-legStarted;
   for(let frame=2;frame<=plan.totalFrames;frame++){
    const frameStart=performance.now();const value=await request('frame');
    if(value.frameId!==String(frame)||value.timeSeconds!==0||value.controlSequence!==0||JSON.stringify(value.controls)!==JSON.stringify(transport.savedControls))throw Error('Frame/control/time sequence changed');
    await sleep(Math.max(0,plan.framePeriodMs-(performance.now()-frameStart)));
   }
   const data=await request('diagnostic-finalize',{},[],6000);
   legs.push({pair:pair.pair,mode,readyMs,elapsedMs:performance.now()-legStarted,data});
   window.pairedProgress={legs};
   await request('dispose',{},[],2000);
  }finally{clearInterval(watchdog);worker.terminate();canvas.remove();}
 }
 return {legs,elapsedMs:performance.now()-started};
};
