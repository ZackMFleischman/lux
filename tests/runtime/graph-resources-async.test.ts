import assert from 'node:assert/strict';
import test from 'node:test';
import { nodeIdSchema } from '../../packages/runtime-contracts/src/identities.ts';
import * as R from '../../packages/runtime/src/graph/resources.ts';
import { prepareGraphRuntimePlan } from '../../packages/runtime/src/graph/runtime-plan.ts';
import { validateNestedGraph } from '../../packages/runtime/src/graph/nested-validate.ts';
import * as f from './nested-graph-fixtures.ts';
const profile:R.HostProfile={generation:7,sceneSeed:0,initialClockEpoch:3,width:1920,height:1080,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'};
const descriptor:R.ImageDescriptor={kind:'image',width:1920,height:1080,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'};
const zero={allocations:0,backend:0,inputs:0,frames:0,captures:0};
const code=(name:string)=>(e:any)=>e instanceof Error&&(e as R.ResourceError).code===name;
function deferred<T=void>() {let resolve!:(v:T|PromiseLike<T>)=>void,reject!:(v?:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(raw=f.basic(),backend:R.CpuResourceBackend={produce(){},release(){},capture(){}}){const host=R.createResourceHost(profile,backend);R.attachResourceHost(host,prepareGraphRuntimePlan(validateNestedGraph(raw.graph,raw.definitions)));return host;}
function diamond(parallel=false,unused=false){return f.clone({graph:{version:2,rootDefinitionHash:f.hash(1),outputPort:'image'},definitions:{
  [f.hash(1)]:f.graphDef([f.node(1,2),f.node(2,3),f.node(3,3),f.node(4,4)],[f.edge(1,f.uuid(1),'image',f.uuid(2),'input'),f.edge(2,f.uuid(1),'image',f.uuid(3),'input'),f.edge(3,f.uuid(2),'image',f.uuid(4),'left'),f.edge(4,f.uuid(parallel?2:3),'image',f.uuid(4),'right')],{},{image:f.ref(4)}),
  [f.hash(2)]:{kind:'code',metadata:f.meta({},unused?{image:f.image,unused:f.signal}:{image:f.image})},[f.hash(3)]:{kind:'code',metadata:f.meta({input:f.image})},[f.hash(4)]:{kind:'code',metadata:f.meta({left:f.image,right:f.image})}}});}
async function evaluate(host:R.ResourceHost,frame:R.ResourceFrame,n:number){const e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(n))]);const token=await e.resources.image('image',descriptor,Object.values(e.inputs));const cache=await R.completeResourceNode(host,e.scope,{image:token});return {e,cache,token};}

test('H4 abandoned producer keeps allocation and backend reads until actual settlement',async(t)=>{
  const produce=deferred(),release=deferred(),releaseEntered=deferred();const events:any[]=[];let calls=0;
  const host=fixture(diamond(),{produce(i,inputs){events.push({event:'produce',version:i.version,path:i.nodePath,port:i.portId,inputs:inputs.map(v=>({version:v.version,path:v.nodePath,port:v.portId}))});if(++calls===2)return produce.promise;},capture(){},release(i){events.push({event:'release',version:i.version,path:i.nodePath,port:i.portId});releaseEntered.resolve();return release.promise;}});
  const frame=R.beginResourceFrame(host,3);await evaluate(host,frame,1);
  const e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(2))]),pending=e.resources.image('image',descriptor,[e.inputs.input!]);
  R.failResourceNode(host,e.scope);const disposal=R.disposeResourceHost(host);assert.equal(R.disposeResourceHost(host),disposal);
  events.push({event:'callback-notified',issueClosed:true,destination:{path:[f.uuid(2)],port:'input'},unopenedCancelled:[[f.uuid(3),'input'],[f.uuid(4),'left'],[f.uuid(4),'right']],status:R.readResourceStatus(host)});
  assert.deepEqual(R.readResourceStatus(host).counts,{allocations:2,backend:1,inputs:1,frames:0,captures:0});assert.equal(events.filter(e=>e.event==='release').length,0);
  produce.resolve();await assert.rejects(pending);await releaseEntered.promise;
  events.push({event:'producer-observed',status:R.readResourceStatus(host)});assert.equal(R.readResourceStatus(host).counts.backend,0);assert.equal(R.readResourceStatus(host).counts.allocations,2);
  release.resolve();await disposal;assert.deepEqual(events.filter(e=>e.event==='release').map(e=>e.version).sort(),[1,2]);assert.deepEqual(R.readResourceStatus(host).counts,zero);t.diagnostic(JSON.stringify({criterion:'H4',events}));
});

