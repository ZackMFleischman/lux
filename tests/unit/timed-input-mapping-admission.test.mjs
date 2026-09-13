import test from 'node:test';
import assert from 'node:assert/strict';
import * as mapping from '../../packages/inputs/src/mapping.mjs';

const uuid = n => `${n.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
const target = { sceneId: uuid(1), nodePath: [], controlId: 'x' };
const definition = { id: 'x', type: 'number', label: 'X', default: 0, min: -10, max: 10, changeCost: 'live' };
const source = { sourceId: 'music', signalId: 'level' };
const binding = { id: uuid(2), phase: 'macro', source, target, inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1, exponent: 1, invert: false, mode: 'replace', enabled: true };
const makePlan = () => structuredClone({ version: 2, mapping: { version: 1, targets: [{ target, definition }], bindings: [binding] }, smoothing: [{ bindingId: uuid(2), tauMs: 100 }] });
const makeFrame = () => structuredClone({ epoch: 0, deltaMs: 100, authority: 'studio', base: [{ target, value: 0 }], signals: [{ source, generation: 0, value: 1 }], hostValues: [] });
const invalid = fn => assert.throws(fn, error => error.code === 'INVALID_INPUT_MAPPING' && typeof error.path === 'string' && error.path.length <= 200);
const run = (p, f = makeFrame(), state = mapping.createTimedMappingState(p, 0)) => mapping.evaluateTimedNumericMappings(p, f, state);

test('timed admission rejects unsupported shapes and missing, duplicate or extra smoothing identities', () => {
  for (const mutate of [p => { p.version = 1; }, p => { p.extra = true; }, p => { p.smoothing = []; }, p => { p.smoothing.push(p.smoothing[0]); }, p => { p.smoothing[0].bindingId = uuid(3); }, p => { p.smoothing[0].extra = 1; }]) {
    const p = makePlan(); mutate(p); invalid(() => mapping.normalizeTimedMappingPlan(p));
  }
});

test('tau, delta, epoch and generation reject invalid numeric boundaries', () => {
  for (const value of [-1, 60000.01, NaN, Infinity, '100']) {
    const p = makePlan(); p.smoothing[0].tauMs = value; invalid(() => mapping.normalizeTimedMappingPlan(p));
    const f = makeFrame(); f.deltaMs = value; invalid(() => run(makePlan(), f));
  }
  for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '0']) {
    const f = makeFrame(); f.epoch = value; invalid(() => run(makePlan(), f));
    const g = makeFrame(); g.signals[0].generation = value; invalid(() => run(makePlan(), g));
    invalid(() => mapping.createTimedMappingState(makePlan(), value));
  }
  const p = makePlan(); p.smoothing[0].tauMs = 60000;
  const f = makeFrame(); f.deltaMs = 60000; f.epoch = Number.MAX_SAFE_INTEGER; f.signals[0].generation = Number.MAX_SAFE_INTEGER;
  assert.equal(run(p, f).state.epoch, Number.MAX_SAFE_INTEGER);
  p.smoothing[0].tauMs = -0; f.epoch = -0; f.deltaMs = -0; f.signals[0].generation = -0;
  assert.ok(!Object.is(mapping.normalizeTimedMappingPlan(p).smoothing[0].tauMs, -0));
  assert.ok(!Object.is(run(p, f).state.epoch, -0));
});

test('all three envelopes reject accessors and exotic or sparse data without executing getters', () => {
  let called = 0;
  const p = makePlan(), f = makeFrame(), s = mapping.createTimedMappingState(p, 0);
  for (const slot of ['plan', 'frame', 'state']) for (const mutate of [
    value => Object.defineProperty(value, 'extra', { enumerable: true, get() { called++; return 0; } }),
    value => { value[Symbol('extra')] = 0; }, value => Object.setPrototypeOf(value, { alien: true }),
  ]) {
    const args = structuredClone([p, f, s]); mutate(args[['plan', 'frame', 'state'].indexOf(slot)]);
    invalid(() => mapping.evaluateTimedNumericMappings(...args));
  }
  for (const mutate of [
    p => { p.smoothing.length = 2; },
    p => Object.defineProperty(p.smoothing, '0', { enumerable: true, get() { called++; return {}; } }),
    p => { p.mapping.targets[0].target.nodePath = new Uint8Array(1); },
  ]) { const raw = makePlan(); mutate(raw); invalid(() => mapping.normalizeTimedMappingPlan(raw)); }
  assert.equal(called, 0);
});

test('state admission rejects malformed data before identity reset and unknown IDs only under matching identity', () => {
  const p = makePlan(), valid = mapping.createTimedMappingState(p, 0);
  for (const mutate of [
    s => { s.version = 1; }, s => { s.epoch = -1; }, s => { s.planKey = 1; }, s => { s.extra = 0; },
    s => { s.bindings = [{ bindingId: uuid(2), sourceGeneration: -1, value: 0 }]; },
    s => { s.bindings = [{ bindingId: uuid(2), sourceGeneration: 0, value: Infinity }]; },
    s => { s.bindings = Array(2).fill({ bindingId: uuid(2), sourceGeneration: 0, value: 0 }); },
  ]) {
    for (const planKey of [valid.planKey, 'mismatch']) {
      const s = { ...structuredClone(valid), planKey }; mutate(s); invalid(() => run(p, makeFrame(), s));
    }
  }
  const unknown = { ...valid, bindings: [{ bindingId: uuid(99), sourceGeneration: 0, value: 0 }] };
  invalid(() => run(p, makeFrame(), unknown));
  assert.equal(run(p, makeFrame(), { ...unknown, planKey: 'mismatch' }).values[0].value, 1);
  assert.equal(run(p, { ...makeFrame(), epoch: 1 }, unknown).values[0].value, 1);
});

test('frame shares complete base, host subset and unique signal admission', () => {
  for (const mutate of [f => { f.base = []; }, f => { f.base.push(f.base[0]); }, f => { f.signals.push(f.signals[0]); }, f => { f.signals[0].extra = 1; }, f => { f.hostValues = f.base; }, f => { f.base[0].value = 11; }, f => { f.extra = 1; }]) {
    const f = makeFrame(); mutate(f); invalid(() => run(makePlan(), f));
  }
});

test('finite smoothing operands that overflow ratio or difference fail atomically', () => {
  for (const tiny of [true, false]) {
    const p = makePlan(), f = makeFrame();
    p.smoothing[0].tauMs = tiny ? Number.MIN_VALUE : 100;
    if (!tiny) Object.assign(p.mapping.bindings[0], { outputMin: Number.MAX_VALUE, outputMax: Number.MAX_VALUE });
    const s = { ...mapping.createTimedMappingState(p, 0), bindings: [{ bindingId: uuid(2), sourceGeneration: 0, value: tiny ? 0 : -Number.MAX_VALUE }] };
    f.deltaMs = 60000;
    const before = structuredClone({ p, f, s }); invalid(() => run(p, f, s)); assert.deepEqual({ p, f, s }, before);
    // The first-sample branch must not compute an unused overflowing ratio.
    assert.equal(run(p, f).state.bindings.length, 1);
  }
});

test('failure after an earlier contribution returns no partial state and preserves caller snapshots', () => {
  const p = makePlan(), f = makeFrame();
  p.mapping.bindings.push({ ...binding, id: uuid(3), outputMin: Number.MAX_VALUE, outputMax: Number.MAX_VALUE, mode: 'multiply' });
  p.mapping.bindings[0].outputMin = 2; p.mapping.bindings[0].outputMax = 2;
  p.smoothing.push({ bindingId: uuid(3), tauMs: 0 });
  const s = mapping.createTimedMappingState(p, 0), before = structuredClone({ p, f, s });
  invalid(() => run(p, f, s)); assert.deepEqual({ p, f, s }, before);
});

test('timed plan charges raw UTF-8 bytes exactly before normalization trims labels', () => {
  const p = makePlan(), limit = 262144;
  p.mapping.targets[0].definition.label = '\u3000'.repeat(100) + 'X';
  p.mapping.targets[0].definition.label = ' '.repeat(limit - Buffer.byteLength(JSON.stringify(p))) + p.mapping.targets[0].definition.label;
  assert.equal(Buffer.byteLength(JSON.stringify(p)), limit);
  assert.equal(mapping.normalizeTimedMappingPlan(p).mapping.targets[0].definition.label, 'X');
  p.mapping.targets[0].definition.label = ' ' + p.mapping.targets[0].definition.label;
  invalid(() => mapping.normalizeTimedMappingPlan(p));
  assert.equal(mapping.normalizeNumericMappingPlan(p.mapping).version, 1);
});

test('state has exact separate encoded byte and unescaped plan-key byte limits', () => {
  const p = makePlan(), s = { version: 2, planKey: '', epoch: 0, bindings: [] };
  const overhead = Buffer.byteLength(JSON.stringify(s));
  // Escaped quotes charge two raw bytes each without exceeding key's 256-KiB value budget.
  s.planKey = '"'.repeat(Math.floor((524288 - overhead) / 2)) + 'a'.repeat((524288 - overhead) % 2);
  assert.equal(Buffer.byteLength(JSON.stringify(s)), 524288); assert.ok(Buffer.byteLength(s.planKey) <= 262144);
  assert.equal(run(p, makeFrame(), s).values[0].value, 1);
  s.planKey += 'a'; invalid(() => run(p, makeFrame(), s));
  s.planKey = 'a'.repeat(262144); assert.equal(run(p, makeFrame(), s).values[0].value, 1);
  s.planKey += 'a'; invalid(() => run(p, makeFrame(), s));
  s.planKey = '\u3000'.repeat(87382); invalid(() => run(p, makeFrame(), s));
});

test('timed frame enforces its own exact raw UTF-8 limit with valid full base and host data', () => {
  const targets = Array.from({ length: 256 }, (_, i) => ({ target: { ...target, sceneId: uuid(i + 1), nodePath: Array(8).fill(uuid(500)), controlId: 'x'.repeat(64) }, definition: { ...definition, id: 'x'.repeat(64) } }));
  const p = { version: 2, mapping: { version: 1, targets, bindings: [] }, smoothing: [] };
  const values = targets.map(({ target }) => ({ target, value: 0 }));
  const f = { epoch: 0, deltaMs: 0, authority: 'host', base: values, hostValues: values, signals: Array.from({ length: 256 }, (_, i) => ({ source: { sourceId: `s${i}`, signalId: 'x' }, generation: 0, value: 0 })) };
  let remaining = 262144 - Buffer.byteLength(JSON.stringify(f));
  assert.ok(remaining >= 0);
  for (const row of f.signals) for (const key of ['sourceId', 'signalId']) {
    const extra = Math.min(remaining, 64 - row.source[key].length);
    row.source[key] += 'a'.repeat(extra); remaining -= extra;
  }
  assert.equal(remaining, 0); assert.equal(Buffer.byteLength(JSON.stringify(f)), 262144);
  assert.equal(run(p, f).values.length, 256);
  const expandable = f.signals.find(row => row.source.signalId.length < 64);
  assert.ok(expandable); expandable.source.signalId += 'a';
  invalid(() => run(p, f));
});

test('timed mapping retains v1 count/depth limits and bounds all 256 state identities', () => {
  const p = makePlan();
  p.mapping.bindings = Array.from({ length: 256 }, (_, i) => ({ ...binding, id: uuid(i + 1), source: { sourceId: `s${i}`, signalId: 'x' } }));
  p.smoothing = p.mapping.bindings.map(row => ({ bindingId: row.id, tauMs: 100 }));
  const f = makeFrame(); f.signals = p.mapping.bindings.map(({ source }) => ({ source, generation: 0, value: 0 }));
  const s = run(p, f).state;
  assert.equal(s.bindings.length, 256); assert.equal(run(p, f, s).state.bindings.length, 256);
  const extraState = structuredClone(s); extraState.bindings.push({ bindingId: uuid(1000), sourceGeneration: 0, value: 0 });
  invalid(() => run(p, f, extraState));
  const extraPlan = structuredClone(p); extraPlan.mapping.bindings.push({ ...binding, id: uuid(1000) });
  invalid(() => mapping.normalizeTimedMappingPlan(extraPlan));
  const extraFrame = structuredClone(f); extraFrame.signals.push({ source, generation: 0, value: 0 }); invalid(() => run(p, extraFrame));
  const union = structuredClone(f); union.signals[0].source.sourceId = 'different'; invalid(() => run(p, union));
  const deep = makePlan(); deep.mapping.targets[0].target.nodePath = Array(8).fill(uuid(9)); deep.mapping.bindings[0].target = deep.mapping.targets[0].target;
  assert.equal(mapping.normalizeTimedMappingPlan(deep).mapping.targets[0].target.nodePath.length, 8);
  deep.mapping.targets[0].target.nodePath.push(uuid(9)); invalid(() => mapping.normalizeTimedMappingPlan(deep));
});
