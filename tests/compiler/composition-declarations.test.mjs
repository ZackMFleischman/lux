import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {createHash} from 'node:crypto';
import {extractCompositionDeclaration} from '../../apps/build-worker/src/composition-declarations.mjs';
import {prepareCompositionControlState} from '../../packages/runtime/src/components/composition-controls.ts';
import {compositionSourceBundle,nestedCompositionSourceBundle,ballId,kaleidoscopeAId,kaleidoscopeBId,compositeAId,compositeBId,wrapperNodeId,wrappedEffectId,directEffectId} from './composition-fixture.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
test('composition exposes 64 controls without a cardinality ceiling',()=>{
 const source=compositionSourceBundle();
 const controls=Object.fromEntries(Array.from({length:64},(_,i)=>[`control${i}`,{type:'number',label:`Control ${i}`,default:0,min:0,max:1}]));
 source.files['ball.ts']=source.files['ball.ts'].replace(/controls:\{[\s\S]*?,lifecycle:/,`controls:${JSON.stringify(controls)},controlDescriptions:${JSON.stringify(Object.fromEntries(Object.keys(controls).map(id=>[id,'Value'])))},lifecycle:`);
 const exposed=Array.from({length:64},(_,i)=>`{id:'control${i}',nodeId:'${ballId}',controlId:'control${i}'}`).join(',');
 source.files['composition.ts']=source.files['composition.ts'].replace(/expose:\[[\s\S]*?\]\}\);/,`expose:[${exposed}]});`);
 const asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
 const profile=extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash});
 assert.equal(profile.publicControls.length,64);
 assert.equal(profile.declaration.expose.length,64);
 const mutable=structuredClone(profile),prepare=prepareCompositionControlState(mutable);
 mutable.declaration.expose=[];
 const first=prepare(),saved=first.snapshot();
 const second=prepare(saved);second.applyNode([ballId],{control63:.8},profile.nodes[0].schemaHash);
 assert.equal(second.values().control63,.8);assert.equal(first.values().control63,0);
 const invalid=structuredClone(saved);invalid.nodes[0].values.control63=99;
 assert.throws(()=>prepare(invalid));
});
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
test('recursive extraction accepts a 600-component flat chain while retaining the graph depth limit',()=>{
 const count=600,ids=Array.from({length:count},(_,index)=>`${String(index+1).padStart(8,'0')}-0000-4000-8000-${String(index+1).padStart(12,'0')}`),edgeIds=Array.from({length:count-1},(_,index)=>`${(index+1000).toString(16).padStart(8,'0')}-0000-4000-8000-${String(index+1000).padStart(12,'0')}`),base=compositionSourceBundle();
 const large={sdkVersion:'0.4.0',entry:'composition.ts',files:{...base.files,'composition.ts':`import {defineComposition} from '@lux/visual-sdk';import ball from './ball.ts';import kaleidoscope from './kaleidoscope.ts';export default defineComposition({definitions:{ball,kaleidoscope},nodes:[${ids.map((id,index)=>`{id:'${id}',definition:'${index?'kaleidoscope':'ball'}'}`).join(',')}],edges:[${edgeIds.map((id,index)=>`{id:'${id}',from:{nodeId:'${ids[index]}',portId:'image'},to:{nodeId:'${ids[index+1]}',portId:'image'},delay:'none'}`).join(',')}],output:{nodeId:'${ids.at(-1)}',portId:'image'},expose:[]});`}};
 const largeAsts=Object.fromEntries(Object.entries(large.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})])),profile=extractCompositionDeclaration({entry:large.entry,files:large.files,asts:largeAsts,hash});
 assert.equal(profile.nodes.length,count);assert.equal(profile.declaration.nodes.length,count);assert.equal(profile.declaration.edges.length,count-1);
 const deepFiles={'ball.ts':base.files['ball.ts']};for(let index=8;index>=0;index--){const child=index===8?'ball':`level${index+1}`,definition=index===8?'ball':'nested';deepFiles[`level${index}.ts`]=`import {defineComposition} from '@lux/visual-sdk';import ${definition} from './${child}.ts';export default defineComposition({definitions:{${definition}},nodes:[{id:'${ids[index]}',definition:'${definition}'}],edges:[],output:{nodeId:'${ids[index]}',portId:'image'},expose:[]});`;}
 const deep={sdkVersion:'0.4.0',entry:'level0.ts',files:deepFiles},deepAsts=Object.fromEntries(Object.entries(deep.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
 assert.throws(()=>extractCompositionDeclaration({entry:deep.entry,files:deep.files,asts:deepAsts,hash}),/level budget/i);
});
test('typed composition inputs infer child port metadata and readable graph identities',()=>{
 const imagePort=`{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Background image'}`;
 const fieldPort=`{type:{kind:'shader-field',version:1,abi:'lux/quasar-bodies/v1'},label:'Bodies',description:'Planet field'}`;
 const files={
  'renderer.ts':`import {defineComponent} from '@lux/visual-sdk';export default defineComponent({metadata:{declarationVersion:1,key:'quasar/renderer',label:'Renderer',description:'Renderer',tags:[],inputs:{image:${imagePort},bodies:${fieldPort}},outputs:{image:${imagePort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}},async create(){return {update(){},async evaluate(inputs,context){void inputs.image.texture;void inputs.bodies.data.abi;return {image:await context.render({}, {}, 'image')}},reset(){},dispose(){}}}});`,
  'provider.ts':`import {defineComponent} from '@lux/visual-sdk';export default defineComponent({metadata:{declarationVersion:1,key:'quasar/provider',label:'Provider',description:'Provider',tags:[],inputs:{},outputs:{image:${imagePort},bodies:${fieldPort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}},async create(){return {update(){},async evaluate(_inputs,context){return {image:await context.render({}, {}, 'image'),bodies:context.shaderField('bodies',{version:1,abi:'lux/quasar-bodies/v1',fragments:{},values:{}})}},reset(){},dispose(){}}}});`,
  'component.ts':`import {defineComponent} from '@lux/visual-sdk';import renderer from './renderer.ts';export default defineComponent({definitions:{renderer},nodes:[{id:'quasar.renderer',definition:'renderer'}],edges:[],inputs:{image:{nodeId:'quasar.renderer',portId:'image'},bodies:{nodeId:'quasar.renderer',portId:'bodies'}},output:{nodeId:'quasar.renderer',portId:'image'},expose:[]});`,
  'visual.ts':`import {defineVisual} from '@lux/visual-sdk';import provider from './provider.ts';import quasar from './component.ts';export default defineVisual({definitions:{provider,quasar},nodes:[{id:'inputs',definition:'provider'},{id:'quasar',definition:'quasar'}],edges:[{id:'image-to-quasar',from:{nodeId:'inputs',portId:'image'},to:{nodeId:'quasar',portId:'image'},delay:'none'},{id:'bodies-to-quasar',from:{nodeId:'inputs',portId:'bodies'},to:{nodeId:'quasar',portId:'bodies'},delay:'none'}],output:{nodeId:'quasar',portId:'image'},expose:[]});`,
 };
 const asts=Object.fromEntries(Object.entries(files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})])),profile=extractCompositionDeclaration({entry:'visual.ts',files,asts,hash});
 const component=Object.values(profile.definitions).find(definition=>definition.kind==='graph'&&definition.metadata.inputs.bodies);
 assert.deepEqual(Object.keys(component.metadata.inputs),['bodies','image']);
 assert.equal(component.metadata.inputs.bodies.type.kind,'shader-field');assert.equal(component.metadata.inputs.bodies.type.abi,'lux/quasar-bodies/v1');
 assert.deepEqual(component.body.inputBindings,{bodies:[{nodeId:'quasar.renderer',portId:'bodies'}],image:[{nodeId:'quasar.renderer',portId:'image'}]});
 assert.ok(profile.nodes.some(node=>JSON.stringify(node.nodePath)===JSON.stringify(['quasar','quasar.renderer'])));
});
test('typed composition inputs reject legacy input conflicts and duplicate boundary targets',()=>{
 const source=compositionSourceBundle(),base=source.files['composition.ts'];
 for(const [text,expected] of [
  [base.replace('output:',`input:{nodeId:'${kaleidoscopeAId}',portId:'image'},inputs:{image:{nodeId:'${kaleidoscopeAId}',portId:'image'}},output:`),/input.*inputs|mutually exclusive/i],
  [base.replace(`output:`, `inputs:{first:{nodeId:'${kaleidoscopeAId}',portId:'image'},second:{nodeId:'${kaleidoscopeAId}',portId:'image'}},output:`).replace(/input:\{[^}]+\},/,''),/duplicate writer|boundary/i],
 ]){
  const files={...source.files,'composition.ts':text},asts=Object.fromEntries(Object.entries(files).map(([path,value])=>[path,parse(value,{sourceType:'module',plugins:['typescript']})]));
  assert.throws(()=>extractCompositionDeclaration({entry:source.entry,files,asts,hash}),expected);
 }
});
