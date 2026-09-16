import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';
import * as sdk from '../../packages/visual-sdk/src/sdk-composition.ts';
import {extractCompositionDeclaration} from '../../apps/build-worker/src/composition-declarations.mjs';
import {compositionSourceBundle,nestedCompositionSourceBundle,ballSource} from './composition-fixture.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
function extract(source){const asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));return extractCompositionDeclaration({...source,asts,hash});}
function modern(){const source=nestedCompositionSourceBundle();for(const path of ['composition.ts','composite.ts','wrapper.ts'])source.files[path]=source.files[path].replaceAll('defineComposition',path===source.entry?'defineVisual':'defineComponent');return source;}

test('component model admits defineVisual with reusable graph defineComponent and preserves leaf targets',()=>{
 const legacy=extract(nestedCompositionSourceBundle()),profile=extract(modern());
 assert.deepEqual(profile.nodes,legacy.nodes);
 assert.deepEqual(profile.publicControlBindings,legacy.publicControlBindings);
 assert.deepEqual(profile.publicControls,legacy.publicControls);
});

test('component model preserves canonical legacy profiles and all saved identities',()=>{
 assert.equal(hash(JSON.stringify(extract(compositionSourceBundle()))),'1b6367b9a8a096e921b8b04c29ab45a6d4117a307389fee538e3a1a73d86d616');
 assert.equal(hash(JSON.stringify(extract(nestedCompositionSourceBundle()))),'7c15ca6af245d8fb07fc09c3b406d323b73e1327237ee8e48cd85d52fd8e9854');
});

test('SDK author helpers normalize graph components and visuals to the existing runtime shape',()=>{
 const body={definitions:{},nodes:[],edges:[],output:{nodeId:'test',portId:'image'},expose:[]};
 assert.equal(typeof sdk.defineVisual,'function');
 assert.deepEqual(sdk.defineComponent(body),sdk.defineComposition(body));
 assert.deepEqual(sdk.defineVisual(body),sdk.defineComposition(body));
 assert.equal(Object.isFrozen(sdk.defineVisual(body)),true);
 assert.throws(()=>sdk.defineVisual({...body,input:body.output}),/external image input|input/i);
 assert.throws(()=>sdk.defineComponent({...body,create(){}}),/fields|only|requires/i);
});

test('component model rejects nested runnable visuals, non-visual roots and mixed author fields',()=>{
 for(const [change,expected] of [
  [source=>{source.files['wrapper.ts']=source.files['wrapper.ts'].replaceAll('defineComponent','defineVisual');},/nested|reusable|visual.*root/i],
  [source=>{source.files[source.entry]=source.files[source.entry].replaceAll('defineVisual','defineComponent');},/entry|root/i],
  [source=>{source.entry='ball.ts';},/entry|root/i],
  [source=>{source.files[source.entry]=source.files[source.entry].replace('expose:[',"input:{nodeId:'11111111-1111-4111-8111-111111111111',portId:'image'},expose:[");},/external image input|input/i],
  [source=>{source.files['wrapper.ts']=source.files['wrapper.ts'].replace('definitions:{','metadata:{},definitions:{');},/only|unsupported|mixed|requires/i],
 ]) {const source=modern();change(source);assert.throws(()=>extract(source),expected);}
});

test('ambiguous recognized author calls are rejected before declaration extraction',()=>{
 const source=compositionSourceBundle(),asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
 const declaration=asts[source.entry].program.body[0],alias=structuredClone(declaration.specifiers[0]);
 alias.imported.name='defineVisual';declaration.specifiers.push(alias);
 assert.throws(()=>extractCompositionDeclaration({...source,asts,hash}),/unambiguously/);
});

test('shipped component/visual templates compile and link through the existing image-chain runtime',async()=>{
 const files={'source.ts':ballSource};
 files['source.ts']=files['source.ts'].replace('update(){}','update(frame){const value:number=frame.controls.intensity;}');
 files['author-types.ts']=`import type {CodeComponentDefinition,GraphComponentDefinition,ComponentDefinition,CompositionDefinition,VisualDefinition} from '@lux/visual-sdk';
 import group from './component-group.ts';
 const graph:GraphComponentDefinition=group;
 const oldName:CompositionDefinition=graph;
 const component:ComponentDefinition=oldName;
 function factory(value:ComponentDefinition){if(value.kind==='component'){const leaf:CodeComponentDefinition=value;return leaf.create;}return undefined;}
 export {component};`;
 for(const name of ['component-group.ts','component-visual.ts'])files[name]=await readFile(new URL(`../../skills/lux-visual-creation/assets/${name}`,import.meta.url),'utf8');
 const options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
 const result=await compileVisual({source:{sdkVersion:'0.4.0',entry:'component-visual.ts',files}},options);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.artifact.executionModel,'image-chain-v1');
 assert.equal(result.artifact.artifactVersion,5);
 assert.deepEqual(result.artifact.controls.map(control=>control.id),['amount']);
 const linked=await linkRuntime(result.artifact,options);
 assert.equal(linked.linkedVersion,5);
 assert.deepEqual(linked.composition.nodes[0].nodePath,['22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111']);
 for(const [update,error] of [['frame.controls.missing;',/missing/],['frame.controls.intensity=2;',/read-only/]]){
  const invalid=await compileVisual({source:{sdkVersion:'0.4.0',entry:'component-visual.ts',files:{...files,'source.ts':ballSource.replace('update(){}',`update(frame){${update}}`)}}},options);
  assert.equal(invalid.ok,false);assert.match(JSON.stringify(invalid.diagnostics),error);
 }
});