test('H2 H5 distinct destination views share identity and both reads survive notification',async(t)=>{
  const work=deferred();const produced:R.BackendImage[]=[];const released:number[]=[];let last:readonly R.BackendImage[]=[];
  const host=fixture(diamond(true),{produce(i,views){produced.push(i);last=views;if(produced.length===3)return work.promise;},release(i){released.push(i.version);},capture(){}});
  const frame=R.beginResourceFrame(host,3);await evaluate(host,frame,1);const b=await evaluate(host,frame,2);const d=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(4))]);
  assert.notEqual(d.inputs.left,d.inputs.right);assert.deepEqual({...d.resources.imageDescriptor(d.inputs.left!)},descriptor);
  await assert.rejects(d.resources.image('image',descriptor,[d.inputs.left!,d.inputs.left!]),code('RESOURCE_INVALID'));
  await assert.rejects(d.resources.image('image',descriptor,[b.e.inputs.input!]),code('RESOURCE_INVALID'));
  assert.equal(produced.length,2);
  const pending=d.resources.image('image',descriptor,[d.inputs.right!,d.inputs.left!]);assert.equal(last[0],produced[1]);assert.equal(last[1],produced[1]);assert(Object.isFrozen(last));
  // No output token is published yet. Malformed completion still owes both reads.
  const completion=R.completeResourceNode(host,d.scope,{});assert.equal(R.readResourceStatus(host).openCallbacks,0);
  assert.deepEqual(R.readResourceStatus(host).counts,{allocations:3,backend:1,inputs:2,frames:0,captures:0});
  assert.throws(()=>R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(3))]));
  work.resolve();await assert.rejects(pending);await assert.rejects(completion);await R.disposeResourceHost(host);assert.deepEqual(R.readResourceStatus(host).counts,zero);assert.deepEqual(released.sort(),[1,2,3]);
  t.diagnostic(JSON.stringify({criterion:'H2-H5',producer:{path:produced[1]!.nodePath,port:produced[1]!.portId,version:produced[1]!.version},destinations:['left','right'].map(port=>({path:[f.uuid(4)],port})),backendIdentityEqual:last[0]===last[1],releasedVersions:released,notificationBeforeBackendSettlement:true,final:R.readResourceStatus(host)}));
});

for(const variant of ['missing-image','missing-unused','swapped','getter','symbol','extra','disposed'] as const)test(`H3 all declared outputs and one-shot notification: ${variant}`,async(t)=>{
  let getters=0;const host=fixture(diamond(false,true));const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const image=await e.resources.image('image',descriptor,[]),signal=e.resources.signal('unused',4);let outputs:any={image,unused:signal};
  if(variant==='missing-image')delete outputs.image;if(variant==='missing-unused')delete outputs.unused;if(variant==='swapped')outputs={image:signal,unused:image};
  if(variant==='getter')Object.defineProperty(outputs,'image',{get(){getters++;return image;}});if(variant==='symbol')outputs[Symbol()]=image;if(variant==='extra')outputs.extra=image;
  if(variant==='disposed')R.disposeResourceHost(host);
  await assert.rejects(R.completeResourceNode(host,e.scope,outputs));assert.equal(R.readResourceStatus(host).openCallbacks,0);assert.equal(getters,0);
  await assert.rejects(R.completeResourceNode(host,e.scope,outputs),code('RESOURCE_STALE'));assert.throws(()=>R.failResourceNode(host,e.scope),code('RESOURCE_STALE'));await R.disposeResourceHost(host);
  t.diagnostic(JSON.stringify({criterion:'H3',variant,path:[f.uuid(1)],declaredPorts:['image','unused'],getterCalls:getters,notifications:1,issueClosed:true,final:R.readResourceStatus(host)}));
});

