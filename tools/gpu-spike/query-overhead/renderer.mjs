import {createGpuPassTimer} from '../../../packages/performance/gpu-pass.mjs';
import {installSubmitStaging,waitForTimerDrain} from './staging.mjs';
import {summarizeQueryOverhead} from './report.mjs';
const need=(ok,message)=>{if(!ok)throw Error(message);};
window.runQueryOverhead=async()=>{
 const evidence={schema:1,batches:[],samples:[],errors:[],settings:{width:1920,height:1080,framesPerBatch:30,warmupBatches:8,abbaBlocks:8,batchLimitMs:100,shaderIterations:8},timer:null};
 let device,stage,timer,baseline,textureA,textureB,boundaryTexture,query,resolve,read;
 try{
  const adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});need(adapter,'WebGPU adapter unavailable');need(adapter.features.has('timestamp-query'),'Timestamp-query unavailable');
  evidence.adapter=Object.fromEntries(['vendor','architecture','device','description','isFallbackAdapter'].map(k=>[k,adapter.info?.[k]??null]));
  device=await adapter.requestDevice({requiredFeatures:['timestamp-query']});
  device.addEventListener('uncapturederror',event=>evidence.errors.push(String(event.error?.message??event.error)));
  let intentionallyDestroyed=false;device.lost.then(info=>{if(!intentionallyDestroyed)evidence.errors.push('Device lost: '+info.message);});
  const rawEncoder=device.createCommandEncoder.bind(device),rawSubmit=device.queue.submit.bind(device.queue);
  device.pushErrorScope('validation');
  const shader=device.createShaderModule({code:`
   @group(0) @binding(0) var prior:texture_2d<f32>;
   @vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {
    var p=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));return vec4f(p[i],0.,1.);
   }
   @fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f {
    var c=textureLoad(prior,vec2i(p.xy),0).rgb+vec3f(p.x/1920.,p.y/1080.,.13);
    for(var i=0u;i<8u;i++){c=fract(c*vec3f(1.017,1.031,1.043)+vec3f(.071,.113,.173));}
    return vec4f(c,1.);
   }`});
  const pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:shader,entryPoint:'vs'},fragment:{module:shader,entryPoint:'fs',targets:[{format:'rgba8unorm'}]}});
  const texture=()=>device.createTexture({size:[1920,1080],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});textureA=texture();textureB=texture();
  boundaryTexture=device.createTexture({size:[1,1],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT});
  const views=[textureA.createView(),textureB.createView()],boundaryView=boundaryTexture.createView();
  const groups=views.map(view=>device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:view}]}));
  const attachment=view=>({view,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}});
  query=device.createQuerySet({type:'timestamp',count:2});resolve=device.createBuffer({size:16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});read=device.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const init=rawEncoder();for(const view of views)init.beginRenderPass({colorAttachments:[attachment(view)]}).end();rawSubmit([init.finish()]);await device.queue.onSubmittedWorkDone();need(!(await device.popErrorScope()),'GPU setup validation failed');
  stage=installSubmitStaging(device);
  timer=createGpuPassTimer(device,(frame,ms,complete)=>{evidence.samples.push({frame,ms,complete});return true;});baseline=createGpuPassTimer(device,()=>{throw Error('Baseline unexpectedly sampled');},{mode:'baseline'});
  need(timer.status().timestampQueryEnabled,'Actual query timer unavailable');
  for(let index=0;index<40;index++){
   const mode=index<8?(index%2?'routine':'baseline'):['baseline','routine','routine','baseline'][(index-8)%4],routine=mode==='routine',api=routine?timer:baseline;
   device.pushErrorScope('validation');stage.begin();
   const first=rawEncoder();
   // Identical input pixels for both modes. Resets precede the measured start
   // boundary in the same submit; all30 body frames still depend on prior output.
   for(const view of views)first.beginRenderPass({colorAttachments:[attachment(view)]}).end();
   first.beginRenderPass({colorAttachments:[attachment(boundaryView)],timestampWrites:{querySet:query,endOfPassWriteIndex:0}}).end();stage.append(first.finish());
   for(let offset=0;offset<30;offset++){
    api.begin(index*30+offset+1);const e=device.createCommandEncoder(),pass=e.beginRenderPass({colorAttachments:[attachment(views[(offset+1)%2])]});pass.setPipeline(pipeline);pass.setBindGroup(0,groups[offset%2]);pass.draw(3);pass.end();device.queue.submit([e.finish()]);api.end();
   }
   const last=rawEncoder();last.beginRenderPass({colorAttachments:[attachment(boundaryView)],timestampWrites:{querySet:query,beginningOfPassWriteIndex:1}}).end();last.resolveQuerySet(query,0,2,resolve,0);last.copyBufferToBuffer(resolve,0,read,0,16);stage.append(last.finish());
   const staging=stage.flush(),validation=device.popErrorScope();
   await Promise.all([read.mapAsync(GPUMapMode.READ),stage.drain()]);const values=[...new BigUint64Array(read.getMappedRange())];read.unmap();
   need(!(await validation),'Whole-batch submit validation failed');await waitForTimerDrain(timer);need(evidence.errors.length===0,'Uncaptured GPU error');
   need(values[0]>0n&&values[1]>values[0],'Invalid GPU endpoints');
   const durationMs=Number(values[1]-values[0])/1e6;
   evidence.batches.push({index,mode,warmup:index<8,firstFrame:index*30+1,frames:30,start:String(values[0]),end:String(values[1]),durationMs,staging});
   evidence.timer=timer.status();need(durationMs<=100,'GPU batch exceeded100ms; stopping all further work');
   const expected=evidence.batches.filter(x=>x.mode==='routine').length;
   need(evidence.timer.completedSamples===expected&&evidence.timer.failedSamples===0&&evidence.timer.droppedSamples===0&&evidence.timer.pendingSamples===0,'Actual routine timer sample accounting failed');
  }
  evidence.summary=summarizeQueryOverhead(evidence);evidence.ok=true;
  timer.dispose();baseline.dispose();stage.restore();stage=null;intentionallyDestroyed=true;
 }catch(error){evidence.ok=false;evidence.errors.push(String(error?.stack??error));}
 finally{
  // The reviewed outer Job remains the bound if native GPU work/map cannot finish.
  try{stage?.abort(Error('Probe stopped'));await stage?.drain();}catch{}
  try{timer?.dispose();baseline?.dispose();stage?.restore();}catch{}
  for(const resource of [textureA,textureB,boundaryTexture,query,resolve,read])try{resource?.destroy();}catch{}
  try{device?.destroy();}catch{}
 }
 return evidence;
};
