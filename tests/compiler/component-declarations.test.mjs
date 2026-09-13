import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {componentSource,declaration} from './component-fixture.mjs';
test('extracts aliased inline component metadata and rejects executable or unsupported declarations with locations',async()=>{
 const {extractComponentDeclaration}=await import('../../apps/build-worker/src/component-declarations.mjs');
 const extract=text=>extractComponentDeclaration(parse(text,{sourceType:'module',plugins:['typescript']}));
 assert.equal(extract(componentSource()).key,declaration.key);
 for(const metadata of ['metadata','makeMetadata()','{...metadata}',JSON.stringify({...declaration,outputs:{}}),JSON.stringify({...declaration,inputs:declaration.outputs}),JSON.stringify(declaration).replace('"label":"Image"','"label":"Image","label":"Other"'),JSON.stringify(declaration).replace('"label":"Image"','get label(){return "Image"}')]) {
  assert.throws(()=>extract(componentSource(metadata)),error=>error.code==='COMPILE_FAILED'&&error.loc.line>0);
 }
});
