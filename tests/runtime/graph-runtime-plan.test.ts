import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareGraphRuntimePlan, readGraphRuntimePlan } from '../../packages/runtime/src/graph/runtime-plan.ts';
import type { GraphRuntimePlan } from '../../packages/runtime/src/graph/runtime-plan.ts';
import { validateNestedGraph } from '../../packages/runtime/src/graph/nested-validate.ts';
import { planNestedGraph } from '../../packages/runtime/src/graph/nested-plan.ts';
import type { NestedExecutionPlan, NodeControlOverride } from '../../packages/runtime-contracts/src/nested-graph.ts';
import { nodeIdSchema } from '../../packages/runtime-contracts/src/identities.ts';
import { basic, twins, chain, leaves, fanout, controlFanout, clone, uuid, hash, meta, node, ref, graphDef, control, signal, image, edge } from './nested-graph-fixtures.ts';
import { basic as basicV1 } from './graph-fixtures.ts';
import { validateGraph } from '../../packages/runtime/src/graph/validate.ts';
import { planGraph } from '../../packages/runtime/src/graph/plan.ts';

const admit = (raw: ReturnType<typeof basic>) => validateNestedGraph(raw.graph, raw.definitions);
function frozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) frozen(child);
}
function diamond() {
  const raw = clone({ graph: { version: 2, rootDefinitionHash: hash(1), outputPort: 'image' }, definitions: {
    [hash(1)]: graphDef([node(1,2),node(2,3),node(3,3),node(4,4)], [
      edge(1,uuid(1),'value',uuid(2),'input'), edge(2,uuid(1),'value',uuid(3),'input'),
      edge(3,uuid(2),'value',uuid(4),'left'), edge(4,uuid(3),'value',uuid(4),'right'),
    ], {}, {image:ref(4)}),
    [hash(2)]: {kind:'code',metadata:meta({}, {value:signal}, {gain:control(1)})},
    [hash(3)]: {kind:'code',metadata:meta({input:signal}, {value:signal}, {gain:control(2)})},
    [hash(4)]: {kind:'code',metadata:meta({left:signal,right:signal}, {image})},
  }});
  // Normalized metadata is frozen: mutate only this detached raw fixture.
  for (const definition of Object.values(raw.definitions)) {
    definition.metadata = {...definition.metadata,lifecycle:{...definition.metadata.lifecycle,state:'stateful'}};
  }
  return raw;
}

test('prepares actual admitted input and preserves the immutable planner result', () => {
  const admitted = admit(basic());
  const token = prepareGraphRuntimePlan(admitted);
  const result = readGraphRuntimePlan(token);
  assert.deepEqual(result, planNestedGraph(admitted));
  assert.deepEqual(result.finalOutput, {nodePath:[uuid(1)],portId:'image'});
  assert.equal(Object.getPrototypeOf(token), null);
  assert.deepEqual(Reflect.ownKeys(token), []);
  assert.ok(Object.isFrozen(token));
  frozen(result);
  assert.equal(readGraphRuntimePlan(token), result);
});

test('delegates nested defaults, fractional overrides, and pruning without reinterpretation', () => {
  const raw = twins(), admitted = admit(raw);
  const overrides = [{nodePath:[uuid(1),uuid(3)].map(id => nodeIdSchema.parse(id)),values:{gain:6.125}}];
  const result = readGraphRuntimePlan(prepareGraphRuntimePlan(admitted, overrides));
  assert.deepEqual(result, planNestedGraph(admitted, overrides));
  assert.deepEqual(result.nodes.map(n => [n.nodePath,n.initialControls]), [[[uuid(1),uuid(3)],{gain:6.125}]]);
  assert.deepEqual(result.prunedNodePaths, [[uuid(2),uuid(3)]]);
  raw.definitions[hash(3)].metadata.controls[0].default = 9;
  overrides[0]!.values.gain = 8;
  assert.equal(result.nodes[0]!.initialControls.gain, 6.125);
});

