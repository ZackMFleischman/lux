import assert from 'node:assert/strict';
import test from 'node:test';
import {nodeIdSchema} from '../../packages/runtime-contracts/src/identities.ts';
import * as R from '../../packages/runtime/src/graph/resources.ts';
import {prepareGraphRuntimePlan} from '../../packages/runtime/src/graph/runtime-plan.ts';
import {validateNestedGraph} from '../../packages/runtime/src/graph/nested-validate.ts';
import * as f from './nested-graph-fixtures.ts';

const paths2d={kind:'paths2d' as const,version:1 as const,coordinateSpace:'canvas-height' as const};
const profile:R.HostProfile={generation:7,sceneSeed:0,initialClockEpoch:3,width:1920,height:1080,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'};
const imageDescriptor:R.ImageDescriptor={kind:'image',width:1920,height:1080,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'};
const code=(name:string)=>(error:unknown)=>error instanceof Error&&(error as R.ResourceError).code===name;
const snapshot=()=>({version:1 as const,paths:[{id:1,generation:2,styleSeed:3,birthTime:4,lifetime:5,phase:.25,opacity:.75,points:[
  {x:-.25,y:.5,width:.01,distance:0,depositionTime:4},
  {x:.25,y:.4,width:.02,distance:.51,depositionTime:4.1},
]}]});

function graph(){
  return f.clone({graph:{version:2,rootDefinitionHash:f.hash(1),outputPort:'image'},definitions:{
    [f.hash(1)]:f.graphDef([f.node(1,2),f.node(2,3),f.node(3,3),f.node(4,4)],[
      f.edge(1,f.uuid(1),'paths',f.uuid(2),'paths'),f.edge(2,f.uuid(1),'paths',f.uuid(3),'paths'),
      f.edge(3,f.uuid(2),'image',f.uuid(4),'left'),f.edge(4,f.uuid(3),'image',f.uuid(4),'right'),
    ],{},{image:f.ref(4)}),
    [f.hash(2)]:{kind:'code',metadata:f.meta({},{paths:paths2d})},
    [f.hash(3)]:{kind:'code',metadata:f.meta({paths:paths2d})},
    [f.hash(4)]:{kind:'code',metadata:f.meta({left:f.image,right:f.image})},
  }});
}

function fixture(){
  const released:R.BackendImage[]=[];
  const backend:R.CpuResourceBackend={produce(){},capture(){},release(image){released.push(image);}};
  const raw=graph(),host=R.createResourceHost(profile,backend);
  R.attachResourceHost(host,prepareGraphRuntimePlan(validateNestedGraph(raw.graph,raw.definitions)));
  return {host,released};
}

test('paths2d fan-out shares one immutable admitted snapshot and drains without backend cleanup',async()=>{
  const {host,released}=fixture(),frame=R.beginResourceFrame(host,3),caches:R.CachedOutputs[]=[];
  const producer=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]),authored=snapshot();
  const pathToken=producer.resources.paths('paths',authored);
  const admitted=R.readResourceOutputPaths(host,producer.scope,pathToken);
  authored.paths[0]!.points[0]!.x=99;
  assert.equal(admitted.paths[0]!.points[0]!.x,-.25);
  assert(Object.isFrozen(admitted));assert(Object.isFrozen(admitted.paths));assert(Object.isFrozen(admitted.paths[0]));assert(Object.isFrozen(admitted.paths[0]!.points[0]));
  caches.push(await R.completeResourceNode(host,producer.scope,{paths:pathToken}));

  const first=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(2))]);
  const firstData=first.resources.readPaths(first.inputs.paths!);assert.equal(firstData,admitted);
  const firstImage=await first.resources.image('image',imageDescriptor,[]);
  caches.push(await R.completeResourceNode(host,first.scope,{image:firstImage}));

  const second=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(3))]);
  const secondData=second.resources.readPaths(second.inputs.paths!);assert.equal(secondData,firstData);
  assert.throws(()=>{(secondData.paths[0]!.points as any).push({});},TypeError);
  const secondImage=await second.resources.image('image',imageDescriptor,[]);
  caches.push(await R.completeResourceNode(host,second.scope,{image:secondImage}));

  const final=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(4))]);
  const output=await final.resources.image('image',imageDescriptor,[final.inputs.left!,final.inputs.right!]);
  caches.push(await R.completeResourceNode(host,final.scope,{image:output}));
  const reader=R.finishResourceFrame(host,frame);for(const cache of caches)R.releaseResourceCache(host,cache);reader.release();
  await R.disposeResourceHost(host);
  assert.deepEqual(released.map(image=>image.portId).sort(),['image','image','image']);
  assert.deepEqual(R.readResourceStatus(host).counts,{allocations:0,backend:0,inputs:0,frames:0,captures:0});
});

test('paths2d issuance enforces declared ports, snapshot bounds, and exact host authority',async()=>{
  const {host}=fixture(),frame=R.beginResourceFrame(host,3),producer=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const tooMany={version:1,paths:Array.from({length:33},(_,id)=>({...snapshot().paths[0]!,id}))};
  assert.throws(()=>producer.resources.paths('paths',tooMany),code('RESOURCE_INVALID'));
  assert.throws(()=>producer.resources.paths('missing',snapshot()),code('RESOURCE_INVALID'));
  const token=producer.resources.paths('paths',snapshot());
  assert.throws(()=>producer.resources.paths('paths',snapshot()),code('RESOURCE_INVALID'));
  const foreign=fixture();
  assert.throws(()=>R.readResourceOutputPaths(foreign.host,producer.scope,token),code('RESOURCE_INVALID'));
  R.failResourceNode(host,producer.scope);await R.disposeResourceHost(host);await R.disposeResourceHost(foreign.host);
  assert.deepEqual(R.readResourceStatus(host).counts,{allocations:0,backend:0,inputs:0,frames:0,captures:0});
});
