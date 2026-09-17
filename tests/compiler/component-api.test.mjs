import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {defineComponent} from '../../packages/visual-sdk/src/sdk-components.ts';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {componentSource,declaration} from './component-fixture.mjs';
import {compositionSourceBundle} from './composition-fixture.mjs';
test('component helper snapshots deeply frozen metadata without calling the factory or minting resources',()=>{
 let called=0;const metadata=structuredClone(declaration),definition=defineComponent({metadata,async create(){called++;throw Error('factory');}});
 metadata.label='Changed';assert.equal(definition.metadata.label,'Image');assert.equal(called,0);
 assert.throws(()=>{definition.metadata.outputs.image.type.alphaMode='straight';});
 assert.throws(()=>defineComponent({get metadata(){called++;return declaration;},create:definition.create}));assert.equal(called,0);
});
test('pinned compiler infers numeric controls and rejects readonly, missing, forged resource and output misuse',async()=>{
 const options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
 for(const [update,evaluate,expected] of [
  ['const speed:number=frame.controls.speed;',undefined,null],
  ['frame.controls.missing;',undefined,/missing/],
  ['frame.controls.speed=2;',undefined,/read-only/],
  ['const value:string=frame.controls.speed;',undefined,/number.*string/],
  ['',"return {image:{width:1,height:1,colorSpace:'linear-srgb',alphaMode:'premultiplied'}};",/imageResourceBrand/],
  ['',"return {wrong:await context.render({}, {})};",/image/],
 ]){
  const result=await compileVisual({source:{sdkVersion:'0.3.0',entry:'main.ts',files:{'main.ts':componentSource(undefined,update,evaluate)}}},options);
  assert.equal(result.ok,!expected,JSON.stringify(result));if(expected)assert.match(JSON.stringify(result.diagnostics),expected);
 }
});
test('SDK 0.3 and 0.4 component frames expose typed trigger events',async()=>{
 const options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
 const metadata=structuredClone(declaration);
 metadata.controls.regenerate={type:'trigger',label:'Regenerate'};
 metadata.controlDescriptions.regenerate='Build another pattern';
 const update="const event=frame.events[0]!;const kind:'trigger'=event.type;const id:'regenerate'=event.controlId;const command:string=event.commandId;const sequence:number=event.sequence;";
 const component=await compileVisual({source:{sdkVersion:'0.3.0',entry:'main.ts',files:{'main.ts':componentSource(JSON.stringify(metadata),update)}}},options);
 assert.equal(component.ok,true,JSON.stringify(component));

 const composition=compositionSourceBundle();
 composition.files['ball.ts']=composition.files['ball.ts']
  .replace("controls:{intensity:{type:'number',label:'Intensity',default:.6,min:0,max:1,step:.01}}","controls:{intensity:{type:'number',label:'Intensity',default:.6,min:0,max:1,step:.01},regenerate:{type:'trigger',label:'Regenerate'}}")
  .replace("controlDescriptions:{intensity:'Spike amount'}","controlDescriptions:{intensity:'Spike amount',regenerate:'Build another pattern'}")
  .replace('return {update(){},async evaluate',`return {update(frame){${update}},async evaluate`);
 const graph=await compileVisual({source:composition},options);
 assert.equal(graph.ok,true,JSON.stringify(graph));
});