test('retains real diamond order, shared dependency, and separate same-definition paths', () => {
  const admitted = admit(diamond());
  const result = readGraphRuntimePlan(prepareGraphRuntimePlan(admitted));
  assert.deepEqual(result, planNestedGraph(admitted));
  assert.deepEqual(result.nodes.map(n => n.nodePath), [1,2,3,4].map(n => [uuid(n)]));
  assert.equal(result.nodes[1]!.definitionHash, result.nodes[2]!.definitionHash);
  assert.notEqual(result.nodes[1], result.nodes[2]);
  assert.deepEqual(result.nodes.slice(1,3).map(n => n.inputs[0]!.source), [
    {nodePath:[uuid(1)],portId:'value'}, {nodePath:[uuid(1)],portId:'value'},
  ]);
  assert.deepEqual(result.nodes.map(n => n.initialControls), [{gain:1},{gain:2},{gain:2},{}]);
});

test('rejects cloned admission and forged or cloned runtime capabilities', () => {
  const admitted = admit(basic()), token = prepareGraphRuntimePlan(admitted);
  assert.throws(() => prepareGraphRuntimePlan(structuredClone(admitted)), TypeError);
  const v1 = basicV1();
  for (const fake of [Object.freeze({}), Object.create(null), {...token}, structuredClone(token),
    JSON.parse(JSON.stringify(token)), admitted, planNestedGraph(admitted),
    planGraph(validateGraph(v1.graph,v1.definitions)), null, undefined, 1, 'plan', true, Symbol('plan')]) {
    assert.throws(() => readGraphRuntimePlan(fake as GraphRuntimePlan), TypeError);
  }
});

test('separate preparations retain detached frozen DTOs after raw mutation', () => {
  const raw = twins(), admitted = admit(raw);
  const a = prepareGraphRuntimePlan(admitted), b = prepareGraphRuntimePlan(admitted);
  assert.notEqual(a,b);
  const first = readGraphRuntimePlan(a), second = readGraphRuntimePlan(b);
  assert.notEqual(first,second);
  assert.notEqual(first.nodes,second.nodes);
  assert.notEqual(first.definitions,second.definitions);
  raw.graph.outputPort = 'b';
  raw.definitions[hash(1)].body.nodes.length = 0;
  assert.deepEqual(first, second);
  assert.deepEqual(first.finalOutput.nodePath, [uuid(1),uuid(3)]);
  frozen(first); frozen(second);
});

test('preserves existing override validation including count-first rejection', () => {
  const admitted = admit(twins());
  for (const overrides of [
    [{nodePath:[uuid(1),uuid(3)],values:{gain:11}}],
    [{nodePath:[uuid(99)],values:{gain:1}}],
    [{nodePath:[],values:{gain:2}},{nodePath:[uuid(1),uuid(3)],values:{gain:3}}],
  ]) {
    let expected: unknown;
    try { planNestedGraph(admitted, overrides as unknown as NodeControlOverride[]); } catch (error) { expected = error; }
    assert.ok(expected instanceof Error);
    assert.throws(() => prepareGraphRuntimePlan(admitted, overrides as unknown as NodeControlOverride[]),
      (error: unknown) => error instanceof Error && error.message === expected.message);
  }
  let reads = 0;
  const overlong = new Array(513);
  Object.defineProperty(overlong,'0',{get(){reads++; throw Error('getter invoked');}});
  assert.throws(() => prepareGraphRuntimePlan(admitted,overlong), /512/);
  assert.equal(reads,0);
});

test('inherits admitted depth, leaves, edges and control-target budgets without a lower cap', () => {
  for (const raw of [chain(8),leaves(512),fanout(),controlFanout()]) {
    const admitted = admit(raw);
    assert.deepEqual(readGraphRuntimePlan(prepareGraphRuntimePlan(admitted)), planNestedGraph(admitted));
  }
  assert.equal(readGraphRuntimePlan(prepareGraphRuntimePlan(admit(chain(8)))).nodes[0]!.nodePath.length,8);
  assert.equal(readGraphRuntimePlan(prepareGraphRuntimePlan(admit(leaves(512)))).prunedNodePaths.length,511);
});

function typeBoundary(dto: NestedExecutionPlan, token: GraphRuntimePlan) {
  // @ts-expect-error a detached execution DTO is not runtime authority
  const forged: GraphRuntimePlan = dto;
  // @ts-expect-error runtime authority is not a serialized execution DTO
  const raw: NestedExecutionPlan = token;
  void forged; void raw;
}
void typeBoundary;
