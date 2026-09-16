import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { prismaticCompositionSource } from './fixtures/prismatic-composition/source-bundle.mjs';
import { nestedPrismaticCompositionSource } from './fixtures/nested-prismatic-composition/source-bundle.mjs';
const options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
test('Studio prismatic fixture compiles and links a three-stage image chain with independent instance controls',async()=>{
  const compiled=await compileVisual({source:prismaticCompositionSource()},options);assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
  assert.equal(compiled.artifact.artifactVersion,5);assert.deepEqual(compiled.artifact.controls.map(row=>row.id),['ballIntensity','segmentsA','segmentsB']);
  assert.deepEqual(compiled.artifact.controls.map(row=>row.description),['Controls the height of the animated spikes.','Sets the number of independently mirrored wedges.','Sets the number of independently mirrored wedges.']);
  const linked=await linkRuntime(compiled.artifact,options);assert.equal(linked.linkedVersion,5);assert.equal(linked.composition.nodes.length,3);
});
test('Studio nested prismatic fixture compiles two reusable composite instances and a recursive wrapper',async()=>{
  const compiled=await compileVisual({source:nestedPrismaticCompositionSource()},options);assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
  assert.equal(compiled.artifact.artifactVersion,5);assert.deepEqual(compiled.artifact.controls.map(row=>row.id),['ballIntensity','segmentsA','segmentsB']);
  const linked=await linkRuntime(compiled.artifact,options);assert.equal(linked.linkedVersion,5);
  assert.equal(linked.composition.nodes.length,5);assert.equal(Object.values(linked.composition.definitions).filter(row=>row.kind==='graph').length,3);
  assert.deepEqual(linked.composition.publicControlBindings.segmentsA[0].nodePath,['44444444-4444-4444-8444-444444444444','66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777']);
});
test('repository library Prismatic Ball compiles and links as a standalone image source',async()=>{
  const code=await readFile(resolve('library/components/93a7215f-4df1-4e1e-9d34-3f7f0f27ad84/revisions/1/source/component.ts'),'utf8');
  const compiled=await compileVisual({source:{sdkVersion:'0.3.0',entry:'component.ts',files:{'component.ts':code}}},options);
  assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
  assert.equal(compiled.artifact.artifactVersion,4);
  const linked=await linkRuntime(compiled.artifact,options);
  assert.equal(linked.linkedVersion,4);
  assert.equal(linked.component.label,'Prismatic Ball');
});
