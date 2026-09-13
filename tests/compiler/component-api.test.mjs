import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {defineComponent} from '../../packages/visual-sdk/src/sdk-components.ts';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {componentSource,declaration} from './component-fixture.mjs';
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
