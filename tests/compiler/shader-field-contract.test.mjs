import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeShaderFieldSnapshot,shaderFieldLimits} from '../../packages/runtime-contracts/src/shader-field.mjs';
import {normalizeComponentDeclaration} from '../../packages/runtime-contracts/src/components.mjs';
import {discoverVisualSdk} from '../../packages/visual-sdk/src/discovery.mjs';

const snapshot=()=>({version:1,abi:'lux/organic-regions/v1',fragments:{'helpers.region':'fn region() -> f32 { return 0.0; }'},values:{scale:2}});
test('shader fields detach and freeze data, preserve WGSL, and advertise discovery types',async()=>{
  const source=snapshot(),value=normalizeShaderFieldSnapshot(source);
  assert.deepEqual(value,source);assert.notEqual(value.fragments,source.fragments);assert.notEqual(value.values,source.values);
  for(const object of [value,value.fragments,value.values])assert(Object.isFrozen(object));
  source.values.scale=5;source.fragments['helpers.region']='bad';assert.equal(value.values.scale,2);assert.match(value.fragments['helpers.region'],/^fn /);
  assert.match((await discoverVisualSdk()).composition.shaderFieldContractSource,/ShaderFieldSnapshot/);
});
test('shader fields reject accessors, nested resources, malformed records and bounded payload violations',()=>{
  for(const mutate of [
    s=>{s.version=2;},s=>{s.abi='invalid';},s=>{s.abi='a/'+ 'a'.repeat(95);},s=>{s.extra=true;},
    s=>{s.values.scale=Infinity;},s=>{s.values.scale=NaN;},s=>{s.values.scale={data:{}};},
    s=>{s.fragments.x={data:{}};},s=>{s.fragments.x='\ud800';},s=>{s.fragments['a'.repeat(65)]='x';},
    s=>{s.fragments['bad..key']='x';},s=>{s.fragments['bad.constructor']='x';},s=>{s.fragments[Symbol()]='x';},
    s=>{Object.defineProperty(s.fragments,'hidden',{value:'x'});},
    s=>{Object.defineProperty(s.values,'scale',{enumerable:true,get(){throw Error('accessed getter');}});},
    s=>{Object.defineProperty(s,'abi',{enumerable:true,get(){throw Error('accessed getter');}});},
    s=>{s.fragments=Object.assign(Object.create({inherited:'x'}),s.fragments);},
    s=>{s.fragments=Object.fromEntries(Array.from({length:33},(_,i)=>['f'+i,'x']));},
    s=>{s.values=Object.fromEntries(Array.from({length:129},(_,i)=>['v'+i,i]));},
    s=>{s.fragments.x='é'.repeat(shaderFieldLimits.totalUTF8Bytes/2);},
  ]){const value=snapshot();mutate(value);assert.throws(()=>normalizeShaderFieldSnapshot(value),{code:'INVALID_SHADER_FIELD_SNAPSHOT'});}
  const boundary={version:1,abi:'a/b',fragments:{x:'a'.repeat(shaderFieldLimits.totalUTF8Bytes-4)},values:{}};
  assert.equal(normalizeShaderFieldSnapshot(boundary).fragments.x.length,shaderFieldLimits.totalUTF8Bytes-4);
  boundary.fragments.x+='a';assert.throws(()=>normalizeShaderFieldSnapshot(boundary),/byte limit/);
});
test('shader-field metadata admits only versioned bounded ABI descriptors',()=>{
  const declaration={declarationVersion:1,key:'test/field',label:'Field',description:'Field',tags:[],inputs:{},outputs:{field:{type:{kind:'shader-field',version:1,abi:'lux/organic-regions/v1'},label:'Field',description:'Field'}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}};
  assert.deepEqual(normalizeComponentDeclaration(declaration).outputs.field.type,declaration.outputs.field.type);
  for(const type of [{kind:'shader-field',version:2,abi:'a/b'},{kind:'shader-field',version:1,abi:''},{kind:'shader-field',version:1,abi:'a/b',extra:true}])assert.throws(()=>normalizeComponentDeclaration({...declaration,outputs:{field:{...declaration.outputs.field,type}}}));
});