test('H7 H9 capture needs both external release and backend settlement; cleanup retains allocation',async(t)=>{
  const capture=deferred(),release=deferred(),entered=deferred();let image:R.BackendImage|undefined,releases=0;
  const host=fixture(f.basic(),{produce(i){image=i;},capture(i){assert.equal(i,image);return capture.promise;},release(i){assert.equal(i,image);releases++;entered.resolve();return release.promise;}});
  const frame=R.beginResourceFrame(host,3),a=await evaluate(host,frame,1);R.releaseResourceCache(host,a.cache);const reader=R.finishResourceFrame(host,frame);
  assert.deepEqual(R.readResourceStatus(host).counts,{allocations:1,backend:0,inputs:0,frames:1,captures:0});
  const hold=reader.capture();assert.deepEqual(R.readResourceStatus(host).counts,{allocations:1,backend:1,inputs:0,frames:1,captures:1});reader.release();reader.release();hold.release();hold.release();
  assert.deepEqual(R.readResourceStatus(host).counts,{allocations:1,backend:1,inputs:0,frames:0,captures:1});const disposal=R.disposeResourceHost(host);let disposed=false;void disposal.then(()=>disposed=true);assert.equal(disposed,false);assert.equal(releases,0);
  capture.resolve();await entered.promise;assert.equal(disposed,false);assert.equal(R.readResourceStatus(host).cleanupPending,1);assert.equal(R.readResourceStatus(host).counts.captures,0);release.resolve();await disposal;assert.equal(releases,1);assert.deepEqual(R.readResourceStatus(host).counts,zero);t.diagnostic(JSON.stringify({criterion:'H7-H9',allocation:{version:image!.version,path:image!.nodePath,port:image!.portId},releases,externalIntentBeforeBackendSettlement:true,physicalReleaseSettled:true,final:R.readResourceStatus(host)}));
});

test('H9 disposal waits unnotified callback and externally held settled capture separately',async()=>{
  const host=fixture();const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);const token=await e.resources.image('image',descriptor,[]);
  const disposal=R.disposeResourceHost(host);let disposed=false;void disposal.then(()=>disposed=true);assert.equal(R.readResourceStatus(host).openCallbacks,1);assert.equal(disposed,false);
  await assert.rejects(R.completeResourceNode(host,e.scope,{image:token}));await disposal;
  const h=fixture();const f2=R.beginResourceFrame(h,3),a=await evaluate(h,f2,1),reader=R.finishResourceFrame(h,f2),hold=reader.capture();reader.release();R.releaseResourceCache(h,a.cache);
  const d=R.disposeResourceHost(h);const peer=fixture(),peerFrame=R.beginResourceFrame(peer,3);await evaluate(peer,peerFrame,1);
  assert.equal(R.readResourceStatus(h).counts.backend,0);assert.equal(R.readResourceStatus(h).counts.captures,1);assert.equal(R.readResourceStatus(h).counts.allocations,1);hold.release();await d;await R.disposeResourceHost(peer);assert.deepEqual(R.readResourceStatus(h).counts,zero);
});

for(const failure of ['throw','reject'] as const)test(`H8 partial failed production receives same allocation release; cleanup ${failure} never retries`,async()=>{
  let image:R.BackendImage|undefined,releases=0,getters=0;const work=deferred(),cleanup=deferred();const entered=deferred();
  const bad=Object.defineProperty({},'message',{get(){getters++;return 'bad';}});
  const host=fixture(f.basic(),{produce(i){image=i;return work.promise;},capture(){},release(i){assert.equal(i,image);releases++;entered.resolve();if(failure==='throw')throw bad;return cleanup.promise;}});
  const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]),pending=e.resources.image('image',descriptor,[]);R.failResourceNode(host,e.scope);work.reject({message:'production failed'});await assert.rejects(pending);await entered.promise;
  if(failure==='reject')cleanup.reject(bad);
  const disposal=R.disposeResourceHost(host);await assert.rejects(disposal,(error:R.ResourceError)=>{assert.equal(error.code,'RESOURCE_BACKEND');assert.equal(error.unreclaimed,1);assert.equal(error.cleanupFailures?.length,1);assert(!Object.hasOwn(error,'cause'));return true;});
  assert.equal(R.disposeResourceHost(host),disposal);assert.equal(getters,0);assert.equal(releases,1);assert.equal(R.readResourceStatus(host).releaseFailed,1);assert.equal(R.readResourceStatus(host).cleanupPending,0);assert.equal(R.readResourceStatus(host).counts.allocations,1);
});

