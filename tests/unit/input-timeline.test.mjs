import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveInputState, normalizeLiveInputState, admitLiveInputs, changeLiveInputSources, stepLiveInputs, resetLiveInputs, inputTimelineLimits } from '../../packages/inputs/src/timeline.mjs';
import { createTimedMappingState, evaluateTimedNumericMappings } from '../../packages/inputs/src/mapping.mjs';

const level = { sourceId: 'a', signalId: 'level' };
const note = { sourceId: 'a', signalId: 'note' };
const other = { sourceId: 'b', signalId: 'note' };
const authority = sourceId => ({ sourceId, generation: 0, connected: true, calibrationId: 'cal0' });
const definition = { version: 1, sources: [authority('a'), authority('b')], signals: [{ source: level, kind: 'continuous' }, { source: note, kind: 'event' }, { source: other, kind: 'event' }] };
const event = (source = note, sequence = 0, timestampMs = 0, extra = {}) => ({ version: 1, epoch: 0, source, generation: 0, calibrationId: 'cal0', sequence, timestampMs, kind: 'event', payload: { type: 'note', values: [60, 0.5] }, ...extra });
const continuous = (sequence = 0, timestampMs = 0, value = 0, extra = {}) => ({ version: 1, epoch: 0, source: level, generation: 0, calibrationId: 'cal0', sequence, timestampMs, kind: 'continuous', value, ...extra });
const initial = () => createLiveInputState(definition, 0, 0);
const step = (timeMs, extra = {}) => ({ timeMs, authority: 'studio', base: [], hostValues: [], ...extra });
const reason = result => result.decisions.map(row => row.status === 'rejected' ? row.rejected.reason : 'accepted');
const frozen = value => { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
const invalid = fn => assert.throws(fn, { code: 'INVALID_INPUT_TIMELINE' });

test('six pure operations retain identical events and consume time zero only once', () => {
  assert.equal(inputTimelineLimits.consumedPerStep, 32);
  const state = initial(), envelopes = [event(), event(note, 1), event(other)];
  const admitted = admitLiveInputs(state, 0, envelopes);
  assert.deepEqual(reason(admitted), ['accepted', 'accepted', 'accepted']);
  const first = stepLiveInputs(admitted.state, step(0));
  assert.deepEqual(first.events.map(row => row.ingress), [0, 1, 2]);
  assert.deepEqual(first.events.map(row => row.envelope), envelopes);
  assert.equal(first.state.counters.consumedEvents, 3);
  assert.equal(stepLiveInputs(first.state, step(0)).events.length, 0);
  assert.equal(state.counters.received, 0);
  assert.notEqual(admitted.decisions[0].admitted.envelope, envelopes[0]);
  assert.deepEqual(normalizeLiveInputState(first.state), first.state);
  frozen(first); frozen(admitted); frozen(state);
});

test('source cursors span signal kinds and explicit authority alone changes generation', () => {
  const first = admitLiveInputs(initial(), 10, [continuous(5, 10), event(note, 4, 10), event(note, 6, 9), event(note, 6, 10), event(note, 7, 10, { generation: 1 })]);
  assert.deepEqual(reason(first), ['accepted', 'sequence', 'timestamp', 'accepted', 'generation']);
  assert.equal(first.state.sources[0].sequence, 6);
  const changed = changeLiveInputSources(first.state, [{ ...authority('a'), generation: 1 }, authority('b')]);
  assert.deepEqual(changed.discarded.map(row => [row.admitted.ingress, row.reason]), [[1, 'source-reset']]);
  assert.equal(changed.state.counters.clearedContinuous, 1);
  assert.equal(changed.state.sources[0].sequence, null);
  assert.deepEqual(reason(admitLiveInputs(changed.state, 10, [event(), event(note, 0, 10, { generation: 1 })])), ['generation', 'accepted']);
  for (const patch of [{ connected: false }, { calibrationId: 'cal1' }, { generation: -1 }]) invalid(() => changeLiveInputSources(first.state, [{ ...authority('a'), ...patch }, authority('b')]));
  invalid(() => changeLiveInputSources(first.state, [...definition.sources].reverse()));
  invalid(() => changeLiveInputSources(first.state, [authority('a')]));
  assert.equal(first.state.events.length, 1);
});

test('future rejection leaves cursor reusable; fractional times and tied times stay exact', () => {
  const future = admitLiveInputs(initial(), 10, [event(note, 0, 11)]);
  assert.deepEqual(reason(future), ['future']); assert.equal(future.state.sources[0].sequence, null);
  const retry = admitLiveInputs(future.state, 11, [event(note, 0, 11), event(note, 1, 11)]);
  assert.deepEqual(reason(retry), ['accepted', 'accepted']);
  const fraction = admitLiveInputs(initial(), 10.25, [event(note, 0, 10.25)]);
  assert.equal(fraction.state.events[0].envelope.timestampMs, 10.25);
  invalid(() => admitLiveInputs(retry.state, 10, []));
  const advanced = stepLiveInputs(retry.state, step(20));
  invalid(() => stepLiveInputs(advanced.state, step(19)));
  invalid(() => stepLiveInputs(initial(), step(60000.001)));
  assert.equal(stepLiveInputs(initial(), step(60000)).frame.deltaMs, 60000);
});

test('closed timestamp inputs await an advancing step and lateness uses strict boundaries', () => {
  const closed = stepLiveInputs(admitLiveInputs(initial(), 0, [event()]).state, step(0)).state;
  const later = admitLiveInputs(closed, 0, [event(note, 1)]).state;
  assert.equal(stepLiveInputs(later, step(0)).events.length, 0);
  assert.deepEqual(stepLiveInputs(later, step(1)).events.map(row => row.ingress), [1]);
  const boundary = admitLiveInputs(initial(), 100, [event()]);
  assert.equal(stepLiveInputs(boundary.state, step(100)).events.length, 1);
  const stale = admitLiveInputs(initial(), 100.001, [event(), event(note, 0)]);
  assert.deepEqual(reason(stale), ['late', 'sequence']);
  const aged = stepLiveInputs(boundary.state, step(100.001));
  assert.deepEqual(aged.discarded.map(row => [row.admitted.ingress, row.reason]), [[0, 'late']]);
  assert.equal(aged.state.counters.discarded.late, 1);
  const repeated = stepLiveInputs(later, step(0));
  assert.equal(repeated.state.events.length, 1);
});

test('future entries never block eligible later ingress from another source', () => {
  const admitted = admitLiveInputs(initial(), 20, [event(note, 0, 20), event(other, 0, 10)]);
  const first = stepLiveInputs(admitted.state, step(10));
  assert.deepEqual(first.events.map(row => row.ingress), [1]);
  assert.deepEqual(first.state.events.map(row => row.ingress), [0]);
  assert.deepEqual(stepLiveInputs(first.state, step(20)).events.map(row => row.ingress), [0]);
});

test('256 queue capacity rejects newest, 32 consumption budget excludes late drops', () => {
  const full = admitLiveInputs(initial(), 0, Array.from({ length: 256 }, (_, i) => event(note, i)));
  const overflow = admitLiveInputs(full.state, 0, [event(note, 256), event(note, 256)]);
  assert.deepEqual(reason(overflow), ['overflow', 'sequence']);
  assert.deepEqual(overflow.state.events, full.state.events);
  const first = stepLiveInputs(overflow.state, step(0));
  assert.deepEqual(first.events.map(row => row.ingress), Array.from({ length: 32 }, (_, i) => i));
  const second = stepLiveInputs(first.state, step(50));
  assert.deepEqual(second.events.map(row => row.ingress), Array.from({ length: 32 }, (_, i) => i + 32));
  const last = stepLiveInputs(second.state, step(101));
  assert.equal(last.discarded.length, 192); assert.equal(last.events.length, 0);
  assert.equal(last.state.counters.consumedEvents, 64); assert.equal(last.state.counters.discarded.late, 192);
  const mixed = admitLiveInputs(initial(), 100, [event(note, 0, 0), event(other, 0, 100)]).state;
  const drained = stepLiveInputs(mixed, step(101));
  assert.equal(drained.discarded.length, 1); assert.deepEqual(drained.events.map(row => row.ingress), [1]);
});

test('continuous receipts coalesce in declaration order and expire strictly beyond 500ms', () => {
  const admitted = admitLiveInputs(initial(), 10, [continuous(0, 0, 0), continuous(1, 10, 1)]);
  assert.equal(admitted.decisions.length, 2); assert.equal(admitted.state.counters.coalescedContinuous, 1);
  assert.equal(stepLiveInputs(admitted.state, step(9)).frame.signals.length, 0);
  assert.deepEqual(stepLiveInputs(admitted.state, step(10)).frame.signals, [{ source: level, generation: 0, value: 1 }]);
  const fresh = stepLiveInputs(admitted.state, step(510));
  assert.equal(fresh.frame.signals[0].value, 1);
  const expired = stepLiveInputs(fresh.state, step(510.001));
  assert.equal(expired.frame.signals.length, 0); assert.equal(expired.state.counters.expiredContinuous, 1);
  const staleReceipt = admitLiveInputs(admitted.state, 511, [continuous(2, 10, 0.5)]);
  assert.deepEqual(reason(staleReceipt), ['accepted']); assert.equal(staleReceipt.state.continuous.length, 0);
  assert.equal(staleReceipt.state.counters.coalescedContinuous, 2); assert.equal(staleReceipt.state.counters.expiredContinuous, 1);
});

test('held samples follow declarations across tuples even when latest receipts arrive in reverse order', () => {
  const second = { sourceId: 'a', signalId: 'other' };
  const d = { ...definition, signals: [{ source: second, kind: 'continuous' }, ...definition.signals] };
  const admitted = admitLiveInputs(createLiveInputState(d, 0, 0), 10, [continuous(0, 0, 0.25), continuous(1, 10, 0.75, { source: second })]);
  assert.deepEqual(admitted.state.continuous.map(row => row.ingress), [1, 0]);
  assert.deepEqual(stepLiveInputs(admitted.state, step(10)).frame.signals.map(row => row.value), [0.75, 0.25]);
  assert.deepEqual(normalizeLiveInputState(admitted.state), admitted.state);
});

test('explicit 20-per-second workload consumes all 200 identical events at 60Hz', () => {
  let state = initial(), sequence = 0, consumed = 0;
  for (let k = 0; k <= 600; k++) {
    const time = k * (1000 / 60), batch = [];
    while (sequence < 200 && sequence * 50 <= time) { batch.push(event(note, sequence, sequence * 50)); sequence++; }
    state = admitLiveInputs(state, time, batch).state;
    const result = stepLiveInputs(state, step(time)); state = result.state; consumed += result.events.length;
  }
  assert.equal(consumed, 200); assert.equal(state.counters.received, 200); assert.equal(state.counters.acceptedEvents, 200);
  assert.equal(Object.values(state.counters.rejected).reduce((a, b) => a + b, 0), 0);
  assert.equal(Object.values(state.counters.discarded).reduce((a, b) => a + b, 0), 0);
});

const target = { sceneId: '10000000-0000-4000-8000-000000000001', nodePath: [], controlId: 'gain' };
const binding = (n, exponent = 1) => ({ id: `20000000-0000-4000-8000-00000000000${n}`, phase: 'macro', source: level, target, inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1, exponent, invert: false, mode: 'add', enabled: true });
const plan = (bindings = [binding(1)]) => ({ version: 2, mapping: { version: 1, targets: [{ target, definition: { id: 'gain', type: 'number', label: 'Gain', default: 0, min: 0, max: 1, changeCost: 'live' } }], bindings }, smoothing: bindings.map((row, i) => ({ bindingId: row.id, tauMs: 100 * (i + 1) })) });
const mappedStep = time => step(time, { base: [{ target, value: 0 }] });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('caller commits timeline and real evaluator candidate together after success only', () => {
  const p = plan();
  let timeline = admitLiveInputs(initial(), 0, [continuous()]).state;
  const seed = stepLiveInputs(timeline, mappedStep(0));
  let mapping = evaluateTimedNumericMappings(p, seed.frame, createTimedMappingState(p, 0)).state;
  timeline = admitLiveInputs(seed.state, 100, [continuous(1, 100, 1), event(note, 2, 100)]).state;
  const oldTimeline = timeline, oldMapping = mapping;
  const bad = stepLiveInputs(timeline, step(100));
  assert.throws(() => evaluateTimedNumericMappings(p, bad.frame, mapping), { code: 'INVALID_INPUT_MAPPING' });
  assert.equal(timeline, oldTimeline); assert.equal(mapping, oldMapping); assert.equal(timeline.events.length, 1);
  const candidate = stepLiveInputs(timeline, mappedStep(100));
  const evaluated = evaluateTimedNumericMappings(p, candidate.frame, mapping);
  near(evaluated.values[0].value, 1 - Math.exp(-1));
  ({ state: timeline } = candidate); ({ state: mapping } = evaluated);
  assert.deepEqual(candidate.events.map(row => row.ingress), [2]);
  assert.equal(stepLiveInputs(timeline, mappedStep(100)).events.length, 0);
  assert.notEqual(mapping, oldMapping);
});

test('shared tuple bindings preserve independent curve/tau answers and generation resets smoothing', () => {
  const p = plan([binding(1), binding(2, 2)]);
  const first = stepLiveInputs(admitLiveInputs(initial(), 0, [continuous()]).state, mappedStep(0));
  const seed = evaluateTimedNumericMappings(p, first.frame, createTimedMappingState(p, 0));
  const second = stepLiveInputs(admitLiveInputs(first.state, 100, [continuous(1, 100, 0.5)]).state, mappedStep(100));
  const result = evaluateTimedNumericMappings(p, second.frame, seed.state);
  near(result.state.bindings[0].value, 0.5 * (1 - Math.exp(-1)));
  near(result.state.bindings[1].value, 0.25 * (1 - Math.exp(-0.5)));
  const stopped = changeLiveInputSources(second.state, [{ ...authority('a'), generation: 1, connected: false }, authority('b')]);
  const changed = changeLiveInputSources(stopped.state, [{ ...authority('a'), generation: 2 }, authority('b')]);
  const rebound = stepLiveInputs(admitLiveInputs(changed.state, 101, [continuous(0, 101, 1, { generation: 2 })]).state, mappedStep(101));
  const reset = evaluateTimedNumericMappings(p, rebound.frame, result.state);
  assert.deepEqual(reset.state.bindings.map(row => row.value), [1, 1]);
  const absent = stepLiveInputs(rebound.state, mappedStep(602));
  assert.deepEqual(evaluateTimedNumericMappings(p, absent.frame, reset.state).state.bindings, []);
});

test('source changes preserve unaffected records and reset retains lifetime accounting', () => {
  const old = admitLiveInputs(initial(), 0, [event(), event(other), continuous(1)]).state;
  const changed = changeLiveInputSources(old, [{ ...authority('a'), generation: 1, connected: false }, authority('b')]);
  assert.deepEqual(changed.state.events.map(row => row.ingress), [1]);
  assert.equal(changed.state.sources[1].sequence, 0);
  const reset = resetLiveInputs(old, { version: 1, sources: [authority('b')], signals: [{ source: other, kind: 'event' }] }, 1, 20);
  assert.deepEqual(reset.discarded.map(row => [row.admitted.ingress, row.reason]), [[0, 'reset'], [1, 'reset']]);
  assert.equal(reset.state.counters.received, 3); assert.equal(reset.state.counters.clearedContinuous, 1);
  assert.equal(reset.state.nextIngress, 0); assert.equal(reset.state.lastStepMs, 20); assert.equal(reset.state.stepped, false);
  const receipts = admitLiveInputs(reset.state, 20, [event(other, 0, 20), event(other, 0, 20, { epoch: 1 })]);
  assert.deepEqual(reason(receipts), ['epoch', 'accepted']);
  const first = stepLiveInputs(receipts.state, step(20));
  assert.deepEqual(first.events.map(row => row.ingress), [0]); assert.equal(first.frame.epoch, 1);
  assert.equal(stepLiveInputs(first.state, step(20)).events.length, 0);
  invalid(() => resetLiveInputs(old, definition, 0, 0));
});
