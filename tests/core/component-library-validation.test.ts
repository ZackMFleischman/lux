import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { libraryValidationSource, validateLibraryCandidate } from '../../packages/core/src/component-library-validation.ts';
import type { SourceBundle } from '../../packages/runtime-contracts/src/index.ts';

const options = { dependencyRoot: process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules') };
const imagePort = `{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Rendered image'}`;
const pathsPort = `{type:{kind:'paths2d',version:1,coordinateSpace:'canvas-height'},label:'Paths',description:'Tracer paths'}`;
const signalPort = `{type:{kind:'signal',value:'number',unit:null,clock:'frame'},label:'Signal',description:'Frame signal'}`;

async function compileForLibrary(source: SourceBundle) {
  const compiled = await compileVisual({ source }, options);
  if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics };
  return { ok: true, linked: await linkRuntime(compiled.artifact, options) };
}

function wanderingTracers(): SourceBundle {
  return { sdkVersion: '0.4.0', entry: 'composition.ts', files: {
    'paths.ts': `import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/tracer-paths',label:'Tracer paths',description:'Produces tracer path resources.',tags:[],inputs:{},outputs:{paths:${pathsPort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateful',reset:'seed'}},async create(){return {update(){},async evaluate(_inputs,context){return {paths:context.paths('paths',{version:1,paths:[]})}},reset(){},dispose(){}}}});`,
    'renderer.ts': `import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/tracer-renderer',label:'Tracer renderer',description:'Renders tracer paths over an image.',tags:[],inputs:{image:${imagePort},paths:${pathsPort}},outputs:{image:${imagePort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateful',reset:'seed'}},async create(){return {update(){},async evaluate(inputs,context){void inputs.image.texture;void inputs.paths.data.paths.length;return {image:await context.render({}, {}, 'image')}},reset(){},dispose(){}}}});`,
    'composition.ts': `import {defineComposition} from '@lux/visual-sdk';import paths from './paths.ts';import renderer from './renderer.ts';
export default defineComposition({label:'Wandering Tracers',definitions:{paths,renderer},nodes:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',definition:'paths'},{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',definition:'renderer'}],edges:[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',from:{nodeId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',portId:'paths'},to:{nodeId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',portId:'paths'},delay:'none'}],input:{nodeId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',portId:'image'},output:{nodeId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',portId:'image'},expose:[]});`,
  } };
}

function imageLeaf(): SourceBundle {
  return { sdkVersion: '0.4.0', entry: 'component.ts', files: {
    'component.ts': `import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/library-leaf',label:'Library leaf',description:'Produces an image without an input.',tags:[],inputs:{},outputs:{image:${imagePort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}},async create(){return {update(){},async evaluate(_inputs,context){return {image:await context.render({}, {})}},reset(){},dispose(){}}}});`,
  } };
}

function pathGeneratorLeaf(): SourceBundle {
  return { sdkVersion: '0.4.0', entry: 'generator.ts', files: {
    'generator.ts': `import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/library-generator',label:'Library generator',description:'Produces tracer paths.',tags:[],inputs:{},outputs:{paths:${pathsPort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateful',reset:'seed'}},async create(){return {update(){},async evaluate(_inputs,context){return {paths:context.paths('paths',{version:1,paths:[]})}},reset(){},dispose(){}}}});`,
  } };
}

function pathRendererLeaf(): SourceBundle {
  return { sdkVersion: '0.4.0', entry: 'renderer.ts', files: {
    'renderer.ts': `import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/library-renderer',label:'Library renderer',description:'Renders tracer paths over an image.',tags:[],inputs:{image:${imagePort},paths:${pathsPort}},outputs:{image:${imagePort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateful',reset:'seed'}},async create(){return {update(){},async evaluate(inputs,context){void inputs.image.texture;void inputs.paths.data.paths.length;return {image:await context.render({}, {}, 'image')}},reset(){},dispose(){}}}});`,
  } };
}

test('library validation compiles a nested typed-path composition inside a closed image harness without changing its source', async () => {
  const source = wanderingTracers();
  const original = structuredClone(source);
  let submitted: SourceBundle | undefined;

  await validateLibraryCandidate(source, async candidate => {
    submitted = candidate;
    return compileForLibrary(candidate);
  });

  assert.deepEqual(source, original);
  assert.equal(submitted?.sdkVersion, '0.4.0');
  assert.notEqual(submitted?.entry, source.entry);
  assert.equal(Object.keys(submitted?.files ?? {}).length, Object.keys(source.files).length + 2);
  for (const [path, text] of Object.entries(source.files)) assert.equal(submitted?.files[path], text);
});

test('library validation preserves the zero-input leaf compiler path', async () => {
  const source = imageLeaf();
  let submitted: SourceBundle | undefined;

  await validateLibraryCandidate(source, async candidate => {
    submitted = candidate;
    return compileForLibrary(candidate);
  });

  assert.equal(submitted?.sdkVersion, '0.3.0');
  assert.deepEqual(submitted?.files, source.files);
});

test('library validation compiles a standalone paths2d generator through a closed image graph', async () => {
  const source = pathGeneratorLeaf();
  const original = structuredClone(source);
  let submitted: SourceBundle | undefined;

  await validateLibraryCandidate(source, async candidate => {
    submitted = candidate;
    return compileForLibrary(candidate);
  });

  assert.deepEqual(source, original);
  assert.equal(submitted?.sdkVersion, '0.4.0');
  assert.notEqual(submitted?.entry, source.entry);
  assert.equal(Object.keys(submitted?.files ?? {}).length, 3);
  assert.equal(submitted?.files[source.entry], source.files[source.entry]);
});

test('library validation compiles a standalone image and paths2d renderer through typed providers', async () => {
  const source = pathRendererLeaf();
  const original = structuredClone(source);
  let submitted: SourceBundle | undefined;

  await validateLibraryCandidate(source, async candidate => {
    submitted = candidate;
    return compileForLibrary(candidate);
  });

  assert.deepEqual(source, original);
  assert.equal(submitted?.sdkVersion, '0.4.0');
  assert.notEqual(submitted?.entry, source.entry);
  assert.equal(Object.keys(submitted?.files ?? {}).length, 3);
  assert.equal(submitted?.files[source.entry], source.files[source.entry]);
});

test('library validation preserves compiler resource-type diagnostics for standalone typed leaves', async () => {
  const source = pathRendererLeaf();
  source.files[source.entry] = source.files[source.entry]!.replace('inputs.paths.data.paths.length', 'inputs.paths.texture');

  await assert.rejects(
    validateLibraryCandidate(source, compileForLibrary),
    /texture.*Paths2DResource|Paths2DResource.*texture/i,
  );
});

test('library validation rejects standalone typed leaves with unsupported signal ports', () => {
  const source = pathGeneratorLeaf();
  source.files[source.entry] = source.files[source.entry]!.replace(pathsPort, signalPort);

  assert.throws(() => libraryValidationSource(source), /only image and paths2d ports/i);
});

test('library validation reserves two source-file slots for a composition image boundary', () => {
  const source = wanderingTracers();
  for (let index = 0; index < 28; index++) source.files[`extra-${index}.ts`] = '';

  assert.throws(() => libraryValidationSource(source), /two free source files/i);
});
