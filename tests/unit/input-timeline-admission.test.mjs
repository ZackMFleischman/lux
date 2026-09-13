import test from 'node:test';
import assert from 'node:assert/strict';
import * as timeline from '../../packages/inputs/src/timeline.mjs';

const source = { sourceId: 'a', signalId: 'note' };
const authority = { sourceId: 'a', generation: 0, connected: true, calibrationId: 'cal0' };
const definition = () => ({ version: 1, sources: [{ ...authority }], signals: [{ source: { ...source }, kind: 'event' }] });
const event = (sequence = 0, extra = {}) => ({ version: 1, epoch: 0, source: { ...source }, generation: 0, calibrationId: 'cal0', sequence, timestampMs: 0, kind: 'event', payload: { type: 'note', values: [60, 0.5] }, ...extra });
const initial = () => timeline.createLiveInputState(definition(), 0, 0);
const clone = structuredClone;
const invalid = fn => assert.throws(fn, error => error.code === 'INVALID_INPUT_TIMELINE' && typeof error.path === 'string' && error.path.length <= 200 && error.message.length < 400);
const admit = envelopes => timeline.admitLiveInputs(initial(), 0, envelopes);
const step = extra => ({ timeMs: 0, authority: 'studio', base: [], hostValues: [], ...extra });

test('all rejection reasons use exact precedence with identity failures leaving watermarks unchanged', () => {
  const cases = [
    ['epoch', { epoch: 1, source: { sourceId: 'unknown', signalId: 'missing' } }],
    ['unknown-source', { source: { sourceId: 'unknown', signalId: 'missing' } }],
    ['unknown-signal', { source: { sourceId: 'a', signalId: 'missing' }, generation: 1 }],
    ['generation', { generation: 1, calibrationId: 'wrong' }],
    ['calibration', { calibrationId: 'wrong' }],
    ['future', { timestampMs: 1 }],
  ];
  for (const [reason, extra] of cases) {
    const result = admit([event(0, extra)]);
    assert.equal(result.decisions[0].rejected.reason, reason);
    assert.equal(result.state.counters.rejected[reason], 1);
    assert.equal(result.state.sources[0].sequence, null); assert.equal(result.state.nextIngress, 0);
  }
  const kind = event(); delete kind.payload; Object.assign(kind, { kind: 'continuous', value: 1, generation: 1 });
  assert.equal(admit([kind]).decisions[0].rejected.reason, 'kind');
  const disconnected = timeline.changeLiveInputSources(initial(), [{ ...authority, generation: 1, connected: false }]).state;
  assert.equal(timeline.admitLiveInputs(disconnected, 0, [event(0, { generation: 1, calibrationId: 'wrong' })]).decisions[0].rejected.reason, 'disconnected');
});

test('every argument boundary rejects own accessors without invoking getters', () => {
  let hits = 0;
  const hostile = () => Object.defineProperty({}, 'version', { enumerable: true, get() { hits++; return 1; } });
  for (const call of [
    () => timeline.createLiveInputState(hostile(), 0, 0),
    () => timeline.normalizeLiveInputState(hostile()),
    () => timeline.admitLiveInputs(initial(), 0, [event(), hostile()]),
    () => timeline.changeLiveInputSources(initial(), [hostile()]),
    () => timeline.stepLiveInputs(initial(), hostile()),
    () => timeline.resetLiveInputs(initial(), hostile(), 1, 0),
  ]) invalid(call);
  assert.equal(hits, 0);
  const state = initial(), before = clone(state), batch = [event(), hostile()];
  invalid(() => timeline.admitLiveInputs(state, 0, batch)); assert.deepEqual(state, before); assert.equal(hits, 0);
});

