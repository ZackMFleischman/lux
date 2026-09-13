import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';import {fileURLToPath,pathToFileURL} from 'node:url';
async function run({submitError=false,slow=false,delayedValidation=false}={}){
 let clock=1000000000n,submits=0;const scopes=[],textures=[],boundaryInputs=[];
 const device={features:new Set(['timestamp-query']),lost:new Promise(()=>{}),addEventListener(){},destroy(){},
  pushErrorScope(){scopes.push(null);},popErrorScope(){const inner=scopes.length===2,error=scopes.pop();return delayedValidation&&inner?new Promise(resolve=>setTimeout(()=>resolve(error),10)):Promise.resolve(error);},
  createShaderModule(){return {};},async createRenderPipelineAsync(){return {getBindGroupLayout(){return {};}};},createBindGroup({entries}){return {view:entries[0].resource};},
  createTexture({size}){const t={size,value:0,createView(){return {texture:t};},destroy(){}};textures.push(t);return t;},createQuerySet({count}){return {values:new BigUint64Array(count),destroy(){}};},
  createBuffer({size}){const b={bytes:new ArrayBuffer(size),mapAsync:async()=>{},getMappedRange:()=>b.bytes,unmap(){},destroy(){}};return b;},
  queue:{submit(buffers){submits++;if(submitError&&submits===2)scopes[scopes.length-1]={message:'real submit validation error'};for(const commands of buffers)for(const command of commands)command();},onSubmittedWorkDone:async()=>{}},
  createCommandEncoder(){const commands=[];return {
   beginComputePass(){return {end(){}};},
   beginRenderPass(descriptor){let drawing=false,group;return {setPipeline(){},setBindGroup(_index,value){group=value;},draw(){drawing=true;},end(){commands.push(()=>{
    const q=descriptor.timestampWrites;if(q?.beginningOfPassWriteIndex!==undefined)q.querySet.values[q.beginningOfPassWriteIndex]=clock;
    const target=descriptor.colorAttachments[0].view.texture;target.value=0;if(drawing)target.value=group.view.texture.value+1;
    clock+=drawing?(slow?4000000n:100000n):1000n;
    if(q?.endOfPassWriteIndex!==undefined){if(q.querySet.values.length===2)boundaryInputs.push(textures.slice(0,2).map(t=>t.value));q.querySet.values[q.endOfPassWriteIndex]=clock;}
   });}};},
   resolveQuerySet(query,first,count,destination){commands.push(()=>{new BigUint64Array(destination.bytes).set(query.values.slice(first,first+count));clock+=1000n;});},
   copyBufferToBuffer(source,from,destination,to,size){commands.push(()=>{new Uint8Array(destination.bytes,to,size).set(new Uint8Array(source.bytes,from,size));clock+=1000n;});},finish(){return commands;},
  };},
 };
 const context=vm.createContext({performance,setTimeout,window:{},navigator:{gpu:{requestAdapter:async()=>({features:device.features,info:{},requestDevice:async()=>device})}},GPUTextureUsage:{RENDER_ATTACHMENT:16,TEXTURE_BINDING:4},GPUBufferUsage:{QUERY_RESOLVE:512,COPY_SRC:4,COPY_DST:8,MAP_READ:1},GPUMapMode:{READ:1},BigUint64Array,ArrayBuffer,Uint8Array,console});
 const cache=new Map();async function module(url){if(cache.has(url))return cache.get(url);const source=await fs.readFile(fileURLToPath(url),'utf8');const m=new vm.SourceTextModule(source,{context,identifier:url});cache.set(url,m);await m.link((specifier,parent)=>module(new URL(specifier,parent.identifier).href));return m;}
 const main=await module(new URL('../../tools/gpu-spike/query-overhead/renderer.mjs',import.meta.url).href);await main.evaluate();const result=await context.window.runQueryOverhead();return {result,submits,boundaryInputs};
}
test('actual renderer orchestration resets input before each boundary and drains real timer accounting',async()=>{
 const {result,submits,boundaryInputs}=await run();assert.equal(result.ok,true,JSON.stringify({errors:result.errors,timer:result.timer,samples:result.samples,batches:result.batches.length}));assert.equal(result.batches.length,40);assert.equal(submits,41);assert.equal(result.timer.completedSamples,20);assert.equal(result.timer.pendingSamples,0);assert.equal(boundaryInputs.length,40);assert.ok(boundaryInputs.every(values=>values[0]===0&&values[1]===0));
});
test('submit-time validation after timer scope pop invalidates the whole run',async()=>{const {result,submits}=await run({submitError:true});assert.equal(result.ok,false);assert.match(result.errors.join('\n'),/Whole-batch submit validation/);assert.equal(submits,2);});
test('delayed inner validation settles before the next batch without fixed microtask assumptions',async()=>{const {result}=await run({delayedValidation:true});assert.equal(result.ok,true,JSON.stringify(result.errors));assert.equal(result.timer.completedSamples,20);});
test('oversized first batch is retained and stops all subsequent GPU submissions',async()=>{const {result,submits}=await run({slow:true});assert.equal(result.ok,false);assert.equal(result.batches.length,1);assert.ok(result.batches[0].durationMs>100);assert.equal(submits,2);});
