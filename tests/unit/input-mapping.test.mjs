import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNumericMappingPlan, evaluateNumericMappings } from '../../packages/inputs/src/mapping.mjs';

const uuid = n => `${n.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
const target = { sceneId: uuid(1), nodePath: [], controlId: 'height' };
const definition = { id: 'height', type: 'number', label: 'Height', default: 2, min: 0, max: 10, changeCost: 'live', step: 1 };
const source = { sourceId: 'music', signalId: 'level' };
const binding = (n, extra = {}) => ({ id: uuid(n), phase: 'macro', source, target, inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 2, exponent: 1, invert: false, mode: 'add', enabled: true, ...extra });
const plan = (bindings = [], targets = [{ target, definition }]) => ({ version: 1, targets, bindings });
const frame = (extra = {}) => ({ authority: 'studio', base: [{ target, value: 2 }], signals: [{ source, value: 0.5 }], hostValues: [], ...extra });
const run = (bindings, f = frame(), targets) => evaluateNumericMappings(normalizeNumericMappingPlan(plan(bindings, targets)), f);

test('macro phase precedes modulation and UI step does not quantize', () => {
  const result = run([binding(3, { phase: 'modulation', mode: 'multiply', outputMin: 1 }), binding(2)]);
  assert.equal(result.values[0].value, 4.5);
  assert.deepEqual(result.traces[0], { target, authority: 'studio', base: 2, afterMacros: 3, beforeClamp: 4.5, effective: 4.5, clamped: false,
    bindings: [ { bindingId: uuid(2), phase: 'macro', status: 'applied', before: 2, mapped: 1, after: 3 }, { bindingId: uuid(3), phase: 'modulation', status: 'applied', before: 3, mapped: 1.5, after: 4.5 } ] });
});

test('same-phase array order is preserved rather than sorted by ID', () => {
  const replace = binding(9, { mode: 'replace', outputMin: 4, outputMax: 4 });
  const add = binding(2, { outputMin: 2, outputMax: 2 });
  assert.equal(run([replace, add]).values[0].value, 6);
  assert.equal(run([add, replace]).values[0].value, 4);
});

test('clamp happens once after both phases', () => {
  const targets = [{ target, definition: { ...definition, max: 5 } }];
  const add = binding(2, { outputMin: 3, outputMax: 3 });
  const multiply = binding(3, { phase: 'modulation', mode: 'multiply', outputMin: 0.5, outputMax: 0.5 });
  assert.equal(run([add, multiply], frame({ base: [{ target, value: 4 }] }), targets).values[0].value, 3.5);
  const result = run([add], frame({ base: [{ target, value: 4 }] }), targets);
  assert.equal(result.values[0].value, 5);
  assert.equal(result.traces[0].beforeClamp, 7);
  assert.equal(result.traces[0].clamped, true);
});

for (const [name, sample, changes, expected] of [
  ['power curve', 1, { inputMax: 2, outputMax: 8, exponent: 2 }, 2],
  ['invert before shaping', 0.5, { inputMax: 2, outputMax: 8, exponent: 2, invert: true }, 4.5],
  ['low saturation', -20, {}, 0], ['high saturation', 20, {}, 2],
  ['constant output', 0.3, { outputMin: 3, outputMax: 3 }, 3],
]) test(name, () => assert.equal(run([binding(2, { mode: 'replace', ...changes })], frame({ signals: [{ source, value: sample }] })).values[0].value, expected));

test('unresolved and disabled bindings preserve base with distinct traces', () => {
  const result = run([binding(2), binding(3, { enabled: false })], frame({ signals: [] }));
  assert.equal(result.values[0].value, 2);
  assert.deepEqual(result.traces[0].bindings.map(({ status, mapped, before, after }) => ({ status, mapped, before, after })), [
    { status: 'unresolved-source', mapped: null, before: 2, after: 2 }, { status: 'disabled', mapped: null, before: 2, after: 2 },
  ]);
});

test('host subset bypasses all its bindings while explicit internal targets evaluate', () => {
  const internal = { ...target, nodePath: [uuid(8)] };
  const result = run([binding(2), binding(3, { target: internal })], frame({ authority: 'host', base: [{ target, value: 2 }, { target: internal, value: 4 }], hostValues: [{ target, value: 0.25 }] }), [{ target, definition }, { target: internal, definition }]);
  assert.deepEqual(result.values.map(x => x.value), [0.25, 5]);
  assert.deepEqual(result.traces[0], { target, authority: 'host', base: 2, afterMacros: 0.25, beforeClamp: 0.25, effective: 0.25, clamped: false, bindings: [{ bindingId: uuid(2), phase: 'macro', status: 'host-owned', mapped: null, before: 0.25, after: 0.25 }] });
  assert.equal(result.traces[1].authority, 'studio');
  assert.equal(run([binding(2, { enabled: false })], frame({ authority: 'host', signals: [], hostValues: [{ target, value: 0.25 }] })).values[0].value, 0.25);
});

test('structured scene and node identities remain independent regardless of label', () => {
  const addresses = [target, { ...target, nodePath: [uuid(2)] }, { ...target, nodePath: [uuid(3)] }, { ...target, sceneId: uuid(9), nodePath: [uuid(2)] }];
  const targets = addresses.map((target, i) => ({ target, definition: { ...definition, label: `Renamed ${i}` } }));
  const result = run([], frame({ base: addresses.map((target, i) => ({ target, value: i })), signals: [] }), targets);
  assert.deepEqual(result.values, addresses.map((target, i) => ({ target, value: i })));
});

test('empty catalogue adds no implicit controls and all output is detached and frozen', () => {
  const empty = evaluateNumericMappings(plan([], []), { authority: 'studio', base: [], signals: [], hostValues: [] });
  assert.deepEqual(empty, { version: 1, values: [], traces: [] });
  assert.ok(Object.isFrozen(empty.values));
  const raw = structuredClone(plan([binding(2)]));
  const normalized = normalizeNumericMappingPlan(raw), f = frame();
  const result = evaluateNumericMappings(normalized, f);
  raw.targets[0].target.nodePath.push(uuid(7)); raw.bindings[0].outputMax = 100;
  f.base[0].value = 8;
  assert.equal(result.values[0].value, 3);
  assert.deepEqual(normalized.targets[0].target.nodePath, []);
  for (const value of [normalized, normalized.targets, normalized.bindings[0].source, normalized.targets[0].definition, result, result.values[0], result.traces[0].bindings[0], result.values[0].target.nodePath]) assert.ok(Object.isFrozen(value));
});

test('negative zero is normalized in base, source arithmetic and results', () => {
  const result = run([binding(2, { mode: 'multiply', outputMin: -0, outputMax: -0 })], frame({ base: [{ target, value: -0 }] }));
  assert.equal(Object.is(result.values[0].value, -0), false);
  assert.equal(Object.is(result.traces[0].base, -0), false);
  assert.equal(Object.is(result.traces[0].bindings[0].mapped, -0), false);
});
