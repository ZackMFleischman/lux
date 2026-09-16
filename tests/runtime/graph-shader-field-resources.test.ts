import assert from 'node:assert/strict';
import test from 'node:test';
import {nodeIdSchema} from '../../packages/runtime-contracts/src/identities.ts';
import * as R from '../../packages/runtime/src/graph/resources.ts';
import {prepareGraphRuntimePlan} from '../../packages/runtime/src/graph/runtime-plan.ts';
import {validateNestedGraph} from '../../packages/runtime/src/graph/nested-validate.ts';
import * as f from './nested-graph-fixtures.ts';

const paths2d={kind:'shader-field' as const,version:1 as const,abi:'lux/organic-regions/v1'};
const profile:R.HostProfile={generation:7,sceneSeed:0,initialClockEpoch:3,width:1920,height:1080,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'};
const imageDescriptor:R.ImageDescriptor={kind:'image',width:1920,height:1080,format:'rgba8unorm',colorSpace:'linear-srgb',alphaMode:'premultiplied'};
const code=(name:string)=>(error:unknown)=>error instanceof Error&&(error as R.ResourceError).code===name;
const snapshot=()=>({version:1 as const,abi:'lux/organic-regions/v1',fragments:{region:'fn region() -> f32 { return 0.0; }'},values:{scale:2}});

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

test('shader-field fan-out shares one immutable admitted snapshot and drains without backend cleanup',async()=>{
  const {host,released}=fixture(),frame=R.beginResourceFrame(host,3),caches:R.CachedOutputs[]=[];
  const producer=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]),authored=snapshot();
  const pathToken=producer.resources.shaderField('paths',authored);
  const admitted=R.readResourceOutputShaderField(host,producer.scope,pathToken);
  authored.values.scale=99;
  assert.equal(admitted.values.scale,2);
  assert(Object.isFrozen(admitted));assert(Object.isFrozen(admitted.fragments));assert(Object.isFrozen(admitted.values));
  caches.push(await R.completeResourceNode(host,producer.scope,{paths:pathToken}));

  const first=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(2))]);
  assert.throws(()=>producer.resources.shaderField('paths',snapshot()),code('RESOURCE_STALE'));
  assert.throws(()=>first.resources.readShaderField({} as R.InputView),code('RESOURCE_INVALID'));
  const firstData=first.resources.readShaderField(first.inputs.paths!);assert.equal(firstData,admitted);
  const firstImage=await first.resources.image('image',imageDescriptor,[]);
  caches.push(await R.completeResourceNode(host,first.scope,{image:firstImage}));

  const second=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(3))]);
  assert.throws(()=>first.resources.readShaderField(first.inputs.paths!),code('RESOURCE_STALE'));
  const secondData=second.resources.readShaderField(second.inputs.paths!);assert.equal(secondData,firstData);
  assert.throws(()=>{(secondData.values as any).scale=3;},TypeError);
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

test('shader-field issuance enforces declared ports, snapshot bounds, and exact host authority',async()=>{
  const {host}=fixture(),frame=R.beginResourceFrame(host,3),producer=R.openResourceNode(host,frame,[nodeIdSchema.parse(f.uuid(1))]);
  const tooMany={...snapshot(),fragments:Object.fromEntries(Array.from({length:33},(_,id)=>['f'+id,'x']))};
  assert.throws(()=>producer.resources.shaderField('paths',tooMany),code('RESOURCE_INVALID'));
  assert.throws(()=>producer.resources.shaderField('missing',snapshot()),code('RESOURCE_INVALID'));
  assert.throws(()=>producer.resources.shaderField('paths',{...snapshot(),abi:'wrong/abi'}),code('RESOURCE_INVALID'));
  const token=producer.resources.shaderField('paths',snapshot());
  assert.throws(()=>producer.resources.shaderField('paths',snapshot()),code('RESOURCE_INVALID'));
  const foreign=fixture();
  assert.throws(()=>R.readResourceOutputShaderField(foreign.host,producer.scope,token),code('RESOURCE_INVALID'));
  R.failResourceNode(host,producer.scope);await R.disposeResourceHost(host);await R.disposeResourceHost(foreign.host);
  assert.deepEqual(R.readResourceStatus(host).counts,{allocations:0,backend:0,inputs:0,frames:0,captures:0});
});
