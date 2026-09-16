import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';
const options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
const field=`{type:{kind:'shader-field',version:1,abi:'lux/organic-regions/v1'},label:'Field',description:'Region shader field'}`;
const image=`{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Painted image'}`;
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
function bundle(){return {sdkVersion:'0.4.0',entry:'composition.ts',files:{
  'field.ts':`import {defineComponent} from '@lux/visual-sdk';export default defineComponent({metadata:{declarationVersion:1,key:'test/field',label:'Field',description:'Field',tags:[],inputs:{},outputs:{regions:${field}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}},async create(){return {update(){},async evaluate(_inputs,context){return {regions:context.shaderField('regions',{version:1,abi:'lux/organic-regions/v1',fragments:{region:'fn region() -> f32 { return 0.0; }'},values:{scale:2}})}},reset(){},dispose(){}}}});`,
  'paint.ts':`import {defineComponent} from '@lux/visual-sdk';export default defineComponent({metadata:{declarationVersion:1,key:'test/paint',label:'Paint',description:'Paint',tags:[],inputs:{regions:${field}},outputs:{image:${image}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}},async create(){return {update(){},async evaluate(inputs,context){const source:string=inputs.regions.data.fragments.region;const scale:number=inputs.regions.data.values.scale;void source;void scale;return {image:await context.render({}, {})}},reset(){},dispose(){}}}});`,
  'composition.ts':`import {defineComposition} from '@lux/visual-sdk';import field from './field.ts';import paint from './paint.ts';export default defineComposition({definitions:{field,paint},nodes:[{id:'${a}',definition:'field'},{id:'${b}',definition:'paint'}],edges:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',from:{nodeId:'${a}',portId:'regions'},to:{nodeId:'${b}',portId:'regions'},delay:'none'}],output:{nodeId:'${b}',portId:'image'},expose:[]});`,
}};}
test('shader-field graph compiles and links with its contract dependency identity',async()=>{
  const result=await compileVisual({source:bundle()},options);assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.artifact.executionModel,'typed-image-graph-v1');assert.ok(result.artifact.dependencyHashes['contracts/shader-field.mjs']);
  assert.equal((await linkRuntime(result.artifact,options)).executionModel,'typed-image-graph-v1');
});
test('shader-field compilation rejects ABI mismatch and incorrect resource API typing',async()=>{
  for(const mutate of [
    s=>{s.files['paint.ts']=s.files['paint.ts'].replace('lux/organic-regions/v1','lux/other/v1');},
    s=>{s.files['field.ts']=s.files['field.ts'].replace("shaderField('regions'","shaderField('missing'");},
    s=>{s.files['field.ts']=s.files['field.ts'].replace('values:{scale:2}',"values:{scale:'bad'}");},
    s=>{s.files['paint.ts']=s.files['paint.ts'].replace('inputs.regions.data.fragments.region','inputs.regions.texture');},
  ]){const source=bundle();mutate(source);const result=await compileVisual({source},options);assert.equal(result.ok,false);}
});
