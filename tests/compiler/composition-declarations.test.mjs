import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {createHash} from 'node:crypto';
import {extractCompositionDeclaration} from '../../apps/build-worker/src/composition-declarations.mjs';
import {compositionSourceBundle,nestedCompositionSourceBundle,ballId,kaleidoscopeAId,kaleidoscopeBId,compositeAId,compositeBId,wrapperNodeId,wrappedEffectId,directEffectId} from './composition-fixture.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
test('static composition extraction derives canonical controls and distinct same-named leaf bindings without executing source',()=>{
 const source=compositionSourceBundle(),asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
 const profile=extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash});
 assert.deepEqual(profile.publicControls.map(row=>[row.id,row.label,row.default]),[['ballIntensity','Intensity',.6],['segmentsA','Segments',6],['segmentsB','Segments',6]]);
 assert.deepEqual(profile.publicControlBindings,{ballIntensity:[{nodePath:[ballId],controlId:'intensity',active:true}],segmentsA:[{nodePath:[kaleidoscopeAId],controlId:'segments',active:true}],segmentsB:[{nodePath:[kaleidoscopeBId],controlId:'segments',active:true}]});
 assert.deepEqual(profile.nodes.map(row=>row.nodePath),[[ballId],[kaleidoscopeAId],[kaleidoscopeBId]]);
});
test('composition extraction preserves authored exposure order without requiring sorted binding keys',()=>{
 const source=nestedCompositionSourceBundle(),ordered=` {id:'ballIntensity',nodeId:'${ballId}',controlId:'intensity'},\n {id:'segmentsA',nodeId:'${compositeAId}',controlId:'firstSegments'},\n {id:'segmentsB',nodeId:'${compositeBId}',controlId:'secondSegments'}`,reordered=` {id:'segmentsB',nodeId:'${compositeBId}',controlId:'secondSegments'},\n {id:'ballIntensity',nodeId:'${ballId}',controlId:'intensity'},\n {id:'segmentsA',nodeId:'${compositeAId}',controlId:'firstSegments'}`;
 source.files['composition.ts']=source.files['composition.ts'].replace(ordered,reordered);
 const asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})])),profile=extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash});
 assert.deepEqual(profile.publicControls.map(row=>row.id),['segmentsB','ballIntensity','segmentsA']);
});
test('composition exposure aliases inherit control groups through nested component metadata',()=>{
 const source=nestedCompositionSourceBundle();
 source.files['ball.ts']=source.files['ball.ts'].replace("label:'Intensity'","label:'Intensity',group:'Spiky Ball'");
 source.files['kaleidoscope.ts']=source.files['kaleidoscope.ts'].replace("label:'Segments'","label:'Segments',group:'Kaleidoscope'");
 const asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
 const profile=extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash});
 assert.deepEqual(profile.publicControls.map(row=>[row.id,row.group]),[['ballIntensity','Spiky Ball'],['segmentsA','Kaleidoscope'],['segmentsB','Kaleidoscope']]);
 assert.deepEqual(profile.nodes.map(row=>row.schema.map(control=>control.group)),[['Spiky Ball'],['Kaleidoscope'],['Kaleidoscope'],['Kaleidoscope'],['Kaleidoscope']]);
});
test('composition extraction rejects duplicate exposure and a non-linear graph',()=>{
 const source=compositionSourceBundle();
 for(const text of [source.files['composition.ts'].replace("{id:'segmentsB'","{id:'segmentsA'"),source.files['composition.ts'].replace(`nodeId:'${kaleidoscopeBId}',portId:'image'},delay:'none'`,`nodeId:'${kaleidoscopeAId}',portId:'image'},delay:'none'`)]){
  const files={...source.files,'composition.ts':text},asts=Object.fromEntries(Object.entries(files).map(([path,value])=>[path,parse(value,{sourceType:'module',plugins:['typescript']})]));
  assert.throws(()=>extractCompositionDeclaration({entry:source.entry,files,asts,hash}),/duplicate|linear|writer|duplicate/i);
 }
});
test('composition extraction rejects a zero-input node pruned from the selected image chain',()=>{
 const source=nestedCompositionSourceBundle(),extraId='99999999-9999-4999-8999-999999999999';
 source.files['composition.ts']=source.files['composition.ts'].replace(`{id:'${compositeBId}',definition:'composite'}],edges:[`,`{id:'${compositeBId}',definition:'composite'},{id:'${extraId}',definition:'ball'}],edges:[`);
 const asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
 assert.throws(()=>extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash}),/linear|reachable|pruned/i);
});
test('static extraction recursively admits reusable compositions and derives canonical leaf paths',()=>{
 const source=nestedCompositionSourceBundle(),asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
 const profile=extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash});
 assert.equal(profile.definitions[profile.graph.rootDefinitionHash].metadata.label,'Nested demo');
 assert.deepEqual(profile.nodes.map(row=>row.nodePath),[
  [ballId],
  [compositeAId,wrapperNodeId,wrappedEffectId],
  [compositeAId,directEffectId],
  [compositeBId,wrapperNodeId,wrappedEffectId],
  [compositeBId,directEffectId],
 ]);
 assert.deepEqual(profile.publicControlBindings.segmentsA,[{nodePath:[compositeAId,wrapperNodeId,wrappedEffectId],controlId:'segments',active:true}]);
 assert.deepEqual(profile.publicControlBindings.segmentsB,[{nodePath:[compositeBId,directEffectId],controlId:'segments',active:true}]);
 const graphDefinitions=Object.values(profile.definitions).filter(row=>row.kind==='graph');
 assert.equal(graphDefinitions.length,3);
 assert.deepEqual(graphDefinitions.map(row=>row.metadata.inputs.image?.label??null).sort(),['Image','Image',null]);
});
test('recursive composition import cycles reject before authored code can execute',()=>{
 const source=nestedCompositionSourceBundle();
 source.files['wrapper.ts']=`import {defineComposition} from '@lux/visual-sdk'; import composite from './composite.ts'; export default defineComposition({definitions:{composite},nodes:[{id:'${wrappedEffectId}',definition:'composite'}],edges:[],input:{nodeId:'${wrappedEffectId}',portId:'image'},output:{nodeId:'${wrappedEffectId}',portId:'image'},expose:[]});`;
 const asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
 assert.throws(()=>extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash}),/cycle|recursive/i);
});
test('recursive extraction rejects flattened chains above eight leaves and graph depth above eight',()=>{
 const ids=Array.from({length:9},(_,index)=>`${String(index+1).padStart(8,'0')}-0000-4000-8000-${String(index+1).padStart(12,'0')}`),edgeIds=Array.from({length:8},(_,index)=>`${(index+10).toString(16).padStart(8,'0')}-0000-4000-8000-${String(index+10).padStart(12,'0')}`),base=compositionSourceBundle();
 const overlong={sdkVersion:'0.4.0',entry:'composition.ts',files:{...base.files,'composition.ts':`import {defineComposition} from '@lux/visual-sdk';import ball from './ball.ts';import kaleidoscope from './kaleidoscope.ts';export default defineComposition({definitions:{ball,kaleidoscope},nodes:[${ids.map((id,index)=>`{id:'${id}',definition:'${index?'kaleidoscope':'ball'}'}`).join(',')}],edges:[${edgeIds.map((id,index)=>`{id:'${id}',from:{nodeId:'${ids[index]}',portId:'image'},to:{nodeId:'${ids[index+1]}',portId:'image'},delay:'none'}`).join(',')}],output:{nodeId:'${ids.at(-1)}',portId:'image'},expose:[]});`}};
 const deepFiles={'ball.ts':base.files['ball.ts']};for(let index=8;index>=0;index--){const child=index===8?'ball':`level${index+1}`,definition=index===8?'ball':'nested';deepFiles[`level${index}.ts`]=`import {defineComposition} from '@lux/visual-sdk';import ${definition} from './${child}.ts';export default defineComposition({definitions:{${definition}},nodes:[{id:'${ids[index]}',definition:'${definition}'}],edges:[],output:{nodeId:'${ids[index]}',portId:'image'},expose:[]});`;}
 for(const source of [overlong,{sdkVersion:'0.4.0',entry:'level0.ts',files:deepFiles}]){const asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));assert.throws(()=>extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash}),/1–8|level budget/i);}
});
