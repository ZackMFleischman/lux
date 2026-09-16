import assert from 'node:assert/strict';
import test from 'node:test';
import {createImageCompositionVisual} from '../../packages/runtime/src/components/image-chain.ts';
import {validateNestedGraph} from '../../packages/runtime/src/graph/nested-validate.ts';
import {prepareGraphRuntimePlan} from '../../packages/runtime/src/graph/runtime-plan.ts';
import type {BackendImage,CpuResourceBackend} from '../../packages/runtime/src/graph/resources.ts';
import {normalizeComponentDeclaration} from '../../packages/runtime-contracts/src/components.mjs';
import * as f from './nested-graph-fixtures.ts';

const paths2d={kind:'paths2d' as const,version:1 as const,coordinateSpace:'canvas-height' as const};
const image={kind:'image' as const,colorSpace:'linear-srgb' as const,alphaMode:'premultiplied' as const};
const port=(type:typeof paths2d|typeof image,label:string)=>({type,label,description:label});
const metadata=(key:string,inputs:Record<string,typeof paths2d|typeof image>,outputs:Record<string,typeof paths2d|typeof image>)=>normalizeComponentDeclaration({
  declarationVersion:1,key,label:key,description:key,tags:[],
  inputs:Object.fromEntries(Object.entries(inputs).map(([id,type])=>[id,port(type,id)])),
  outputs:Object.fromEntries(Object.entries(outputs).map(([id,type])=>[id,port(type,id)])),
  controls:{},controlDescriptions:{},lifecycle:{state:'stateful',reset:'seed'},
});
const generatorMeta=metadata('test/path-generator',{}, {paths:paths2d});
const dualMeta=metadata('test/dual-renderer',{paths:paths2d},{paint:image,mask:image});
const overlayMeta=metadata('test/path-overlay',{paths:paths2d},{overlay:image});
const combineMeta=metadata('test/combine',{paint:image,mask:image,overlay:image},{final:image});
const rootMeta=metadata('test/typed-root',{}, {image:image});
const concurrentMeta=metadata('test/concurrent-render',{}, {paint:image,mask:image});
const sourceMeta=metadata('test/image-source',{}, {image:image});
const consumerMeta=metadata('test/image-consumer',{image:image}, {image:image});
const h1=f.hash(1),h2=f.hash(2),h3=f.hash(3),h4=f.hash(4),h5=f.hash(5);
const raw={graph:{version:2 as const,rootDefinitionHash:h1,outputPort:'image'},definitions:{
  [h1]:f.graphDef([f.node(1,2),f.node(2,3),f.node(3,4),f.node(4,5)],[
    f.edge(1,f.uuid(1),'paths',f.uuid(2),'paths'),f.edge(2,f.uuid(1),'paths',f.uuid(3),'paths'),
    f.edge(3,f.uuid(2),'paint',f.uuid(4),'paint'),f.edge(4,f.uuid(2),'mask',f.uuid(4),'mask'),
    f.edge(5,f.uuid(3),'overlay',f.uuid(4),'overlay'),
  ],{},{image:f.ref(4,'final')},{},rootMeta),
  [h2]:{kind:'code' as const,metadata:generatorMeta},[h3]:{kind:'code' as const,metadata:dualMeta},
  [h4]:{kind:'code' as const,metadata:overlayMeta},[h5]:{kind:'code' as const,metadata:combineMeta},
}};

const pathSnapshot=()=>({version:1 as const,paths:[{id:0,generation:0,styleSeed:7,birthTime:0,lifetime:10,phase:0,opacity:1,points:[
  {x:0,y:0,width:.01,distance:0,depositionTime:0},{x:.1,y:.2,width:.02,distance:.25,depositionTime:.1},
]}]});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return {promise,resolve};}
const context={settings:{width:640,height:360,fps:60,seed:3},assets:new Map(),images:new Map(),random:()=>.5,reportError(){}};

test('typed image graph evaluates each node once, shares paths, and publishes named image outputs',async()=>{
  const plan=prepareGraphRuntimePlan(validateNestedGraph(raw.graph,raw.definitions));
  const produced:string[]=[],released:string[]=[],presented:string[]=[],staged:string[]=[],known=new WeakSet<object>();
  const resources:CpuResourceBackend={produce(output){produced.push(output.portId);known.add(output);},capture(){},release(output){released.push(output.portId);}};
  const counts=new Map<string,number>(),resets:string[]=[],disposals:string[]=[],seenPaths:unknown[]=[];
  const instance=(name:string,evaluate:(inputs:any,evaluation:any)=>Promise<Record<string,unknown>>)=>({
    update(){counts.set(name,(counts.get(name)??0)+1);},evaluate,reset(){resets.push(name);},dispose(){disposals.push(name);},
  });
  const definitions:any={
    [h2]:{kind:'component',sdkVersion:'0.4.0',metadata:generatorMeta,async create(){return instance('generator',async(_inputs,evaluation)=>({paths:evaluation.paths('paths',pathSnapshot())}));}},
    [h3]:{kind:'component',sdkVersion:'0.4.0',metadata:dualMeta,async create(){return instance('dual',async(inputs,evaluation)=>{seenPaths.push(inputs.paths.data);assert(Object.isFrozen(inputs.paths.data.paths[0].points));return {paint:await evaluation.render({name:'paint'},{},'paint'),mask:await evaluation.render({name:'mask'},{},'mask')};});}},
    [h4]:{kind:'component',sdkVersion:'0.4.0',metadata:overlayMeta,async create(){return instance('overlay',async(inputs,evaluation)=>{seenPaths.push(inputs.paths.data);return {overlay:await evaluation.render({name:'overlay'},{},'overlay')};});}},
    [h5]:{kind:'component',sdkVersion:'0.4.0',metadata:combineMeta,async create(){return instance('combine',async(inputs,evaluation)=>{for(const value of Object.values(inputs) as any[])assert.ok(value.texture);return {final:await evaluation.render({name:'final'},{},'final')};});}},
  };
  const visual=await createImageCompositionVisual({plan,definitions,context,backend:{resources,
    stage(scene:any){staged.push(scene.name);},texture(value:BackendImage){assert(known.has(value));return Object.freeze({value});},present(value:BackendImage){presented.push(value.portId);},async drain(){},
  }});
  for(let tick=0;tick<2;tick++){visual.update({tick,timeSeconds:tick/60,deltaSeconds:1/60,controls:{},events:[]});await visual.render();}
  assert.deepEqual(Object.fromEntries(counts),{generator:2,dual:2,overlay:2,combine:2});
  assert.equal(seenPaths[0],seenPaths[1]);assert.equal(seenPaths[2],seenPaths[3]);assert.notEqual(seenPaths[0],seenPaths[2]);
  assert.deepEqual(produced,['paint','mask','overlay','final','paint','mask','overlay','final']);
  assert.deepEqual(staged,produced);assert.deepEqual(presented,['final','final']);
  await visual.reset(9);assert.deepEqual(resets.sort(),['combine','dual','generator','overlay']);
  await visual.dispose();assert.deepEqual(disposals.sort(),['combine','dual','generator','overlay']);
  assert.deepEqual(released.sort(),['final','final','mask','mask','overlay','overlay','paint','paint']);
});