for(const target of ['path','descriptor','outputs'] as const)for(const trap of ['getPrototypeOf','ownKeys','getOwnPropertyDescriptor'] as const)test(`H10 disposal during ${target} ${trap} prevents stale publication`,async()=>{
  let calls=0;const host=fixture(f.basic(),{produce(){calls++;},capture(){},release(){}});const frame=R.beginResourceFrame(host,3);let disposal:Promise<void>|undefined;
  function wrapped<T extends object>(value:T):T {return new Proxy(value,{[trap](object:any,key:any){disposal=R.disposeResourceHost(host);assert.equal(disposal,R.disposeResourceHost(host));return (Reflect[trap] as any)(object,key);}});}
  if(target==='path'){assert.throws(()=>R.openResourceNode(host,frame,wrapped([nodeIdSchema.parse(f.uuid(1))])));assert.equal(calls,0);}
  else {const e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);if(target==='descriptor'){await assert.rejects(e.resources.image('image',wrapped(descriptor),[]));assert.equal(calls,0);R.failResourceNode(host,e.scope);}else{const token=await e.resources.image('image',descriptor,[]);await assert.rejects(R.completeResourceNode(host,e.scope,wrapped({image:token})));assert.equal(R.readResourceStatus(host).openCallbacks,0);}}
  await disposal;assert.equal(R.readResourceStatus(host).state,'drained');assert.deepEqual(R.readResourceStatus(host).counts,zero);
});

test('H10 backend and then getter see committed issuance; terminal continuation cannot publish',async()=>{
  let evaluation:R.Evaluation,host:R.ResourceHost,duplicate:Promise<R.OutputToken>|undefined,disposal:Promise<void>|undefined;let releases=0;
  const backend:R.CpuResourceBackend={produce(){assert.equal(R.readResourceStatus(host).counts.backend,1);duplicate=evaluation.resources.image('image',descriptor,[]);return {get then(){disposal=R.disposeResourceHost(host);return (yes:()=>void,no:(e:unknown)=>void)=>{yes();yes();no('late');};}} as any;},capture(){},release(){releases++;assert.equal(R.disposeResourceHost(host),disposal);}};
  host=fixture(f.basic(),backend);const frame=R.beginResourceFrame(host,3);evaluation=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);const pending=evaluation.resources.image('image',descriptor,[]);
  await assert.rejects(duplicate!,code('RESOURCE_INVALID'));R.failResourceNode(host,evaluation.scope);await assert.rejects(pending);await R.disposeResourceHost(host);assert.equal(releases,1);assert.deepEqual(R.readResourceStatus(host).counts,zero);
});

test('H3 notification after a second producer wave waits that exact pending producer',async()=>{
  const raw=f.basic();raw.definitions[f.hash(2)].metadata=f.clone(f.meta({},{image:f.image,second:f.image}));
  const work=deferred(),entered=deferred();let calls=0;
  const host=fixture(raw,{produce(){if(++calls===2)return work.promise;},capture(){},release(){entered.resolve();}});
  const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const first=await e.resources.image('image',descriptor,[]);const second=e.resources.image('second',descriptor,[]);
  let completionSettled=false;const complete=R.completeResourceNode(host,e.scope,{image:first});void complete.then(()=>completionSettled=true,()=>completionSettled=true);
  // A separate host's actual producer and callback settlement is the observation signal.
  const peer=fixture(),peerFrame=R.beginResourceFrame(peer,3);
  try {await evaluate(peer,peerFrame,1);assert.equal(completionSettled,false);assert.equal(R.readResourceStatus(host).counts.backend,1);}
  finally {work.resolve();await assert.rejects(second);await assert.rejects(complete);await R.disposeResourceHost(host);await R.disposeResourceHost(peer);}
});

test('H2 signal views reject image dispatch; old and foreign views cannot become authority',async()=>{
  const raw:any=diamond(true,true);raw.definitions[f.hash(3)].metadata=f.clone(f.meta({input:f.signal}));
  raw.definitions[f.hash(1)].body.edges[0].from.portId='unused';raw.definitions[f.hash(1)].body.edges[1].from.portId='unused';
  let calls=0;const host=fixture(raw,{produce(){calls++;},capture(){},release(){}});const frame=R.beginResourceFrame(host,3),a=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const output=await a.resources.image('image',descriptor,[]),signal=a.resources.signal('unused',6.125);
  await R.completeResourceNode(host,a.scope,{image:output,unused:signal});const b=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(2))]);
  assert.deepEqual(b.resources.readSignal(b.inputs.input!),{kind:'signal',value:6.125,unit:null,clock:'frame'});
  await assert.rejects(b.resources.image('image',descriptor,[b.inputs.input!]),code('RESOURCE_INVALID'));
  assert.throws(()=>b.resources.imageDescriptor(b.inputs.input!),code('RESOURCE_INVALID'));
  for(const token of [structuredClone(b.inputs.input),new Proxy(b.inputs.input!,{}),output])assert.throws(()=>b.resources.readSignal(token as R.InputView),code('RESOURCE_INVALID'));
  assert.equal(calls,1);R.failResourceNode(host,b.scope);assert.throws(()=>b.resources.readSignal(b.inputs.input!));await R.disposeResourceHost(host);
});

