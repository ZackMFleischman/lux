import assert from 'node:assert/strict';
import test from 'node:test';
import {createImageCompositionVisual} from '../../packages/runtime/src/components/image-chain.ts';
import {validateGraph} from '../../packages/runtime/src/graph/validate.ts';
import {validateNestedGraph} from '../../packages/runtime/src/graph/nested-validate.ts';
import {prepareGraphRuntimePlan} from '../../packages/runtime/src/graph/runtime-plan.ts';
import * as f from './nested-graph-fixtures.ts';
import * as flat from './graph-fixtures.ts';

const field={kind:'shader-field' as const,version:1 as const,abi:'lux/organic-regions/v1'};
const snapshot=(scale=2)=>({version:1 as const,abi:field.abi,fragments:{region:'fn region() -> f32 { return 0.0; }'},values:{scale}});
function graph(){return f.clone({graph:{version:2,rootDefinitionHash:f.hash(1),outputPort:'image'},definitions:{
  [f.hash(1)]:f.graphDef([f.node(1,2),f.node(2,3)],[f.edge(1,f.uuid(1),'regions',f.uuid(2),'regions')],{},{image:f.ref(2)}),
  [f.hash(2)]:{kind:'code',metadata:f.meta({},{regions:field})},
  [f.hash(3)]:{kind:'code',metadata:f.meta({regions:field})},
}});}
test('flat and nested graph validation require exact shader-field ABIs',()=>{
  const raw=graph();validateNestedGraph(raw.graph,raw.definitions);
  (raw.definitions[f.hash(3)]!.metadata as any).inputs.regions.type={...field,abi:'lux/other/v1'};
  assert.throws(()=>validateNestedGraph(raw.graph,raw.definitions),/type|match/i);
  const source=flat.metadata({},{regions:field}),target=flat.metadata({regions:field});
  const flatGraph={version:1,nodes:[flat.node(flat.A,flat.h),flat.node(flat.B,flat.h2)],edges:[flat.edge(1,flat.A,'regions',flat.B,'regions')],finalOutput:{nodeId:flat.B,portId:'image'}};
  validateGraph(flatGraph,{[flat.h]:{kind:'code',metadata:source},[flat.h2]:{kind:'code',metadata:target}});
  assert.throws(()=>validateGraph(flatGraph,{[flat.h]:{kind:'code',metadata:source},[flat.h2]:{kind:'code',metadata:flat.metadata({regions:{...field,abi:'lux/other/v1'}})}}),/type|match/i);
});
async function visual(mode:'valid'|'forged'|'stale'){
  const raw=graph(),seen:number[]=[],presented:unknown[]=[];let tick=0,saved:unknown;
  const lifecycle={reset(){},dispose(){}};
  const definitions:any={
    [f.hash(2)]:{kind:'component',sdkVersion:'0.4.0',metadata:raw.definitions[f.hash(2)]!.metadata,async create(){return {...lifecycle,update(frame:any){tick=frame.tick;},async evaluate(_inputs:any,context:any){
      if(mode==='forged')return {regions:Object.freeze({data:snapshot()})};
      if(mode==='stale'&&saved)return {regions:saved};
      saved=context.shaderField('regions',snapshot(tick));return {regions:saved};
    }};}},
    [f.hash(3)]:{kind:'component',sdkVersion:'0.4.0',metadata:raw.definitions[f.hash(3)]!.metadata,async create(){return {...lifecycle,update(){},async evaluate(inputs:any,context:any){
      assert(Object.isFrozen(inputs.regions));assert(Object.isFrozen(inputs.regions.data.values));seen.push(inputs.regions.data.values.scale);return {image:await context.render({}, {})};
    }};}},
  };
  const value=await createImageCompositionVisual({plan:prepareGraphRuntimePlan(validateNestedGraph(raw.graph,raw.definitions)),definitions,
    context:{settings:{width:640,height:360,fps:60,seed:0},assets:new Map(),images:new Map(),random:()=>0,reportError(){}},
    backend:{resources:{produce(){},capture(){},release(){}},stage(){},texture(){return {};},present(image){presented.push(image);},async drain(){}},
  });
  return {value,seen,presented,async render(tick:number){value.update({tick,timeSeconds:tick/60,deltaSeconds:1/60,controls:{},events:[]});await value.render();}};
}
test('authored shader-field values update every frame through opaque immutable resources',async()=>{
  const instance=await visual('valid');try{await instance.render(0);await instance.render(1);assert.deepEqual(instance.seen,[0,1]);assert.equal(instance.presented.length,2);}finally{await instance.value.dispose();}
});
test('authored shader-field resources reject forged data wrappers and previous-frame tokens',async()=>{
  for(const mode of ['forged','stale'] as const){const instance=await visual(mode);try{
    if(mode==='stale')await instance.render(0);
    await assert.rejects(instance.render(1),/Invalid|invalid/i);
    assert.equal(instance.presented.length,mode==='stale'?1:0);
  }finally{await instance.value.dispose();}}
});
