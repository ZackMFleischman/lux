import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { prismaticCompositionSource } from './fixtures/prismatic-composition/source-bundle.mjs';
const options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
test('Studio prismatic fixture compiles and links a three-stage image chain with independent instance controls',async()=>{
  const compiled=await compileVisual({source:prismaticCompositionSource()},options);assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
  assert.equal(compiled.artifact.artifactVersion,5);assert.deepEqual(compiled.artifact.controls.map(row=>row.id),['ballIntensity','segmentsA','segmentsB']);
  const linked=await linkRuntime(compiled.artifact,options);assert.equal(linked.linkedVersion,5);assert.equal(linked.composition.nodes.length,3);
});
