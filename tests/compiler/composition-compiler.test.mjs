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
