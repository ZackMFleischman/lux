import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {createHash} from 'node:crypto';
import {extractCompositionDeclaration} from '../../apps/build-worker/src/composition-declarations.mjs';
import {compositionSourceBundle,ballId,kaleidoscopeAId,kaleidoscopeBId} from './composition-fixture.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
test('static composition extraction derives canonical controls and distinct same-named leaf bindings without executing source',()=>{
 const source=compositionSourceBundle(),asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
 const profile=extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash});
 assert.deepEqual(profile.publicControls.map(row=>[row.id,row.label,row.default]),[['ballIntensity','Intensity',.6],['segmentsA','Segments',6],['segmentsB','Segments',6]]);
 assert.deepEqual(profile.publicControlBindings,{ballIntensity:[{nodePath:[ballId],controlId:'intensity',active:true}],segmentsA:[{nodePath:[kaleidoscopeAId],controlId:'segments',active:true}],segmentsB:[{nodePath:[kaleidoscopeBId],controlId:'segments',active:true}]});
 assert.deepEqual(profile.nodes.map(row=>row.nodePath),[[ballId],[kaleidoscopeAId],[kaleidoscopeBId]]);
});
test('composition extraction rejects duplicate exposure and a non-linear graph',()=>{
 const source=compositionSourceBundle();
 for(const text of [source.files['composition.ts'].replace("{id:'segmentsB'","{id:'segmentsA'"),source.files['composition.ts'].replace(`nodeId:'${kaleidoscopeBId}',portId:'image'},delay:'none'`,`nodeId:'${kaleidoscopeAId}',portId:'image'},delay:'none'`)]){
  const files={...source.files,'composition.ts':text},asts=Object.fromEntries(Object.entries(files).map(([path,value])=>[path,parse(value,{sourceType:'module',plugins:['typescript']})]));
  assert.throws(()=>extractCompositionDeclaration({entry:source.entry,files,asts,hash}),/duplicate|linear|writer|duplicate/i);
 }
});