test('H10 nested admissions and complete/fail reject before reflection or second notification',async()=>{
  const host=fixture(),frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);let getters=0;
  const poison=new Proxy({},{getPrototypeOf(){getters++;throw Error('must not inspect');}});
  let nested:Promise<R.OutputToken>|undefined,nestedComplete:Promise<R.CachedOutputs>|undefined;
  const data=new Proxy(descriptor,{ownKeys(target){nested=e.resources.image('image',poison as R.ImageDescriptor,[]);nestedComplete=R.completeResourceNode(host,e.scope,poison);assert.throws(()=>R.failResourceNode(host,e.scope),code('RESOURCE_REENTRY'));assert.equal(R.readResourceStatus(host).openCallbacks,1);return Reflect.ownKeys(target);}});
  const token=await e.resources.image('image',data,[]);await assert.rejects(nested!,code('RESOURCE_REENTRY'));await assert.rejects(nestedComplete!,code('RESOURCE_REENTRY'));assert.equal(getters,0);
  const cache=await R.completeResourceNode(host,e.scope,{image:token});R.releaseResourceCache(host,cache);R.finishResourceFrame(host,frame).release();await R.disposeResourceHost(host);
});

test('H10 release during descriptor capture changes marker before outer dispatch',async()=>{
  let calls=0;const host=fixture(f.basic(),{produce(){calls++;},capture(){},release(){}});let frame=R.beginResourceFrame(host,3);const old=await evaluate(host,frame,1);const reader=R.finishResourceFrame(host,frame);
  frame=R.beginResourceFrame(host,3);const e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const data=new Proxy(descriptor,{ownKeys(target){reader.release();return Reflect.ownKeys(target);}});
  await assert.rejects(e.resources.image('image',data,[]),code('RESOURCE_STALE'));assert.equal(calls,1);
  const token=await e.resources.image('image',descriptor,[]);const cache=await R.completeResourceNode(host,e.scope,{image:token});const next=R.finishResourceFrame(host,frame);assert.equal(next.version,2);
  R.releaseResourceCache(host,old.cache);R.releaseResourceCache(host,cache);next.release();await R.disposeResourceHost(host);
});

test('H8 primary message is immutable even when author receives its rejected promise',async()=>{
  const host=fixture(f.basic(),{produce(){throw {message:'first backend failure'};},capture(){},release(){throw {message:'cleanup failed'};}});
  const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);let exposed:R.ResourceError|undefined;
  await assert.rejects(e.resources.image('image',descriptor,[]),(value:R.ResourceError)=>{exposed=value;return true;});
  assert.throws(()=>Object.defineProperty(exposed!,'message',{get(){throw Error('unsafe error getter');}}),TypeError);
  R.failResourceNode(host,e.scope);await assert.rejects(R.disposeResourceHost(host),(value:R.ResourceError)=>{assert.equal(value.code,'RESOURCE_BACKEND');assert.equal(value.message,'first backend failure');assert.equal(value.cleanupFailures?.[0]?.message,'cleanup failed');return true;});
});