test('descriptor pass rejects symbols, nonenumerable extras, exotic arrays/records and cycles', () => {
  const variants = [];
  const symbol = event(); symbol[Symbol('x')] = 1; variants.push(symbol);
  const hidden = event(); Object.defineProperty(hidden, 'x', { value: 1 }); variants.push(hidden);
  const sparse = event(); sparse.payload.values = Array(2); variants.push(sparse);
  const arrayExtra = event(); arrayExtra.payload.values.extra = 1; variants.push(arrayExtra);
  const cyclic = event(); cyclic.payload.values = [cyclic]; variants.push(cyclic);
  const exotic = event(); Object.setPrototypeOf(exotic, { extra: true }); variants.push(exotic);
  const subclass = event(); subclass.payload.values = new (class extends Array {})(1); variants.push(subclass);
  for (const value of variants) invalid(() => admit([value]));
  for (const value of [undefined, null, () => 1, 1n, new Date(), new Map()]) invalid(() => admit([value]));
  const plain = event(); Object.setPrototypeOf(plain, null);
  assert.equal(admit([plain]).decisions[0].status, 'accepted');
});

test('schema rejects missing/unknown members, unsafe numbers and mismatched union shapes', () => {
  for (const patch of [{ version: 2 }, { epoch: -1 }, { generation: 0.5 }, { sequence: Number.MAX_SAFE_INTEGER + 1 }, { timestampMs: -1 }, { timestampMs: Infinity }, { payload: { type: 'note', values: [NaN] } }, { payload: { type: 'constructor', values: [] } }, { value: 1 }, { extra: true }, { kind: 'other' }, { source: { sourceId: 'A', signalId: 'note' } }]) invalid(() => admit([event(0, patch)]));
  for (const key of Object.keys(event())) { const missing = event(); delete missing[key]; invalid(() => admit([missing])); }
  for (const number of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '0']) {
    invalid(() => timeline.createLiveInputState(definition(), number, 0));
    invalid(() => timeline.createLiveInputState(definition(), 0, number));
    invalid(() => timeline.admitLiveInputs(initial(), number, []));
    invalid(() => timeline.stepLiveInputs(initial(), step({ timeMs: number })));
    invalid(() => timeline.resetLiveInputs(initial(), definition(), 1, number));
  }
  assert.equal(Object.is(timeline.createLiveInputState(definition(), -0, -0).epoch, -0), false);
  assert.equal(admit([event(Number.MAX_SAFE_INTEGER)]).state.sources[0].sequence, Number.MAX_SAFE_INTEGER);
});

test('source/signal/batch/payload capacities accept equality and reject one over', () => {
  const d = definition(); d.sources = Array.from({ length: 64 }, (_, i) => ({ ...authority, sourceId: `s${i}` })); d.signals = [];
  assert.equal(timeline.createLiveInputState(d, 0, 0).sources.length, 64);
  d.sources.push({ ...authority, sourceId: 'extra' }); invalid(() => timeline.createLiveInputState(d, 0, 0));
  const signals = definition(); signals.signals = Array.from({ length: 256 }, (_, i) => ({ source: { sourceId: 'a', signalId: `n${i}` }, kind: 'event' }));
  assert.equal(timeline.createLiveInputState(signals, 0, 0).signals.length, 256);
  signals.signals.push({ source, kind: 'event' }); invalid(() => timeline.createLiveInputState(signals, 0, 0));
  assert.equal(admit(Array.from({ length: 256 }, (_, i) => event(i))).state.events.length, 256);
  invalid(() => admit(Array.from({ length: 257 }, (_, i) => event(i))));
  assert.equal(admit([event(0, { payload: { type: 'note', values: Array(16).fill(1) } })]).decisions[0].status, 'accepted');
  invalid(() => admit([event(0, { payload: { type: 'note', values: Array(17).fill(1) } })]));
});

