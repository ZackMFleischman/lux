import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { compositionSourceBundle } from './composition-fixture.mjs';

const options = { dependencyRoot: process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules') };
const generatorId = '11111111-1111-4111-8111-111111111111';
const painterId = '22222222-2222-4222-8222-222222222222';
const overlayId = '33333333-3333-4333-8333-333333333333';
const pathsPort = `{type:{kind:'paths2d',version:1,coordinateSpace:'canvas-height'},label:'Paths',description:'Tracer paths'}`;
const imagePort = `{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Rendered image'}`;

function typedBundle() {
  return { sdkVersion: '0.4.0', entry: 'composition.ts', files: {
    'generator.ts': `import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/path-generator',label:'Generator',description:'Generates paths',tags:[],inputs:{},outputs:{paths:${pathsPort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateful',reset:'seed'}},async create(){return {update(){},async evaluate(_inputs,context){return {paths:context.paths('paths',{version:1,paths:[]})}},reset(){},dispose(){}}}});`,
    'painter.ts': `import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/path-painter',label:'Painter',description:'Paints paths',tags:[],inputs:{paths:${pathsPort}},outputs:{paint:${imagePort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateful',reset:'seed'}},async create(){return {update(){},async evaluate(inputs,context){const first=inputs.paths.data.paths[0];void first?.points.at(-1)?.x;return {paint:await context.render({}, {}, 'paint')}},reset(){},dispose(){}}}});`,
    'overlay.ts': `import {defineComponent} from '@lux/visual-sdk';
export default defineComponent({metadata:{declarationVersion:1,key:'demo/path-overlay',label:'Overlay',description:'Overlays paths',tags:[],inputs:{paths:${pathsPort},base:${imagePort}},outputs:{final:${imagePort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}},async create(){return {update(){},async evaluate(inputs,context){void inputs.paths.data.paths.length;void inputs.base.texture;return {final:await context.render({}, {}, 'final')}},reset(){},dispose(){}}}});`,
    'composition.ts': `import {defineComposition} from '@lux/visual-sdk';import generator from './generator.ts';import painter from './painter.ts';import overlay from './overlay.ts';
export default defineComposition({definitions:{generator,painter,overlay},nodes:[{id:'${generatorId}',definition:'generator'},{id:'${painterId}',definition:'painter'},{id:'${overlayId}',definition:'overlay'}],edges:[
{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',from:{nodeId:'${generatorId}',portId:'paths'},to:{nodeId:'${painterId}',portId:'paths'},delay:'none'},
{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',from:{nodeId:'${generatorId}',portId:'paths'},to:{nodeId:'${overlayId}',portId:'paths'},delay:'none'},
{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',from:{nodeId:'${painterId}',portId:'paint'},to:{nodeId:'${overlayId}',portId:'base'},delay:'none'}],output:{nodeId:'${overlayId}',portId:'final'},expose:[]});`,
  } };
}

test('compiler admits a named-port paths2d fan-out DAG as typed-image-graph-v1 profile 2', async () => {
  const result = await compileVisual({ source: typedBundle() }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.artifact.artifactVersion, 5);
  assert.equal(result.artifact.executionModel, 'typed-image-graph-v1');
  assert.equal(result.artifact.composition.version, 2);
  assert.deepEqual(result.artifact.composition.nodes.map(node => node.nodePath[0]), [generatorId, painterId, overlayId]);
  const linked = await linkRuntime(result.artifact, options);
  assert.equal(linked.executionModel, 'typed-image-graph-v1');
  assert.equal(linked.composition.version, 2);
});

test('typed component declarations enforce input resources and named resource outputs', async () => {
  const mutations = [
    source => { source.files['generator.ts'] = source.files['generator.ts'].replace("context.paths('paths',{version:1,paths:[]})", "context.render({}, {}, 'paths')"); },
    source => { source.files['painter.ts'] = source.files['painter.ts'].replace('inputs.paths.data.paths[0]', 'inputs.paths.texture'); },
    source => { source.files['painter.ts'] = source.files['painter.ts'].replace("context.render({}, {}, 'paint')", 'context.render({}, {})'); },
    source => { source.files['overlay.ts'] = source.files['overlay.ts'].replace("context.render({}, {}, 'final')", "context.render({}, {}, 'missing')"); },
  ];
  for (const mutate of mutations) {
    const source = typedBundle(); mutate(source);
    const result = await compileVisual({ source }, options);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.match(JSON.stringify(result.diagnostics), /assignable|property|argument|port|resource/i);
  }
});

test('compiler rejects authored typed graphs containing internal-only signal ports', async () => {
  const source = typedBundle();
  const signalPort = `{type:{kind:'signal',value:'number',unit:null,clock:'frame'},label:'Signal',description:'Frame signal'}`;
  for (const path of ['generator.ts', 'painter.ts', 'overlay.ts']) source.files[path] = source.files[path].replaceAll(pathsPort, signalPort);
  source.files['generator.ts'] = source.files['generator.ts'].replace("context.paths('paths',{version:1,paths:[]})", 'undefined as never');
  source.files['painter.ts'] = source.files['painter.ts'].replace("const first=inputs.paths.data.paths[0];void first?.points.at(-1)?.x;", 'void inputs.paths;');
  source.files['overlay.ts'] = source.files['overlay.ts'].replace('void inputs.paths.data.paths.length;', 'void inputs.paths;');
  const result = await compileVisual({ source }, options);
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.match(JSON.stringify(result.diagnostics), /signal|image.*paths2d|unsupported.*port/i);
});

test('SDK 0.4 preserves ImageInputs and default two-argument render for image chains', async () => {
  const source = compositionSourceBundle();
  source.files['ball.ts'] = source.files['ball.ts'].replace(
    "import {defineComponent} from '@lux/visual-sdk';",
    "import {defineComponent,type ImageInputs,type EvaluationContext,type ComponentInstance,type ComponentDefinition} from '@lux/visual-sdk';\nconst legacy=(inputs:ImageInputs,context:EvaluationContext)=>context.render({}, {});void legacy;\nconst instance:ComponentInstance={update(){},async evaluate(inputs,context){void inputs.image!.texture;return {image:await context.render({}, {})};},reset(){},dispose(){}};\nconst annotation=(definition:ComponentDefinition)=>definition.create;void annotation;void instance;",
  );
  const result = await compileVisual({ source }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.artifact.executionModel, 'image-chain-v1');
  assert.equal(result.artifact.composition.version, 1);
});

test('typed composition admission rejects cycles and unreachable nodes', async () => {
  const cycle = typedBundle();
  cycle.files['painter.ts'] = cycle.files['painter.ts'].replace(`inputs:{paths:${pathsPort}}`, `inputs:{paths:${pathsPort},feedback:${imagePort}}`);
  cycle.files['composition.ts'] = cycle.files['composition.ts'].replace(`],output:`, `,{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',from:{nodeId:'${overlayId}',portId:'final'},to:{nodeId:'${painterId}',portId:'feedback'},delay:'none'}],output:`);
  const cyclic = await compileVisual({ source: cycle }, options);
  assert.equal(cyclic.ok, false); assert.match(JSON.stringify(cyclic.diagnostics), /cycle/i);

  const unreachable = typedBundle();
  unreachable.files['composition.ts'] = unreachable.files['composition.ts'].replace(`{id:'${overlayId}',definition:'overlay'}]`, `{id:'${overlayId}',definition:'overlay'},{id:'44444444-4444-4444-8444-444444444444',definition:'generator'}]`);
  const pruned = await compileVisual({ source: unreachable }, options);
  assert.equal(pruned.ok, false); assert.match(JSON.stringify(pruned.diagnostics), /reachable|outside|pruned/i);
});
