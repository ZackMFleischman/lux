import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';
import {compositionSourceBundle} from './composition-fixture.mjs';
const options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
test('compiler seals the first image composition as v5 and never evaluates authored modules',async()=>{
 const source=compositionSourceBundle();source.files['ball.ts']="throw Error('static extraction must not execute');\n"+source.files['ball.ts'];
 const result=await compileVisual({source},options);assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.artifact.artifactVersion,5);assert.equal(result.artifact.executionModel,'image-chain-v1');
 assert.deepEqual(result.artifact.controls.map(row=>row.id),['ballIntensity','segmentsA','segmentsB']);
 const linked=await linkRuntime(result.artifact,options);assert.equal(linked.linkedVersion,5);assert.equal(linked.sdkVersion,'0.4.0');
 assert.equal(linked.composition.nodes.length,3);
});
test('compiler admits a one-node SDK 0.4 image composition with no edges',async()=>{
 const source=compositionSourceBundle();
 source.files['composition.ts']=`import {defineComposition} from '@lux/visual-sdk';
import ball from './ball.ts';
export default defineComposition({definitions:{ball},nodes:[
 {id:'11111111-1111-4111-8111-111111111111',definition:'ball'}],edges:[],
 output:{nodeId:'11111111-1111-4111-8111-111111111111',portId:'image'},expose:[
 {id:'ballIntensity',nodeId:'11111111-1111-4111-8111-111111111111',controlId:'intensity'}]});`;
 delete source.files['kaleidoscope.ts'];
 const result=await compileVisual({source},options);assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.artifact.executionModel,'image-chain-v1');assert.equal(result.artifact.composition.nodes.length,1);assert.deepEqual(result.artifact.composition.declaration.edges,[]);
});
test('compiler still rejects a multi-node SDK 0.4 composition without its connecting edge',async()=>{
 const source=compositionSourceBundle();
 source.files['composition.ts']=source.files['composition.ts'].replace(/edges:\[[\s\S]*?\],\n output:/,'edges:[],\n output:');
 const result=await compileVisual({source},options);assert.equal(result.ok,false);assert.match(result.diagnostics?.[0]?.message??'',/linear image chain/);
});