test('byte, depth and own-field quotas reject before visiting offending descendants', () => {
  let visited = 0;
  const poison = new Proxy({}, { getPrototypeOf() { visited++; throw new Error('visited'); } });
  const fields = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, poison]));
  invalid(() => timeline.normalizeLiveInputState(fields)); assert.equal(visited, 0);
  const reasonFields = clone(initial());
  reasonFields.counters.rejected.extra = poison;
  invalid(() => timeline.normalizeLiveInputState(reasonFields)); assert.equal(visited, 0);
  const deep = { x: poison }; let nested = deep;
  for (let i = 0; i < 9; i++) nested = { x: nested };
  invalid(() => timeline.normalizeLiveInputState(nested)); assert.equal(visited, 0);
  const oversized = { a: '\\'.repeat(131072), b: poison };
  invalid(() => timeline.createLiveInputState(oversized, 0, 0)); assert.equal(visited, 0);
  invalid(() => timeline.normalizeLiveInputState({ a: 'x'.repeat(262145), b: poison })); assert.equal(visited, 0);
  const stateBytes = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, '\\'.repeat(131072)]));
  stateBytes.z = poison; invalid(() => timeline.normalizeLiveInputState(stateBytes)); assert.equal(visited, 0);
  // Valid schemas hit ID/count/payload limits before state/result byte ceilings;
  // arbitrary extra data exercises byte charging but is never admitted state.
});

test('UTF-8 budgets count JSON keys, quotes and escapes at exact input/state boundaries', () => {
  const inputAt = { a: 'x'.repeat(262136) };
  assert.equal(Buffer.byteLength(JSON.stringify(inputAt)), 262144);
  assert.throws(() => timeline.createLiveInputState(inputAt, 0, 0), error => error.code === 'INVALID_INPUT_TIMELINE' && error.path === 'definition');
  assert.throws(() => timeline.createLiveInputState({ a: `${inputAt.a}x` }, 0, 0), error => error.code === 'INVALID_INPUT_TIMELINE' && error.path === 'definition.a');
  const escapedAt = { a: '\\'.repeat(131068) };
  assert.equal(Buffer.byteLength(JSON.stringify(escapedAt)), 262144);
  assert.throws(() => timeline.createLiveInputState(escapedAt, 0, 0), error => error.path === 'definition');
  assert.throws(() => timeline.createLiveInputState({ a: `${escapedAt.a}é` }, 0, 0), error => error.path === 'definition.a');
  const stateAt = { a: 'x'.repeat(262136), b: 'x'.repeat(262136), c: 'x'.repeat(262136), d: 'x'.repeat(262139) };
  assert.equal(Buffer.byteLength(JSON.stringify(stateAt)), 1048576);
  assert.throws(() => timeline.normalizeLiveInputState(stateAt), error => error.path === 'state');
  stateAt.d += 'x';
  assert.throws(() => timeline.normalizeLiveInputState(stateAt), error => error.path === 'state.d');
  // At equality capture succeeds and exact-schema rejection occurs at the root;
  // one additional UTF-8 byte fails capture at the value. These are hostile DTOs.
});

test('normalizer enforces exact cursor, retention, order and accounting invariants', () => {
  const base = timeline.admitLiveInputs(initial(), 10, [event(0), event(1, { timestampMs: 1 })]).state;
  const changes = [
    s => { s.sources[0].sequence = null; }, s => { s.sources[0].timestampMs = 11; },
    s => { s.sources[0].sequence = 0; }, s => { s.sources[0].authority.connected = false; },
    s => { s.sources.push(clone(s.sources[0])); }, s => { s.signals.push(clone(s.signals[0])); },
    s => { s.signals[0].source.sourceId = 'absent'; }, s => { s.events.reverse(); },
    s => { s.events[1].ingress = 0; }, s => { s.events[1].envelope.sequence = 0; },
    s => { s.events[0].receivedAtMs = 11; }, s => { s.events[1].receivedAtMs = 0; },
    s => { s.events[0].envelope.epoch = 1; }, s => { s.events[0].envelope.generation = 1; },
    s => { s.events[0].envelope.calibrationId = 'wrong'; }, s => { s.events[0].envelope.source.signalId = 'missing'; },
    s => { s.events[0].ingress = s.nextIngress; }, s => { s.counters.received++; },
    s => { s.counters.consumedEvents++; }, s => { s.counters.expiredContinuous++; },
    s => { s.lastStepMs = 1; }, s => { s.startMs = 1; },
    s => { s.counters.rejected.extra = 0; }, s => { s.counters.received = Number.MAX_SAFE_INTEGER + 1; },
    s => { s.continuous.push(s.events.pop()); }, s => { s.sources[0].extra = true; },
  ];
  for (const change of changes) { const raw = clone(base); change(raw); const before = clone(raw); invalid(() => timeline.normalizeLiveInputState(raw)); assert.deepEqual(raw, before); }
  const denseOverflow = clone(base); denseOverflow.events = Array(257).fill(denseOverflow.events[0]); invalid(() => timeline.normalizeLiveInputState(denseOverflow));
});

