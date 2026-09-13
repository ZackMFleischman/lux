import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeScriptedReplayFixture as encode } from '../../packages/inputs/src/replay-fixture.mjs';
import { createScriptedReplayCursor as create, inspectScriptedReplayCursor as inspect, advanceScriptedReplayCursor as advance, resetScriptedReplayCursor as reset, seekScriptedReplayCursor as seek, replayCursorLimits as limits } from '../../packages/inputs/src/replay-cursor.mjs';

const uuid = n => `${n.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
const target = { sceneId: uuid(1), nodePath: [], controlId: 'gain' };
const source = { sourceId: 'a', signalId: 'value' };
const authority = (generation = 0, connected = true, sourceId = 'a') => ({ sourceId, generation, connected, calibrationId: 'cal0' });
const binding = (n = 2, ref = source, dest = target) => ({ id: uuid(n), phase: 'macro', source: ref, target: dest, inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 1, exponent: 1, invert: false, mode: 'replace', enabled: true });
const input = (atMs, sequence, value, generation = 0, ref = source) => ({ kind: 'input', atMs, envelope: { version: 1, epoch: 0, source: ref, generation, calibrationId: 'cal0', sequence, timestampMs: atMs, kind: 'continuous', value } });
const note = (atMs, sequence, generation = 0) => ({ kind: 'input', atMs, envelope: { version: 1, epoch: 0, source: { sourceId: 'a', signalId: 'note' }, generation, calibrationId: 'cal0', sequence, timestampMs: atMs, kind: 'event', payload: { type: 'note', values: [60] } } });
const empty = (durationMs = 0) => ({ version: 1, mode: 'scripted', durationMs, originEpoch: 0, seed: 1, generator: { id: 'test', version: '1', configuration: {} }, mapping: { version: 2, mapping: { version: 1, targets: [], bindings: [] }, smoothing: [] }, authority: 'studio', base: [], definition: { version: 1, sources: [], signals: [] }, sourceConfigs: [], operations: [] });
const fixture = () => ({ ...empty(400), mapping: { version: 2, mapping: { version: 1, targets: [{ target, definition: { id: 'gain', type: 'number', label: 'Gain', default: 0, min: 0, max: 1, step: 0.01, changeCost: 'live' } }], bindings: [binding()] }, smoothing: [{ bindingId: uuid(2), tauMs: 100 }] }, base: [{ target, value: 0.75 }], definition: { version: 1, sources: [authority()], signals: [{ source, kind: 'continuous' }, { source: { sourceId: 'a', signalId: 'note' }, kind: 'event' }] }, sourceConfigs: [{ sourceId: 'a', calibrationId: 'cal0', configuration: {} }], operations: [input(0, 0, 0), input(100, 1, 1), note(200, 2), input(300, 3, 0)] });
const budget = { evaluations: limits.evaluations, events: limits.events, work: limits.work };
const cursor = async (f = fixture(), epoch = 7) => { const e = await encode(f); return create(e.json, e.sha256, epoch); };
const step = (c, nextMs, b = budget) => { const v = inspect(c); return advance(c, { runtimeEpoch: v.runtimeEpoch, previousMs: v.positionMs, nextMs, budget: b }); };
const frozen = o => { if (o && typeof o === 'object') { assert.ok(Object.isFrozen(o)); Object.values(o).forEach(frozen); } };
const quota = fn => assert.throws(fn, { code: 'REPLAY_CURSOR_QUOTA_EXCEEDED' });

test('verified opaque cursor starts from hashed authored base without consuming zero', async () => {
  const f = fixture(), e = await encode(f), c = await create(e.json, e.sha256, 7), v = inspect(c);
  assert.deepEqual(c, {}); frozen(c); frozen(v);
  assert.deepEqual(v, { version: 1, fixtureHash: e.sha256, runtimeEpoch: 7, seed: 1, durationMs: 400, positionMs: 0, zeroConsumed: false, values: f.base });
  assert.notEqual(v, inspect(c)); assert.notEqual(v.values, inspect(c).values);
  for (const fake of [{}, structuredClone(c), new Proxy(c, {}), null, e]) assert.throws(() => inspect(fake), { code: 'INVALID_REPLAY_CURSOR' });
});

test('A: analytic intermediate trajectory and exact endpoint bits ignore presentation partition', async () => {
  const whole = step(await cursor(), 400), split = await cursor();
  const seen = [];
  for (const time of [0, 100, 125, 200, 275, 300, 400]) {
    const result = step(split, time); seen.push(...result.events);
    const known = { 100: 0, 200: 1 - Math.exp(-1), 300: 1 - Math.exp(-2), 400: (1 - Math.exp(-2)) * Math.exp(-1) };
    if (Object.hasOwn(known, time)) assert.ok(Math.abs(result.view.values[0].value - known[time]) < 1e-12);
  }
  assert.equal(inspect(split).values[0].value, whole.view.values[0].value);
  assert.equal(seen.length, 1); assert.deepEqual(seen, whole.events);
  assert.equal(whole.events[0].operationIndex, 2); assert.equal(whole.events[0].original.epoch, 0); assert.equal(whole.events[0].runtime.epoch, 7);
  assert.deepEqual(whole.events[0].runtime, { ...whole.events[0].original, epoch: 7 });
  assert.notEqual(whole.events[0].original, whole.events[0].runtime); frozen(whole);
  assert.equal(whole.evaluations.length, 8); assert.equal(whole.work, 24);
  assert.deepEqual(whole.evaluations.map(x => [x.fromMs, x.toMs, x.reason, x.operationIndex]), [[0, 0, 'initial', null], [0, 0, 'continuous', 0], [0, 100, 'advance', null], [100, 100, 'continuous', 1], [100, 200, 'advance', null], [200, 300, 'advance', null], [300, 300, 'continuous', 3], [300, 400, 'advance', null]]);
});

test('B: zero batch, equal-time source transition and endpoint events retain complete indices', async () => {
  const f = fixture(); f.durationMs = 10; f.operations = [note(0, 0), note(0, 1), { kind: 'sources', atMs: 10, sources: [authority(1)] }, input(10, 0, 0.6, 1), note(10, 1, 1)];
  const c = await cursor(f), zero = step(c, 0), end = step(c, 10);
  assert.deepEqual(zero.events.map(e => e.operationIndex), [0, 1]); assert.equal(zero.view.zeroConsumed, true);
  assert.deepEqual(end.events.map(e => e.operationIndex), [4]); assert.equal(end.view.values[0].value, 0.6);
  assert.equal(end.events[0].original.epoch, 0); assert.equal(end.events[0].runtime.epoch, 7);
  const redraw = step(c, 10, { evaluations: 0, events: 0, work: 0 }); assert.equal(redraw.events.length, 0); assert.equal(redraw.evaluations.length, 0); assert.equal(redraw.work, 0);
  [f.operations[2], f.operations[3]] = [f.operations[3], f.operations[2]];
  await assert.rejects(cursor(f), { code: 'INVALID_REPLAY_FIXTURE' });
});

test('C: disconnect clears held sample, reconnect does not revive it, no wall-clock expiry', async () => {
  const f = fixture(); f.durationMs = 1000; f.operations = [input(0, 0, 0), input(100, 1, 1), { kind: 'sources', atMs: 200, sources: [authority(1, false)] }, { kind: 'sources', atMs: 250, sources: [authority(2)] }, input(300, 0, 0.4, 2)];
  const c = await cursor(f);
  for (const t of [200, 250]) assert.equal(step(c, t).view.values[0].value, 0.75);
  assert.equal(step(c, 300).view.values[0].value, 0.4); assert.equal(step(c, 1000).view.values[0].value, 0.4);
});

test('D: 600000ms canonical grid is complete and projection never advances its checkpoint', async () => {
  const c = await cursor(empty(600000)); const before = inspect(c);
  quota(() => step(c, 600000, { evaluations: 10, events: 0, work: 11 })); assert.deepEqual(inspect(c), before);
  const first = step(c, 30000); assert.deepEqual(first.evaluations.map(e => e.reason), ['initial', 'projection']);
  const result = step(c, 600000, { evaluations: 10, events: 0, work: 10 });
  assert.equal(result.evaluations.length, 10); assert.equal(result.evaluations[0].fromMs, 0); assert.equal(result.work, 10);
  assert.deepEqual(result.evaluations.map(e => e.toMs), Array.from({ length: 10 }, (_, i) => (i + 1) * 60000));
  const fresh = step(await cursor(empty(600000)), 600000, { evaluations: 11, events: 0, work: 11 }); assert.equal(fresh.evaluations.length, 11);
  assert.throws(() => step(c, 600000.1), { code: 'INVALID_REPLAY_CURSOR' });
});

test('E: all 8192 same-time events survive exact budget, failed preflight consumes nothing', async () => {
  const f = fixture(); f.durationMs = 0; f.operations = Array.from({ length: 8192 }, (_, i) => note(0, i));
  const c = await cursor(f), before = inspect(c);
  quota(() => step(c, 0, { evaluations: 1, events: 8191, work: 3 })); assert.deepEqual(inspect(c), before);
  const r = step(c, 0, { evaluations: 1, events: 8192, work: 3 });
  assert.equal(r.events.length, 8192); assert.equal(r.evaluations.length, 1); assert.equal(r.work, 3);
  for (let i = 0; i < r.events.length; i++) { assert.equal(r.events[i].operationIndex, i); assert.equal(r.events[i].original.sequence, i); }
  assert.equal(step(c, 0).events.length, 0);
});

test('F: unused held input never expands 256 unresolved references, but retains its evaluation/work', async () => {
  const f = fixture(); f.durationMs = 0; f.operations = [input(0, 0, 1)];
  f.mapping.mapping.bindings = Array.from({ length: 256 }, (_, i) => binding(i + 2, { sourceId: `missing${i}`, signalId: 'value' })); f.mapping.smoothing = f.mapping.mapping.bindings.map(b => ({ bindingId: b.id, tauMs: 0 }));
  const c = await cursor(f), r = step(c, 0, { evaluations: 2, events: 0, work: 516 });
  assert.equal(r.view.values[0].value, 0.75); assert.equal(r.evaluations.length, 2); assert.equal(r.work, 516); assert.equal(r.evaluations[1].operationIndex, 0);
  assert.equal(step(c, 0, { evaluations: 0, events: 0, work: 0 }).work, 0);
});

test('reset and seek replay from empty history and preserve immutable historical results', async () => {
  const c = await cursor(), old = step(c, 200), historical = structuredClone(old);
  const initial = reset(c, { runtimeEpoch: 7, nextEpoch: 8 }); assert.equal(initial.positionMs, 0); assert.equal(initial.zeroConsumed, false); assert.equal(initial.values[0].value, 0.75);
  assert.throws(() => advance(c, { runtimeEpoch: 7, previousMs: 0, nextMs: 0, budget }), { code: 'INVALID_REPLAY_CURSOR' });
  const replay = step(c, 400), sought = seek(c, { runtimeEpoch: 8, nextEpoch: 9, nextMs: 400, budget });
  assert.deepEqual(sought.view.values, replay.view.values); assert.equal(sought.previousMs, 0); assert.deepEqual(sought.events.map(e => e.original), replay.events.map(e => e.original)); assert.equal(sought.events[0].runtime.epoch, 9);
  assert.deepEqual(old, historical);
  const before = inspect(c); quota(() => seek(c, { runtimeEpoch: 9, nextEpoch: 10, nextMs: 400, budget: { evaluations: 0, events: 0, work: 0 } })); assert.deepEqual(inspect(c), before); assert.equal(step(c, 400).work, 0);
});

test('mixed referenced/unused declarations and unrelated source transitions preserve independent smoothing', async () => {
  const f = fixture(), bSource = { sourceId: 'b', signalId: 'value' }, bTarget = { ...target, controlId: 'other' }, unused = { sourceId: 'a', signalId: 'unused' };
  f.durationMs = 300;
  f.mapping.mapping.targets.push({ target: bTarget, definition: { ...f.mapping.mapping.targets[0].definition, id: 'other' } });
  f.mapping.mapping.bindings.push(binding(3, bSource, bTarget)); f.mapping.smoothing.push({ bindingId: uuid(3), tauMs: 100 }); f.base.push({ target: bTarget, value: 0.75 });
  f.definition.sources.push(authority(0, true, 'b')); f.definition.signals = [{ source: unused, kind: 'continuous' }, { source: bSource, kind: 'continuous' }, { source, kind: 'continuous' }];
  f.sourceConfigs.push({ sourceId: 'b', calibrationId: 'cal0', configuration: {} });
  f.operations = [input(0, 0, 0.9, 0, unused), input(0, 1, 0.2), input(0, 0, 0, 0, bSource), input(100, 1, 1, 0, bSource), { kind: 'sources', atMs: 200, sources: [authority(1), authority(0, true, 'b')] }, input(200, 0, 0.4, 1)];
  const c = await cursor(f), mid = step(c, 200), end = step(c, 300);
  assert.equal(mid.view.values[0].value, 0.4); assert.ok(Math.abs(mid.view.values[1].value - (1 - Math.exp(-1))) < 1e-12);
  assert.equal(mid.evaluations.length, 9); assert.equal(mid.work, 45);
  assert.equal(end.view.values[0].value, 0.4); assert.ok(Math.abs(end.view.values[1].value - (1 - Math.exp(-2))) < 1e-12);
});

test('zero smoothing consumes every dense sample and exact lower evaluation/work budgets', async () => {
  const f = fixture(); f.durationMs = 0; f.mapping.smoothing[0].tauMs = 0; f.operations = Array.from({ length: 256 }, (_, i) => input(0, i, i / 255));
  const c = await cursor(f), before = inspect(c);
  quota(() => step(c, 0, { evaluations: 256, events: 0, work: 771 })); assert.deepEqual(inspect(c), before);
  quota(() => step(c, 0, { evaluations: 257, events: 0, work: 770 })); assert.deepEqual(inspect(c), before);
  const r = step(c, 0, { evaluations: 257, events: 0, work: 771 }); assert.equal(r.evaluations.length, 257); assert.equal(r.work, 771); assert.equal(r.view.values[0].value, 1);
  assert.deepEqual(r.evaluations.slice(1).map(e => e.operationIndex), Array.from({ length: 256 }, (_, i) => i));
});

test('module work cap dominates a legal dense fixture without evaluating or consuming it', async () => {
  const f = fixture(); f.durationMs = 0;
  f.mapping.mapping.bindings = Array.from({ length: 256 }, (_, i) => binding(i + 2)); f.mapping.smoothing = f.mapping.mapping.bindings.map(b => ({ bindingId: b.id, tauMs: 0 }));
  f.operations = Array.from({ length: 4064 }, (_, i) => input(0, i, 0.5));
  const c = await cursor(f), before = inspect(c);
  // 4065 evaluations * 258 units = 1,048,770, over the 1,048,576 cap.
  quota(() => step(c, 0)); assert.deepEqual(inspect(c), before);
});

test('actual evaluator arithmetic error after earlier candidate work rolls back advance and seek', async () => {
  const f = fixture(); f.durationMs = 100;
  f.mapping.mapping.bindings = [2, 3].map(n => ({ ...binding(n), mode: 'add', outputMax: 1e308 })); f.mapping.smoothing = [2, 3].map(n => ({ bindingId: uuid(n), tauMs: 0 }));
  f.operations = [note(0, 0), input(100, 1, 1)];
  const c = await cursor(f), before = inspect(c);
  assert.throws(() => step(c, 100), { code: 'INVALID_INPUT_MAPPING' }); assert.deepEqual(inspect(c), before);
  const zero = step(c, 0); assert.equal(zero.events.length, 1); assert.equal(zero.view.values[0].value, 0.75);
  const checkpoint = inspect(c);
  assert.throws(() => seek(c, { runtimeEpoch: 7, nextEpoch: 8, nextMs: 100, budget }), { code: 'INVALID_INPUT_MAPPING' }); assert.deepEqual(inspect(c), checkpoint);
  assert.equal(step(c, 0, { evaluations: 0, events: 0, work: 0 }).work, 0);
});