test('overlapping renders reject before a second stage and pending work drains before authored disposal',async()=>{
  const root=f.hash(11),leaf=f.hash(12),raw={graph:{version:2 as const,rootDefinitionHash:root,outputPort:'image'},definitions:{
    [root]:f.graphDef([f.node(1,12)],[],{},{image:f.ref(1,'paint')},{},rootMeta),
    [leaf]:{kind:'code' as const,metadata:concurrentMeta},
  }};
  const plan=prepareGraphRuntimePlan(validateNestedGraph(raw.graph,raw.definitions)),work=deferred(),entered=deferred();
  const stages:string[]=[],produced:string[]=[],events:string[]=[];
  const resources:CpuResourceBackend={produce(output){produced.push(output.portId);if(produced.length===1){entered.resolve();return work.promise;}},capture(){},release(output){events.push(`release:${output.portId}`);}};
  const definitions:any={[leaf]:{kind:'component',sdkVersion:'0.4.0',metadata:concurrentMeta,async create(){return {
    update(){},async evaluate(_inputs:any,evaluation:any){const paint=evaluation.render({name:'first'},{},'paint'),mask=evaluation.render({name:'second'},{},'mask');const values=await Promise.all([paint,mask]);return {paint:values[0],mask:values[1]};},
    reset(){},dispose(){events.push('dispose');},
  };}}};
  const visual=await createImageCompositionVisual({plan,definitions,context,backend:{resources,stage(scene:any){stages.push(scene.name);},texture(){return {};},present(){},async drain(){events.push('drain');}}});
  visual.update({tick:0,timeSeconds:0,deltaSeconds:0,controls:{},events:[]});const rendering=visual.render();await entered.promise;await Promise.resolve();
  let disposal:Promise<void>|undefined;
  try{
    assert.deepEqual(stages,['first']);assert.deepEqual(produced,['paint']);await assert.rejects(rendering,/overlap|concurrent/i);
    let disposed=false;disposal=visual.dispose().then(()=>{disposed=true;});await Promise.resolve();assert.equal(disposed,false);assert.deepEqual(events,[]);
    work.resolve();await disposal;assert.deepEqual(events,['release:paint','dispose','drain']);
  }finally{work.resolve();await rendering.catch(()=>{});await (disposal??visual.dispose()).catch(()=>{});}
});

test('input wrapping failure closes the opened scope so disposal can drain',async()=>{
  const root=f.hash(21),source=f.hash(22),consumer=f.hash(23),raw={graph:{version:2 as const,rootDefinitionHash:root,outputPort:'image'},definitions:{
    [root]:f.graphDef([f.node(1,22),f.node(2,23)],[f.edge(1,f.uuid(1),'image',f.uuid(2),'image')],{},{image:f.ref(2)},{},rootMeta),
    [source]:{kind:'code' as const,metadata:sourceMeta},[consumer]:{kind:'code' as const,metadata:consumerMeta},
  }};
  const plan=prepareGraphRuntimePlan(validateNestedGraph(raw.graph,raw.definitions));let textures=0;const events:string[]=[];
  const resources:CpuResourceBackend={produce(){},capture(){},release(){events.push('release');}};
  const component=(metadata:unknown)=>({kind:'component' as const,sdkVersion:'0.4.0' as const,metadata,async create(){return {update(){},async evaluate(_inputs:any,evaluation:any){return {image:await evaluation.render({}, {})};},reset(){},dispose(){events.push('dispose');}};}});
  const visual=await createImageCompositionVisual({plan,definitions:{[source]:component(sourceMeta),[consumer]:component(consumerMeta)} as any,context,backend:{resources,stage(){},texture(){if(++textures===2)throw Error('texture failed');return {};},present(){},async drain(){events.push('drain');}}});
  visual.update({tick:0,timeSeconds:0,deltaSeconds:0,controls:{},events:[]});await assert.rejects(visual.render(),/texture failed/);
  const outcome=await Promise.race([visual.dispose().then(()=> 'disposed' as const),new Promise<'pending'>(resolve=>setImmediate(()=>resolve('pending')))]);
  assert.equal(outcome,'disposed');assert.deepEqual(events,['release','dispose','dispose','drain']);
});
