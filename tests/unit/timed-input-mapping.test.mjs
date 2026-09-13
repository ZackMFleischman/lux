import test from 'node:test';
import assert from 'node:assert/strict';
import * as mapping from '../../packages/inputs/src/mapping.mjs';

const uuid = n => `${n.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
const target = { sceneId: uuid(1), nodePath: [], controlId: 'height' };
const definition = { id: 'height', type: 'number', label: 'Height', default: 0, min: -10, max: 10, changeCost: 'live' };
const source = { sourceId: 'music', signalId: 'level' };
const binding = (n = 2, extra = {}) => ({ id: uuid(n), phase: 'macro', source, target, inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1, exponent: 1, invert: false, mode: 'add', enabled: true, ...extra });
const plan = (bindings = [binding()], taus = bindings.map(() => 100)) => ({ version: 2, mapping: { version: 1, targets: [{ target, definition }], bindings }, smoothing: bindings.map((row, i) => ({ bindingId: row.id, tauMs: taus[i] })) });
const frame = (value = 0, extra = {}) => ({ epoch: 0, deltaMs: 100, authority: 'studio', base: [{ target, value: 0 }], signals: [{ source, generation: 0, value }], hostValues: [], ...extra });
const evaluate = (p, f, s = mapping.createTimedMappingState(p, f.epoch)) => mapping.evaluateTimedNumericMappings(p, f, s);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
const frozen = value => { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };

test('timed API is available for explicit caller-owned state', () => {
  for (const name of ['normalizeTimedMappingPlan', 'createTimedMappingState', 'evaluateTimedNumericMappings']) assert.equal(typeof mapping[name], 'function', name);
});

test('smoothing follows independent exponential known answers and exposes contribution stages', () => {
  const p = plan(), seed = evaluate(p, frame(0));
  const first = evaluate(p, frame(1), seed.state), second = evaluate(p, frame(1), first.state);
  near(first.values[0].value, 1 - Math.exp(-1));
  near(second.values[0].value, 1 - Math.exp(-2));
  const trace = first.traces[0].bindings[0];
  assert.equal(trace.shaped, 1); near(trace.smoothed, 1 - Math.exp(-1));
  assert.equal(trace.mapped, trace.smoothed); assert.equal(trace.after, trace.smoothed);
  assert.equal(first.version, 2); frozen(first);
});

test('first sample, tau zero, and zero delta have distinct exact rules', () => {
  const p = plan(), seed = evaluate(p, frame(0));
  assert.equal(evaluate(p, frame(1, { deltaMs: 0 })).values[0].value, 1);
  assert.equal(evaluate(p, frame(1, { deltaMs: 0 }), seed.state).values[0].value, 0);
  const instant = plan([binding()], [0]);
  assert.equal(evaluate(instant, frame(1, { deltaMs: 0 }), evaluate(instant, frame(0)).state).values[0].value, 1);
});

test('same source has separate curved contributions and time constants for each binding', () => {
  const p = plan([binding(), binding(3, { exponent: 2 })], [100, 200]);
  const result = evaluate(p, frame(0.5), evaluate(p, frame(0)).state);
  const expected = [0.5 * (1 - Math.exp(-1)), 0.25 * (1 - Math.exp(-0.5))];
  result.traces[0].bindings.forEach((row, i) => near(row.smoothed, expected[i]));
  near(result.values[0].value, expected[0] + expected[1]);
});

test('held-input partitions agree at each piecewise change boundary and replay is detached', () => {
  const p = plan(); let whole = evaluate(p, frame(0)).state, split = whole;
  for (const value of [1, 0.25, 0.75]) {
    const result = evaluate(p, frame(value), whole); whole = result.state;
    split = evaluate(p, frame(value, { deltaMs: 50 }), split).state;
    split = evaluate(p, frame(value, { deltaMs: 50 }), split).state;
    near(whole.bindings[0].value, split.bindings[0].value);
    const repeat = evaluate(p, frame(value), whole), again = evaluate(p, frame(value), whole);
    assert.deepEqual(repeat, again); assert.notEqual(repeat, again); assert.notEqual(repeat.state, whole);
  }
});

test('equal normalized plans reuse history while plan, epoch and generation changes reset it', () => {
  const p = plan([binding(), binding(3)], [100, 200]), seed = evaluate(p, frame(0)).state;
  const reordered = structuredClone(p); reordered.smoothing.reverse();
  assert.equal(mapping.createTimedMappingState(reordered, 0).planKey, seed.planKey);
  assert.ok(evaluate(reordered, frame(1), seed).values[0].value < 2);
  const changed = structuredClone(p); changed.mapping.targets[0].definition.label = 'Changed';
  assert.equal(evaluate(changed, frame(1), seed).values[0].value, 2);
  assert.equal(evaluate(p, frame(1, { epoch: 1 }), seed).values[0].value, 2);
  assert.equal(evaluate(p, frame(1, { signals: [{ source, generation: 1, value: 1 }] }), seed).values[0].value, 2);
});

test('disabled, absent and host-owned bindings clear history and trace null contributions', () => {
  const p = plan(), seed = evaluate(p, frame(0)).state;
  const disabled = structuredClone(p); disabled.mapping.bindings[0].enabled = false;
  for (const [candidate, f, status] of [
    [disabled, frame(1), 'disabled'], [p, frame(1, { signals: [] }), 'unresolved-source'],
    [p, frame(1, { authority: 'host', hostValues: [{ target, value: 0.25 }] }), 'host-owned'],
  ]) {
    const result = evaluate(candidate, f, seed), trace = result.traces[0].bindings[0];
    assert.equal(trace.status, status); assert.equal(trace.shaped, null); assert.equal(trace.smoothed, null); assert.equal(trace.mapped, null);
    assert.deepEqual(result.state.bindings, []);
    assert.equal(evaluate(p, frame(1), result.state).values[0].value, 1);
  }
});

test('state order follows binding order although macro evaluation precedes modulation', () => {
  const p = plan([binding(3, { phase: 'modulation', mode: 'multiply', outputMin: 0.5, outputMax: 0.5 }), binding(2, { outputMin: 20, outputMax: 20 })], [0, 0]);
  const result = evaluate(p, frame());
  assert.deepEqual(result.state.bindings.map(row => row.bindingId), [uuid(3), uuid(2)]);
  assert.deepEqual(result.traces[0].bindings.map(row => row.bindingId), [uuid(2), uuid(3)]);
  assert.equal(result.traces[0].afterMacros, 20); assert.equal(result.values[0].value, 10); assert.equal(result.traces[0].clamped, false);
});

test('tau-zero timed evaluation preserves v1 values and every original trace field', () => {
  for (const mode of ['replace', 'add', 'multiply']) for (const invert of [false, true]) {
    const p = plan([binding(2, { exponent: 2, mode, invert })], [0]), f = frame(0.3);
    const legacy = mapping.evaluateNumericMappings(p.mapping, { authority: f.authority, base: f.base, hostValues: f.hostValues, signals: f.signals.map(({ source, value }) => ({ source, value })) });
    const timed = evaluate(p, f);
    assert.deepEqual(timed.values, legacy.values);
    assert.deepEqual(timed.traces.map(row => ({ ...row, bindings: row.bindings.map(({ shaped, smoothed, ...rest }) => rest) })), legacy.traces);
    assert.ok(!Object.hasOwn(legacy.traces[0].bindings[0], 'smoothed'));
  }
});

test('host ownership bypasses overflowing Studio shaping', () => {
  const p = plan([binding(2, { inputMin: -Number.MAX_VALUE, inputMax: 0 })]);
  const result = evaluate(p, frame(Number.MAX_VALUE, { authority: 'host', hostValues: [{ target, value: 0.5 }] }));
  assert.equal(result.values[0].value, 0.5); assert.deepEqual(result.state.bindings, []);
});

test('host subset and source-generation changes reset only their affected bindings', () => {
  const internal = { ...target, nodePath: [uuid(8)] }, otherSource = { sourceId: 'other', signalId: 'level' };
  const p = plan([binding(), binding(3, { target: internal, source: otherSource })]);
  p.mapping.targets.push({ target: internal, definition });
  const f = frame(0, { base: [{ target, value: 0 }, { target: internal, value: 0 }], signals: [{ source, generation: 0, value: 0 }, { source: otherSource, generation: 0, value: 0 }] });
  const seed = evaluate(p, f).state;
  f.signals.forEach(row => { row.value = 1; });
  f.authority = 'host'; f.hostValues = [{ target, value: 0.25 }];
  const owned = evaluate(p, f, seed);
  assert.deepEqual(owned.state.bindings.map(row => row.bindingId), [uuid(3)]);
  near(owned.values[1].value, 1 - Math.exp(-1));
  f.authority = 'studio'; f.hostValues = [];
  const released = evaluate(p, f, owned.state);
  assert.equal(released.values[0].value, 1); near(released.values[1].value, 1 - Math.exp(-2));
  f.signals[0].generation = 1;
  const changed = evaluate(p, f, seed);
  assert.equal(changed.values[0].value, 1); near(changed.values[1].value, 1 - Math.exp(-1));
});

test('normalized plans and successful evaluations detach caller-owned data', () => {
  const p = plan(), f = frame(0.5), before = structuredClone({ p, f });
  const normalized = mapping.normalizeTimedMappingPlan(p), result = evaluate(p, f);
  assert.deepEqual({ p, f }, before); frozen(normalized); frozen(result);
  p.mapping.bindings[0].outputMax = 2; f.signals[0].value = 1;
  assert.equal(normalized.mapping.bindings[0].outputMax, 1);
  assert.equal(result.state.bindings[0].value, 0.5);
  assert.equal(result.state.planKey, JSON.stringify(normalized));
});

test('zero delta retains finite opposite-extreme history without unused subtraction', () => {
  const p = plan([binding(2, { mode: 'replace', outputMin: Number.MAX_VALUE, outputMax: Number.MAX_VALUE })], [Number.MIN_VALUE]);
  const state = { ...mapping.createTimedMappingState(p, 0), bindings: [{ bindingId: uuid(2), sourceGeneration: 0, value: -Number.MAX_VALUE }] };
  const result = evaluate(p, frame(1, { deltaMs: 0 }), state);
  assert.equal(result.state.bindings[0].value, -Number.MAX_VALUE);
  assert.equal(result.values[0].value, -10);
});
