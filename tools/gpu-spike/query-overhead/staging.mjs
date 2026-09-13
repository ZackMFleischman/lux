// Test harness only. Install before createGpuPassTimer captures its originals.
export function installSubmitStaging(device){
 const submit=device.queue.submit,createBuffer=device.createBuffer,restores=[];
 let batch=null,pending=[];
 const replace=(object,key,value)=>{const old=Object.getOwnPropertyDescriptor(object,key);Object.defineProperty(object,key,{value,configurable:true,writable:true});restores.push(()=>old?Object.defineProperty(object,key,old):delete object[key]);};
 replace(device.queue,'submit',function(buffers){
  if(!batch)throw Error('GPU submit outside staged batch');
  if(!Array.isArray(buffers)||buffers.length===0)throw Error('Unsupported staged submission');
  batch.groups++;batch.commands.push(...buffers);
 });
 replace(device,'createBuffer',function(descriptor){
  const buffer=createBuffer.call(device,descriptor);
  if(descriptor.usage&1){const nativeMap=buffer.mapAsync;
   replace(buffer,'mapAsync',function(...args){
    if(!batch)return nativeMap.apply(buffer,args);
    let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    batch.maps.push({run:()=>nativeMap.apply(buffer,args),resolve,reject});pending.push(promise);return promise;
   });
  }
  return buffer;
 });
 return {
  begin(){if(batch||pending.length)throw Error('Previous staged batch not drained');batch={commands:[],maps:[],groups:0};},
  append(command){if(!batch)throw Error('Missing staged batch');batch.commands.push(command);},
  flush(){if(!batch)throw Error('Missing staged batch');const current=batch;batch=null;
   try{submit.call(device.queue,current.commands);}catch(error){for(const map of current.maps)map.reject(error);throw error;}
   for(const map of current.maps){try{Promise.resolve(map.run()).then(map.resolve,map.reject);}catch(error){map.reject(error);}}
   return {realSubmissions:1,commandBuffers:current.commands.length,logicalSubmissionGroups:current.groups,deferredMaps:current.maps.length};
  },
  async drain(){const values=await Promise.allSettled(pending);pending=[];if(values.some(x=>x.status==='rejected'))throw Error('Deferred timer map failed');},
  abort(error){if(batch){for(const map of batch.maps)map.reject(error);batch=null;}},
  restore(){if(batch||pending.length)throw Error('Cannot restore an undrained staged batch');for(const restore of restores.reverse())restore();},
 };
}
// Native map completion and validation-scope completion can arrive separately.
// This wait is outside both GPU endpoints and cannot extend the outer Job.
export async function waitForTimerDrain(timer,timeoutMs=1000){
 const deadline=performance.now()+timeoutMs;
 while(timer.status().pendingSamples!==0){
  if(performance.now()>=deadline)throw Error('Actual timer completion deadline exceeded');
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 return timer.status();
}