test('safe counter and ingress exhaustion throw atomically including counter sum overflow', () => {
  const max = Number.MAX_SAFE_INTEGER;
  const full = clone(initial()); full.counters.received = max; full.counters.rejected.epoch = max;
  assert.equal(timeline.normalizeLiveInputState(full).counters.received, max);
  const before = clone(full); invalid(() => timeline.admitLiveInputs(full, 0, [event()])); assert.deepEqual(full, before);
  const ingress = clone(initial()); ingress.nextIngress = max;
  assert.equal(timeline.normalizeLiveInputState(ingress).nextIngress, max);
  invalid(() => timeline.admitLiveInputs(ingress, 0, [event()])); assert.equal(ingress.counters.received, 0);
  const contradictory = clone(full); contradictory.counters.rejected.future = 1; invalid(() => timeline.normalizeLiveInputState(contradictory));
  const penultimate = clone(initial()); penultimate.nextIngress = max - 1;
  const last = timeline.admitLiveInputs(penultimate, 0, [event()]);
  assert.equal(last.decisions[0].admitted.ingress, max - 1); assert.equal(last.state.nextIngress, max);
  invalid(() => timeline.admitLiveInputs(last.state, 0, [event(1)]));
  const latest = timeline.createLiveInputState(definition(), max, max);
  assert.equal(timeline.stepLiveInputs(latest, step({ timeMs: max })).frame.deltaMs, 0);
  invalid(() => timeline.resetLiveInputs(latest, definition(), max, 0));
});

test('held/event cross-kind identity and receive order are checked independently of array order', () => {
  const d = definition(); d.signals.push({ source: { sourceId: 'a', signalId: 'level' }, kind: 'continuous' });
  const held = event(0); delete held.payload; Object.assign(held, { kind: 'continuous', source: d.signals[1].source, value: 1 });
  const valid = timeline.admitLiveInputs(timeline.createLiveInputState(d, 0, 0), 10, [held, event(1)]).state;
  for (const change of [
    s => { s.continuous[0].ingress = 1; },
    s => { s.continuous[0].envelope.sequence = 1; },
    s => { s.continuous[0].envelope.timestampMs = 1; s.sources[0].timestampMs = 1; },
    s => { s.events[0].receivedAtMs = 9; },
    s => { s.continuous.push(clone(s.continuous[0])); s.counters.acceptedContinuous++; s.counters.received++; },
  ]) { const raw = clone(valid); change(raw); invalid(() => timeline.normalizeLiveInputState(raw)); }
});

test('step validates canonical bounded values but leaves catalogue/range authority to evaluator', () => {
  const target = { sceneId: '10000000-0000-4000-8000-000000000001', nodePath: [], controlId: 'gain' }, row = { target, value: 999 };
  const valid = timeline.stepLiveInputs(initial(), step({ base: [row] }));
  assert.equal(valid.frame.base[0].value, 999); assert.notEqual(valid.frame.base[0], row);
  for (const patch of [{ base: [row, row] }, { hostValues: [row] }, { authority: 'other' }, { base: [{ target: { ...target, sceneId: target.sceneId.toUpperCase().replace('1000', 'ABCD') }, value: 0 }] }, { base: [{ target: { ...target, nodePath: Array(9).fill(target.sceneId) }, value: 0 }] }, { base: [{ target, value: Infinity }] }, { base: [{ target, value: 0, extra: true }] }]) invalid(() => timeline.stepLiveInputs(initial(), step(patch)));
  assert.equal(timeline.stepLiveInputs(initial(), step({ authority: 'host', hostValues: [row] })).frame.hostValues.length, 1);
});