test('H2 a second evaluation gets fresh views while old caches retain source allocations',async()=>{
  const host=fixture(diamond(true));const frame=R.beginResourceFrame(host,3);const firstA=await evaluate(host,frame,1),firstB=await evaluate(host,frame,2),firstD=await evaluate(host,frame,4);
  R.finishResourceFrame(host,frame).release();const next=R.beginResourceFrame(host,3);await evaluate(host,next,1);
  const b=R.openResourceNode(host,next,[nodeIdSchema.parse(f.uuid(2))]);assert.notEqual(b.inputs.input,firstB.e.inputs.input);
  await assert.rejects(b.resources.image('image',descriptor,[firstB.e.inputs.input!]),code('RESOURCE_INVALID'));
  const token=await b.resources.image('image',descriptor,[b.inputs.input!]);await R.completeResourceNode(host,b.scope,{image:token});await evaluate(host,next,4);R.finishResourceFrame(host,next).release();
  assert.equal(R.readResourceStatus(host).counts.allocations,6);R.releaseResourceCache(host,firstA.cache);R.releaseResourceCache(host,firstB.cache);R.releaseResourceCache(host,firstD.cache);await R.disposeResourceHost(host);assert.deepEqual(R.readResourceStatus(host).counts,zero);
});

test('H3 unused signal owns only its cache pin and duplicate port issuance never dispatches',async()=>{
  const raw=f.basic();raw.definitions[f.hash(2)].metadata=f.clone(f.meta({},{image:f.image,unused:f.signal}));let calls=0,releases=0;
  const host=fixture(raw,{produce(){calls++;},capture(){},release(){releases++;}});const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const image=await e.resources.image('image',descriptor,[]),signal=e.resources.signal('unused',1);
  await assert.rejects(e.resources.image('image',descriptor,[]),code('RESOURCE_INVALID'));assert.throws(()=>e.resources.signal('unused',2),code('RESOURCE_INVALID'));assert.equal(calls,1);
  const cache=await R.completeResourceNode(host,e.scope,{image,unused:signal});assert.equal(R.readResourceStatus(host).counts.allocations,2);R.releaseResourceCache(host,cache);
  const peer=fixture(),peerFrame=R.beginResourceFrame(peer,3);await evaluate(peer,peerFrame,1);
  assert.equal(R.readResourceStatus(host).counts.allocations,1);assert.equal(releases,0);R.finishResourceFrame(host,frame).release();await R.disposeResourceHost(host);await R.disposeResourceHost(peer);assert.equal(releases,1);
});

test('H8 H10 throwing error reflection and capture backend failure retain independent release intent',async()=>{
  let host:R.ResourceHost,disposal:Promise<void>|undefined,releases=0,trapCalls=0;
  const thrown=new Proxy({},{getOwnPropertyDescriptor(){trapCalls++;disposal=R.disposeResourceHost(host);throw Error('reflection failed');}});
  host=fixture(f.basic(),{produce(){},capture(){throw thrown;},release(){releases++;}});const frame=R.beginResourceFrame(host,3),a=await evaluate(host,frame,1);const reader=R.finishResourceFrame(host,frame);R.releaseResourceCache(host,a.cache);
  const hold=reader.capture();reader.release();assert.equal(R.readResourceStatus(host).state,'terminal');assert.equal(R.readResourceStatus(host).counts.backend,0);assert.equal(R.readResourceStatus(host).counts.captures,1);assert.equal(releases,0);assert.equal(trapCalls,1);assert.equal(disposal,R.disposeResourceHost(host));
  hold.release();await disposal;assert.equal(releases,1);assert.deepEqual(R.readResourceStatus(host).counts,zero);
});

test('H4 H8 abandoned rejected production still releases the exact partially allocated backend object',async()=>{
  const work=deferred(),entered=deferred();let produced:R.BackendImage|undefined,releases=0;
  const host=fixture(f.basic(),{produce(i){produced=i;return work.promise;},capture(){},release(i){assert.equal(i,produced);releases++;entered.resolve();}});
  const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  void e.resources.image('image',descriptor,[]);R.failResourceNode(host,e.scope);work.reject({message:'partially allocated'});
  await entered.promise;await R.disposeResourceHost(host);assert.equal(releases,1);assert.deepEqual(R.readResourceStatus(host).counts,zero);
});

test('H3 two image tokens cannot be swapped between their declared producer ports',async()=>{
  const raw=f.basic();raw.definitions[f.hash(2)].metadata=f.clone(f.meta({},{image:f.image,other:f.image}));
  const host=fixture(raw),frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const image=await e.resources.image('image',descriptor,[]),other=await e.resources.image('other',descriptor,[]);
  await assert.rejects(R.completeResourceNode(host,e.scope,{image:other,other:image}),code('RESOURCE_INVALID'));assert.equal(R.readResourceStatus(host).openCallbacks,0);await R.disposeResourceHost(host);
});
