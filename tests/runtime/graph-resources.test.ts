import assert from 'node:assert/strict';
import test from 'node:test';
import { nodeIdSchema } from '../../packages/runtime-contracts/src/identities.ts';
import * as R from '../../packages/runtime/src/graph/resources.ts';
import { prepareGraphRuntimePlan, readGraphRuntimePlan } from '../../packages/runtime/src/graph/runtime-plan.ts';
import { validateNestedGraph } from '../../packages/runtime/src/graph/nested-validate.ts';
import * as f from './nested-graph-fixtures.ts';

const profile: R.HostProfile = {generation:7,sceneSeed:0,initialClockEpoch:3,width:1920,height:1080,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'};
const descriptor: R.ImageDescriptor = {kind:'image',width:1920,height:1080,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'};
const zero = {allocations:0,backend:0,inputs:0,frames:0,captures:0};
const code = (name:string) => (e:any) => e instanceof Error && (e as R.ResourceError).code === name;
const plan = (raw=f.basic()) => prepareGraphRuntimePlan(validateNestedGraph(raw.graph,raw.definitions));
const hidden = (value:object) => Object.freeze(Object.defineProperties(Object.create(null),Object.fromEntries(Object.entries(value).map(([k,v])=>[k,{value:v}]))));
function fixture(raw=f.basic(), backend:R.CpuResourceBackend={produce(){},capture(){},release(){}}) {
  const host=R.createResourceHost(profile,backend); const p=plan(raw); R.attachResourceHost(host,p); return {host,p};
}
async function one(host:R.ResourceHost, outputs=1) {
  const frame=R.beginResourceFrame(host,3), evaluation=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const result:Record<string,R.OutputToken>={};
  for(let i=0;i<outputs;i++){const port=i===0?'image':`unused${i}`;result[port]=await evaluation.resources.image(port,descriptor,[]);}
  const cache=await R.completeResourceNode(host,evaluation.scope,result);
  return {frame,cache,evaluation};
}
function fullOutputs() { const raw=f.basic();raw.definitions[f.hash(2)].metadata=f.clone(f.meta({},Object.fromEntries(Array.from({length:16},(_,i)=>[i===0?'image':`unused${i}`,f.image]))));return raw; }
function fullInputs() {
  const signals=Object.fromEntries(Array.from({length:16},(_,i)=>[`p${i}`,f.signal]));
  const images=Object.fromEntries(Array.from({length:16},(_,i)=>[`p${i}`,f.image]));
  const group=f.graphDef([...Array.from({length:16},(_,i)=>f.node(i+1,3)),f.node(17,4)],Array.from({length:16},(_,i)=>f.edge(i+1,f.uuid(i+1),'image',f.uuid(17),`p${i}`)),Object.fromEntries(Object.keys(signals).map(id=>[id,Array.from({length:16},(_,i)=>f.ref(i+1,id))])),{image:f.ref(17)},{},f.meta(signals));
  const edges:any[]=[];let eid=1;
  for(let g=0;g<15;g++)for(let p=0;p<16;p++)edges.push(f.edge(eid++,f.uuid(1),`p${p}`,f.uuid(g+2),`p${p}`));
  for(let g=0;g<15;g++)edges.push(f.edge(eid++,f.uuid(g+2),'image',f.uuid(17),`p${g}`));
  edges.push(f.edge(eid++,f.uuid(1),'p0',f.uuid(17),'p15'));
  return f.clone({graph:{version:2,rootDefinitionHash:f.hash(1),outputPort:'image'},definitions:{
    [f.hash(1)]:f.graphDef([f.node(1,2),...Array.from({length:15},(_,i)=>f.node(i+2,5)),f.node(17,6)],edges,{},{image:f.ref(17)}),
    [f.hash(2)]:{kind:'code',metadata:f.meta({},signals)},[f.hash(3)]:{kind:'code',metadata:f.meta(signals)},[f.hash(4)]:{kind:'code',metadata:f.meta(images)},[f.hash(5)]:group,
    [f.hash(6)]:{kind:'code',metadata:f.meta({...Object.fromEntries(Array.from({length:15},(_,i)=>[`p${i}`,f.image])),p15:f.signal})}}});
}

test('H1 authentic attachment is once; own non-enumerable captures reject accessors without calls',async()=>{
  let calls=0,getters=0;const backend={produce(){calls++;},release(){},capture(){}};
  const host=R.createResourceHost(hidden(profile),hidden(backend));const p=plan(),p2=plan();
  for(const bad of [structuredClone(p),new Proxy(p,{}),{},null])assert.throws(()=>R.attachResourceHost(host,bad as any),code('RESOURCE_INVALID'));
  R.attachResourceHost(host,p);assert.throws(()=>R.attachResourceHost(host,p),code('RESOURCE_INVALID'));assert.throws(()=>R.attachResourceHost(host,p2),code('RESOURCE_INVALID'));
  for(const bad of [{...profile,width:0},{...profile,width:4097},{...profile,generation:Number.MAX_SAFE_INTEGER+1},{...profile,sceneSeed:-1},{...profile,extra:1},Object.defineProperty({...profile},'width',{get(){getters++;return 1;}})])assert.throws(()=>R.createResourceHost(bad as any,backend),code('RESOURCE_INVALID'));
  const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  await assert.rejects(e.resources.image('image',{...descriptor,width:1919},[]),code('RESOURCE_INVALID'));
  assert.deepEqual(R.readResourceStatus(host).counts,zero);assert.equal(calls,0);assert.equal(getters,0);
  const token=await e.resources.image('image',hidden(descriptor),[]);const cache=await R.completeResourceNode(host,e.scope,hidden({image:token}));
  assert.equal(Object.getPrototypeOf(host),null);assert.deepEqual(Reflect.ownKeys(token),[]);assert(Object.isFrozen(cache));
  R.releaseResourceCache(host,cache);R.finishResourceFrame(host,frame).release();await R.disposeResourceHost(host);
});

test('H6 final hold survives cache release; old caches survive replacement',async()=>{
  const released:number[]=[];const {host}=fixture(f.basic(),{produce(){},capture(){},release(i){released.push(i.version);}});
  const a=await one(host);R.releaseResourceCache(host,a.cache);assert.deepEqual(released,[]);
  const reader=R.finishResourceFrame(host,a.frame);assert.equal(reader.version,1);
  const b=await one(host);const reader2=R.finishResourceFrame(host,b.frame);reader.release();
  const c=await one(host);assert.equal(R.readResourceStatus(host).counts.allocations,2);
  const reader3=R.finishResourceFrame(host,c.frame);reader2.release();reader3.release();
  assert.equal(R.readResourceStatus(host).counts.allocations,2);R.releaseResourceCache(host,b.cache);R.releaseResourceCache(host,c.cache);
  await R.disposeResourceHost(host);assert.deepEqual(released.sort(),[1,2,3]);
  assert.deepEqual(R.readResourceStatus(host).counts,zero);
});

test('H11 authentic 257 reachable leaves reserve exactly 4096 destination ports',async(t)=>{
  const {host,p}=fixture(fullInputs());const dto=readGraphRuntimePlan(p);
  assert.equal(dto.nodes.length,257);assert.equal(dto.nodes.reduce((n,v)=>n+v.inputs.length,0),4096);assert.equal(dto.prunedNodePaths.length,0);
  R.beginResourceFrame(host,3);assert.deepEqual(R.readResourceStatus(host).counts,{allocations:0,backend:0,inputs:4096,frames:0,captures:0});
  await R.disposeResourceHost(host);assert.deepEqual(R.readResourceStatus(host).counts,zero);
  t.diagnostic(JSON.stringify({criterion:'H11-inputs',reachable:257,inputs:4096,pruned:0,drained:R.readResourceStatus(host)}));
});

test('H11 8192 retained outputs reject next issue without dispatch or eviction',async(t)=>{
  let produced=0,released=0;const {host}=fixture(fullOutputs(),{produce(){produced++;},capture(){},release(){released++;}});
  const caches:R.CachedOutputs[]=[];
  for(let i=0;i<512;i++){const r=await one(host,16);caches.push(r.cache);R.finishResourceFrame(host,r.frame).release();}
  assert.equal(produced,8192);assert.deepEqual(R.readResourceStatus(host).counts,{allocations:8192,backend:0,inputs:0,frames:0,captures:0});
  const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  await assert.rejects(e.resources.image('image',descriptor,[]),code('RESOURCE_CAPACITY'));assert.equal(produced,8192);assert.equal(released,0);
  R.failResourceNode(host,e.scope);await R.disposeResourceHost(host);assert.equal(released,8192);assert.deepEqual(R.readResourceStatus(host).counts,zero);
  t.diagnostic(JSON.stringify({criterion:'H11-allocations',frames:512,outputsPerFrame:16,produced,released}));
});

test('H11 reader and capture cap plus one leave prior holders intact',async(t)=>{
  let captures=0;const {host}=fixture(f.basic(),{produce(){},capture(){captures++;},release(){}});const readers:R.FrameOutput[]=[];
  for(let i=0;i<16;i++){const r=await one(host);readers.push(R.finishResourceFrame(host,r.frame));R.releaseResourceCache(host,r.cache);}
  const pending=await one(host);assert.throws(()=>R.finishResourceFrame(host,pending.frame),code('RESOURCE_CAPACITY'));
  const holds=Array.from({length:16},()=>readers[0]!.capture());assert.throws(()=>readers[0]!.capture(),code('RESOURCE_CAPACITY'));assert.equal(captures,16);
  readers[0]!.release();readers[0]!.release();assert.throws(()=>readers[0]!.capture(),code('RESOURCE_STALE'));
  const replacement=R.finishResourceFrame(host,pending.frame);assert.notEqual(replacement,readers[0]);R.releaseResourceCache(host,pending.cache);
  for(const r of readers)r.release();replacement.release();for(const h of holds){h.release();h.release();}
  await R.disposeResourceHost(host);assert.deepEqual(R.readResourceStatus(host).counts,zero);
  t.diagnostic(JSON.stringify({criterion:'H11-holders',readers:16,captures,final:R.readResourceStatus(host)}));
});

test('H13 8192 failed releases retain bounded evidence and never retry',async(t)=>{
  let releases=0,getters=0;const bad=Object.defineProperty({},'message',{get(){getters++;return 'unsafe';}});
  const {host}=fixture(fullOutputs(),{produce(){},capture(){},release(){releases++;throw releases===1?bad:{message:'x'.repeat(2048)};}});
  for(let i=0;i<512;i++){const r=await one(host,16);R.finishResourceFrame(host,r.frame).release();}
  const disposal=R.disposeResourceHost(host);assert.equal(R.disposeResourceHost(host),disposal);
  await assert.rejects(disposal,(e:R.ResourceError)=>{assert.equal(e.code,'RESOURCE_CLEANUP');assert.equal(e.unreclaimed,8192);assert.equal(e.cleanupFailures?.length,8192);assert(Object.isFrozen(e.cleanupFailures));for(const d of e.cleanupFailures!){assert.equal(d.code,'RESOURCE_CLEANUP');assert(d.message.length<=1024);assert(Object.isFrozen(d));assert.deepEqual(Object.keys(d),['code','version','nodePath','portId','message']);}return true;});
  assert.equal(getters,0);assert.equal(releases,8192);assert.equal(R.disposeResourceHost(host),disposal);assert.equal(releases,8192);
  assert.deepEqual(R.readResourceStatus(host),{state:'terminal',clockEpoch:3,counts:{allocations:8192,backend:0,inputs:0,frames:0,captures:0},openCallbacks:0,cleanupPending:0,releaseFailed:8192});
  t.diagnostic(JSON.stringify({criterion:'H13',releases,getters,status:R.readResourceStatus(host)}));
});

test('H14 detached immutable backend identity and type-only authority',async()=>{
  const images:R.BackendImage[]=[];const known=new WeakSet<object>();let releases=0;
  const backend:R.CpuResourceBackend={produce(i,inputs){assert(Object.isFrozen(i));assert(Object.isFrozen(i.descriptor));assert(Object.isFrozen(i.nodePath));assert(Object.isFrozen(inputs));known.add(i);images.push(i);},capture(i){assert(known.has(i));},release(i){assert(known.has(i));releases++;}};
  const h1=fixture(f.basic(),backend).host,h2=fixture(f.basic(),backend).host;
  const a=await one(h1),b=await one(h2);assert.notEqual(images[0],images[1]);assert.deepEqual(images[0],images[1]);
  for(const bad of [a.cache,structuredClone(b.cache),new Proxy(b.cache,{})])assert.throws(()=>R.releaseResourceCache(h2,bad),code('RESOURCE_INVALID'));
  const reader=R.finishResourceFrame(h1,a.frame),capture=reader.capture();capture.release();reader.release();R.finishResourceFrame(h2,b.frame).release();
  const status=R.readResourceStatus(h1);assert(Object.isFrozen(status));assert(Object.isFrozen(status.counts));
  await Promise.all([R.disposeResourceHost(h1),R.disposeResourceHost(h2)]);assert.equal(releases,2);assert.equal(status.counts.allocations,1);
});

test('H1 H14 all capability kinds reject clones and foreign ownership without reflection',async()=>{
  const h=fixture().host,foreign=fixture().host;const frame=R.beginResourceFrame(h,3),e=R.openResourceNode(h,frame,[nodeIdSchema.parse(f.uuid(1))]);
  for(const token of [h,frame,e.scope]){assert.equal(Object.getPrototypeOf(token),null);assert.deepEqual(Reflect.ownKeys(token),[]);assert(Object.isFrozen(token));}
  for(const token of [structuredClone(frame),new Proxy(frame,{}),{}])assert.throws(()=>R.openResourceNode(h,token as R.ResourceFrame,[nodeIdSchema.parse(f.uuid(1))]),code('RESOURCE_INVALID'));
  await assert.rejects(R.completeResourceNode(foreign,e.scope,{}),code('RESOURCE_INVALID'));assert.equal(R.readResourceStatus(h).openCallbacks,1);
  const token=await e.resources.image('image',descriptor,[]);const cache=await R.completeResourceNode(h,e.scope,{image:token});
  for(const bad of [structuredClone(cache),new Proxy(cache,{}),{}])assert.throws(()=>R.releaseResourceCache(h,bad as R.CachedOutputs),code('RESOURCE_INVALID'));
  assert.throws(()=>R.releaseResourceCache(foreign,cache),code('RESOURCE_INVALID'));assert.throws(()=>R.finishResourceFrame(foreign,frame),code('RESOURCE_INVALID'));
  R.releaseResourceCache(h,cache);R.releaseResourceCache(h,cache);R.finishResourceFrame(h,frame).release();assert.throws(()=>R.finishResourceFrame(h,frame),code('RESOURCE_STALE'));
  await Promise.all([R.disposeResourceHost(h),R.disposeResourceHost(foreign)]);
});

test('H14 profile descriptor and methods are captured once with original backend receiver',async()=>{
  const mutable={...profile},image={...descriptor};let produced:R.BackendImage|undefined,releases=0;
  const backend={produce(this:unknown,i:R.BackendImage){assert.equal(this,backend);produced=i;},capture(this:unknown,i:R.BackendImage){assert.equal(this,backend);assert.equal(i,produced);},release(this:unknown,i:R.BackendImage){assert.equal(this,backend);assert.equal(i,produced);releases++;}};
  const host=R.createResourceHost(mutable,backend);R.attachResourceHost(host,plan());mutable.width=1;mutable.generation=0;
  backend.produce=()=>{throw Error('replaced method must not run');};backend.release=()=>{throw Error('replaced release must not run');};
  const frame=R.beginResourceFrame(host,3),e=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);const pending=e.resources.image('image',image,[]);image.width=1;
  const token=await pending;assert.equal(produced!.descriptor.width,1920);assert.equal(produced!.generation,7);
  const result={image:token};const completion=R.completeResourceNode(host,e.scope,result);result.image={} as R.OutputToken;const cache=await completion;
  R.releaseResourceCache(host,cache);const reader=R.finishResourceFrame(host,frame),hold=reader.capture();hold.release();reader.release();await R.disposeResourceHost(host);assert.equal(releases,1);
});

test('H1 bounded shapes reject getters extra fields exotic and sparse input arrays',async()=>{
  let getters=0,calls=0;const h=fixture(f.basic(),{produce(){calls++;},capture(){},release(){}}).host;
  assert.throws(()=>R.beginResourceFrame(h,4),code('RESOURCE_INVALID'));const frame=R.beginResourceFrame(h,3);
  const overlong=Array(9).fill(f.uuid(1));Object.defineProperty(overlong,'0',{get(){getters++;return f.uuid(1);}});
  for(const bad of [overlong,[],[f.uuid(99)],Object.assign([f.uuid(1)],{extra:1}),Object.defineProperty([f.uuid(1)],'0',{get(){getters++;return f.uuid(1);}})])assert.throws(()=>R.openResourceNode(h,frame,bad as any),code('RESOURCE_INVALID'));
  const e=R.openResourceNode(h,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const badDescriptors=[{...descriptor,extra:1},{...descriptor,[Symbol()]:1},Object.create(descriptor),Object.defineProperty({...descriptor},'kind',{get(){getters++;return 'image';}})];
  for(const bad of badDescriptors)await assert.rejects(e.resources.image('image',bad,[]),code('RESOURCE_INVALID'));
  const oversized=Array(17).fill({});Object.defineProperty(oversized,'0',{get(){getters++;return {};}});
  for(const bad of [oversized,Array(1),Object.assign([],{extra:1}),Object.assign([],{[Symbol()]:1}),Object.defineProperty([{}],'0',{get(){getters++;return {};}})])await assert.rejects(e.resources.image('image',descriptor,bad as any),code('RESOURCE_INVALID'));
  assert.equal(getters,0);assert.equal(calls,0);assert.deepEqual(R.readResourceStatus(h).counts,zero);R.failResourceNode(h,e.scope);await R.disposeResourceHost(h);
});

// Compiled by the actual configurations and the separate strict fixture command.
function negativeTypes(view:R.InputView,host:R.ResourceHost,resources:R.CallbackResources,image:R.BackendImage) {
  // @ts-expect-error Input authority cannot become output authority.
  const output:R.OutputToken=view;
  // @ts-expect-error Host authority is not the callback surface.
  const callback:R.CallbackResources=host;
  // @ts-expect-error Callbacks cannot release or retain resources.
  resources.release();
  // @ts-expect-error Backends do not receive resource tokens.
  image.token;
  // @ts-expect-error Backend images and paths are immutable.
  image.nodePath.push(f.uuid(1));
  return {output,callback};
}
