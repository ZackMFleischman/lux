// Direct pass timestamp capture: never consumes Three's cached resolver values.
// One owner device, three in-flight readbacks, 128 render/compute passes per frame.
const freeze=Object.freeze,define=Object.defineProperty,descriptor=Object.getOwnPropertyDescriptor;
const Uint64=BigUint64Array,finite=Number.isFinite,integer=Number.isSafeInteger;
export function createGpuPassTimer(device,onSample) {
 const supported=typeof device.features?.has==='function'?device.features.has('timestamp-query'):null;
 let enabled=false,disposed=false,active=null,completedSamples=0,failedSamples=0,droppedSamples=0,reason='Timestamp queries unavailable';
 const slots=[],restores=[],commands=new WeakMap();
 const status=()=>freeze({timestampQuerySupported:supported,timestampQueryEnabled:enabled,completedSamples,failedSamples,droppedSamples,pendingSamples:slots.filter(s=>s.busy).length,reason});
 const replace=(object,key,fn)=>{const old=descriptor(object,key);define(object,key,{value:fn,configurable:true,writable:true});restores.push(()=>{if(old)define(object,key,old);else delete object[key];});};
 const closeFailed=slot=>{void device.popErrorScope().catch(()=>{}).finally(()=>{slot.busy=false;});};
 function release(){for(const restore of restores.splice(0).reverse())try{restore();}catch{}for(const slot of slots){try{slot.read.destroy();}catch{}try{slot.resolve.destroy();}catch{}try{slot.query.destroy();}catch{}}}
 const api={status,
  begin(frame){if(!enabled||disposed)return;if(active){active.invalid=true;failedSamples++;closeFailed(active);active=null;}if(!integer(frame)||frame<1){failedSamples++;return;}
   const slot=slots.find(s=>!s.busy);if(!slot){droppedSamples++;return;}device.pushErrorScope('validation');slot.busy=true;slot.count=0;slot.invalid=false;slot.nonPass=false;slot.frame=frame;slot.submitted=0;active=slot;},
  end(){const slot=active;active=null;if(!slot||disposed)return;
   if(slot.invalid||slot.count===0||slot.submitted===0){failedSamples++;closeFailed(slot);return;}
   let errors;
   try {
    const encoder=originalEncoder.call(device);encoder.resolveQuerySet(slot.query,0,slot.count,slot.resolve,0);encoder.copyBufferToBuffer(slot.resolve,0,slot.read,0,slot.count*8);originalSubmit.call(device.queue,[encoder.finish()]);
    errors=device.popErrorScope();
    // READ=1, QUERY_RESOLVE=512, COPY_SRC=4, COPY_DST=8, MAP_READ=1.
    void Promise.allSettled([slot.read.mapAsync(1,0,slot.count*8),errors]).then(([mapped,validation])=>{
     if(disposed)return;
     if(mapped.status!=='fulfilled'||validation.status!=='fulfilled'||validation.value)throw Error('GPU readback or validation invalidated timestamp capture');
     const values=new Uint64(slot.read.getMappedRange(0,slot.count*8));let elapsed=0n;
     for(let i=0;i<slot.count;i+=2){if(values[i]===0n||values[i+1]===0n||values[i+1]<values[i])throw Error('Invalid GPU timestamp pair');elapsed+=values[i+1]-values[i];}
     const ms=Number(elapsed)/1e6;if(!finite(ms)||ms<0||slot.invalid)throw Error('Invalid GPU result');
     if(onSample(slot.frame,ms,!slot.nonPass)===false)droppedSamples++;else completedSamples++;
    }).catch(()=>{if(!disposed)failedSamples++;}).finally(()=>{try{slot.read.unmap();}catch{}slot.busy=false;});
   }catch{failedSamples++;if(!errors)closeFailed(slot);else void errors.catch(()=>{}).finally(()=>{slot.busy=false;});}
  },
  dispose(){if(disposed)return;disposed=true;active=null;release();},
 };
 let originalEncoder,originalSubmit;
 if(supported!==true)return freeze(api);
 try {
  originalEncoder=device.createCommandEncoder;originalSubmit=device.queue.submit;
  if(typeof originalEncoder!=='function'||typeof device.createQuerySet!=='function'||typeof device.createBuffer!=='function'||typeof originalSubmit!=='function'||typeof device.pushErrorScope!=='function'||typeof device.popErrorScope!=='function')throw Error('GPU query API unavailable');
  for(let i=0;i<3;i++){
   const slot={busy:false,count:0,invalid:false,frame:0,submitted:0};slots.push(slot);
   slot.query=device.createQuerySet({type:'timestamp',count:256});slot.resolve=device.createBuffer({size:2048,usage:512|4});slot.read=device.createBuffer({size:2048,usage:1|8});
  }
  replace(device,'createCommandEncoder',function(...args){
   const encoder=originalEncoder.apply(device,args),meta={slot:null,frame:0,nonPass:false};
   try {
   for(const name of ['beginRenderPass','beginComputePass']) {
    const original=encoder[name];
    if(typeof original!=='function'){if(active)active.invalid=true;continue;}
    define(encoder,name,{configurable:true,value:function(input={}){
     const slot=active;
     if(!slot)return original.call(encoder,input);
     if(meta.slot&&(meta.slot!==slot||meta.frame!==slot.frame)){if(meta.slot.frame===meta.frame)meta.slot.invalid=true;slot.invalid=true;}
     meta.slot=slot;meta.frame=slot.frame;
     if(input.timestampWrites||slot.count>=256){slot.invalid=true;return original.call(encoder,input);}
     const first=slot.count;slot.count+=2;
     return original.call(encoder,{...input,timestampWrites:{querySet:slot.query,beginningOfPassWriteIndex:first,endOfPassWriteIndex:first+1}});
    }});
   }
   // A pass sum cannot cover copies/clears outside passes; do not certify that frame.
   for(const name of ['copyBufferToBuffer','copyBufferToTexture','copyTextureToBuffer','copyTextureToTexture','clearBuffer'])if(typeof encoder[name]==='function'){
    const original=encoder[name];define(encoder,name,{configurable:true,value:function(...args){meta.nonPass=true;if(active)active.nonPass=true;return original.apply(encoder,args);}});
   }
   const finish=encoder.finish;define(encoder,'finish',{configurable:true,value:function(...args){const result=finish.apply(encoder,args);commands.set(result,meta);return result;}});
   }catch{if(active)active.invalid=true;reason='Command encoder instrumentation unavailable';}
   return encoder;
  });
  replace(device.queue,'submit',function(buffers){
   // Runtime renderer supplies arrays. Preserve unsupported iterable submission
   // behavior while invalidating coverage, rather than consuming its iterator twice.
   if(active){if(!Array.isArray(buffers))active.invalid=true;else for(const buffer of buffers){const meta=commands.get(buffer);if(!meta||meta.slot!==active||meta.frame!==active.frame)active.invalid=true;else {active.submitted++;if(meta.nonPass)active.nonPass=true;}}}
   return originalSubmit.call(device.queue,buffers);
  });
  for(const name of ['writeBuffer','writeTexture','copyExternalImageToTexture'])if(typeof device.queue[name]==='function'){
   const original=device.queue[name];replace(device.queue,name,function(...args){if(active)active.nonPass=true;return original.apply(device.queue,args);});
  }
  enabled=true;reason='Render and compute pass timestamps; copies, uploads and clears outside passes are excluded';
 }catch{reason='GPU query instrumentation unavailable';release();}
 return freeze(api);
}
