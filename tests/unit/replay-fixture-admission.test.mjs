import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScriptedReplayFixture as normalize, encodeScriptedReplayFixture as encode, decodeScriptedReplayFixture as decode } from '../../packages/inputs/src/replay-fixture.mjs';

const authority = (sourceId = 'a', generation = 0, calibrationId = 'cal0', connected = true) => ({ sourceId, generation, connected, calibrationId });
const event = (sequence = 0, atMs = 0, patch = {}) => ({ kind: 'input', atMs, envelope: { version: 1, epoch: 0, source: { sourceId: 'a', signalId: 'note' }, generation: 0, calibrationId: 'cal0', sequence, timestampMs: atMs, kind: 'event', payload: { type: 'note', values: [60, 0.5] }, ...patch } });
const fixture = () => ({ version: 1, mode: 'scripted', durationMs: 10, originEpoch: 0, seed: 1, generator: { id: 'test', version: '1', configuration: {} }, mapping: { version: 2, mapping: { version: 1, targets: [], bindings: [] }, smoothing: [] }, authority: 'studio', base: [],
  definition: { version: 1, sources: [authority()], signals: [{ source: { sourceId: 'a', signalId: 'note' }, kind: 'event' }, { source: { sourceId: 'a', signalId: 'level' }, kind: 'continuous' }] }, sourceConfigs: [{ sourceId: 'a', calibrationId: 'cal0', configuration: {} }], operations: [] });
function invalid(input, reason, path) { assert.throws(() => normalize(input), e => { assert.equal(e.code, 'INVALID_REPLAY_FIXTURE'); assert.ok(e.path.length <= 200); assert.ok(e.message.length <= 512); if (reason) assert.match(e.message, reason); if (path) assert.ok(e.path.startsWith(path), e.path); return true; }); }

test('source-wide sequence applies across kinds; equal timestamps and source reset remain explicit', () => {
  const f = fixture(); f.operations = [event(5, 10, { source: { sourceId: 'a', signalId: 'level' }, kind: 'continuous', value: 0.25 })]; delete f.operations[0].envelope.payload;
  f.operations.push(event(4, 10)); invalid(f, /sequence/, 'fixture.operations[1]');
  f.operations[1] = event(6, 10); assert.equal(normalize(f).operations.length, 2);
  f.operations.push({ kind: 'sources', atMs: 10, sources: [authority('a', 1)] }, event(0, 10, { generation: 1 }));
  assert.equal(normalize(f).operations[3].envelope.sequence, 0);
  f.operations[3].envelope.generation = 0; invalid(f, /authority/, 'fixture.operations[3]');
});

test('equal-time transition order changes admission and unchanged authority retains its cursor', () => {
  const f = fixture(), change = { kind: 'sources', atMs: 10, sources: [authority('a', 1)] };
  f.operations = [event(0, 10), change, event(0, 10, { generation: 1 })]; assert.equal(normalize(f).operations.length, 3);
  f.operations = [change, event(0, 10)]; invalid(f, /authority/);
  f.operations = [event(1, 10), { kind: 'sources', atMs: 10, sources: [authority()] }, event(1, 10)]; invalid(f, /sequence/);
  f.operations = [event(0, 10, { generation: 1 })]; invalid(f, /authority/);
});

test('disconnect and calibration edits require increasing generation and complete source snapshots', () => {
  for (const source of [authority('a', 0, 'cal0', false), authority('a', 0, 'cal1'), authority('a', -1)]) {
    const f = fixture(); f.operations = [{ kind: 'sources', atMs: 0, sources: [source] }]; invalid(f);
  }
  const f = fixture(); f.operations = [{ kind: 'sources', atMs: 0, sources: [authority('a', 1, 'cal0', false)] }, event()]; invalid(f);
  f.operations = [{ kind: 'sources', atMs: 0, sources: [authority('a', 1, 'cal0', false)] }, { kind: 'sources', atMs: 0, sources: [authority('a', 2)] }, event(0, 0, { generation: 2 })]; assert.equal(normalize(f).operations.length, 3);
  for (const sources of [[], [authority('b')], [authority(), authority()]]) { f.operations = [{ kind: 'sources', atMs: 0, sources }]; invalid(f); }
});

test('global placement, envelope time/epoch and declared tuple/kind are exact', () => {
  for (const patch of [{ timestampMs: 1 }, { epoch: 1 }, { generation: 1 }, { calibrationId: 'other' }, { sequence: -1 }, { sequence: 1.5 }, { sequence: Number.MAX_SAFE_INTEGER + 1 }, { source: { sourceId: 'a', signalId: 'missing' } }, { source: { sourceId: 'b', signalId: 'note' } }, { kind: 'future' }]) {
    const f = fixture(); f.operations = [event(0, 0, patch)]; invalid(f);
  }
  const f = fixture(); f.operations = [event(0, 10), event(1, 9)]; invalid(f, /time/);
  f.operations = [event(0, 10.01)]; invalid(f);
  f.operations = [event(0, 0.125), event(1, 0.125)]; assert.equal(normalize(f).operations[1].atMs, 0.125);
});

test('configuration pairs exactly cover all initial and transition authorities including disconnected ones', () => {
  for (const change of [f => f.sourceConfigs = [], f => f.sourceConfigs.push(f.sourceConfigs[0]), f => f.sourceConfigs.push({ sourceId: 'a', calibrationId: 'unused', configuration: {} })]) { const f = fixture(); change(f); invalid(f); }
  const f = fixture(); f.operations = [{ kind: 'sources', atMs: 0, sources: [authority('a', 1, 'cal1', false)] }]; invalid(f);
  f.sourceConfigs.unshift({ sourceId: 'a', calibrationId: 'cal1', configuration: { rate: 48000 } });
  assert.deepEqual(normalize(f).sourceConfigs.map(c => c.calibrationId), ['cal0', 'cal1']);
  f.definition.sources.push(authority('b')); f.sourceConfigs.push({ sourceId: 'b', calibrationId: 'cal0', configuration: {} }); f.operations = [];
  f.sourceConfigs = f.sourceConfigs.filter(c => c.calibrationId === 'cal0'); assert.equal(normalize(f).sourceConfigs.length, 2);
});

test('generator provenance scalar constraints and exact fields reject unsupported capabilities', () => {
  for (const change of [f => f.mode = 'live', f => f.version = 2, f => f.receiptTime = 0, f => f.generator.id = 'constructor', f => f.generator.version = ' v1', f => f.generator.version = 'é', f => f.generator.configuration.a = {}, f => f.generator.configuration.a = 'x'.repeat(257), f => f.generator.configuration.constructor = 1, f => f.generator.configuration = Object.fromEntries(Array.from({ length: 33 }, (_, i) => ['k' + i, 1]))]) { const f = fixture(); change(f); invalid(f); }
  const f = fixture(); f.generator.configuration = Object.fromEntries(Array.from({ length: 32 }, (_, i) => ['k' + i, i === 0 ? 'x'.repeat(256) : i])); assert.equal(Object.keys(normalize(f).generator.configuration).length, 32);
});

test('numeric seed/duration limits are inclusive and negative zero is normalized throughout', () => {
  for (const seed of [0, 0xffffffff]) { const f = fixture(); f.seed = seed; f.durationMs = 600000; assert.equal(normalize(f).seed, seed); }
  for (const change of [f => f.seed = -1, f => f.seed = 0x100000000, f => f.seed = 0.5, f => f.durationMs = 600000.001, f => f.originEpoch = -1, f => f.originEpoch = 1.5]) { const f = fixture(); change(f); invalid(f); }
  const f = fixture(); f.seed = -0; f.durationMs = -0; f.originEpoch = -0; f.generator.configuration.zero = -0; f.operations = [event(-0, -0)];
  const result = normalize(f); assert.equal(Object.is(result.seed, -0), false); assert.equal(Object.is(result.generator.configuration.zero, -0), false); assert.equal(Object.is(result.operations[0].envelope.sequence, -0), false);
});

test('descriptor admission rejects getters without invoking them and rejects hostile data shapes', () => {
  let reads = 0; const getter = fixture(); Object.defineProperty(getter.generator.configuration, 'x', { enumerable: true, get() { reads++; throw Error('must not invoke'); } }); invalid(getter); assert.equal(reads, 0);
  for (const change of [f => f.operations = Array(1), f => f.operations.extra = 1, f => f.generator.configuration[Symbol('x')] = 1, f => Object.setPrototypeOf(f.generator.configuration, { inherited: true }), f => f.generator.configuration.x = f, f => f.generator.configuration.x = undefined, f => f.generator.configuration.x = NaN, f => f.generator.configuration.x = Infinity, f => f.generator.configuration.x = 1n, f => f.generator.configuration.x = () => {}, f => Object.defineProperty(f.generator.configuration, 'hidden', { value: 1 })]) { const f = fixture(); change(f); invalid(f); }
  const f = fixture(); f.generator.configuration = Object.assign(Object.create(null), { a: true }); const n = normalize(f); assert.equal(n.generator.configuration.a, true); assert.notEqual(n.generator.configuration, f.generator.configuration);
});

test('owner source/signal bounds and envelope payload bound are preserved', () => {
  const f = fixture(); f.definition.sources = Array.from({ length: 64 }, (_, i) => authority('s' + i)); f.definition.signals = Array.from({ length: 256 }, (_, i) => ({ source: { sourceId: 's0', signalId: 'n' + i }, kind: 'event' })); f.sourceConfigs = f.definition.sources.map(s => ({ sourceId: s.sourceId, calibrationId: 'cal0', configuration: {} }));
  assert.equal(normalize(f).definition.signals.length, 256);
  f.definition.signals.push({ source: { sourceId: 's0', signalId: 'n256' }, kind: 'event' }); invalid(f, undefined, 'fixture.definition'); f.definition.signals.pop();
  f.definition.sources.push(authority('s64')); invalid(f, undefined, 'fixture.definition');
  const g = fixture(); g.operations = [event()]; g.operations[0].envelope.payload.values = Array(16).fill(1); assert.equal(normalize(g).operations[0].envelope.payload.values.length, 16); g.operations[0].envelope.payload.values.push(1); invalid(g);
});

test('all 256 distinct calibration pairs are admitted and the next pair rejects', () => {
  const f = fixture(); f.sourceConfigs = Array.from({ length: 256 }, (_, i) => ({ sourceId: 'a', calibrationId: 'cal' + i, configuration: {} }));
  f.operations = Array.from({ length: 255 }, (_, i) => ({ kind: 'sources', atMs: 0, sources: [authority('a', i + 1, 'cal' + (i + 1))] }));
  assert.equal(normalize(f).sourceConfigs.length, 256);
  f.sourceConfigs.push({ sourceId: 'a', calibrationId: 'cal256', configuration: {} });
  invalid(f, /array exceeds declared bound/, 'fixture.sourceConfigs');
});

test('raw byte guard admits exactly 8MiB before semantic rejection and rejects one more byte', () => {
  // Such raw shapes cannot be valid DTOs: scalar provenance caps dominate.
  // Distinct failure reasons prove exact preflight accounting independently.
  const raw = { x: 'x'.repeat(8388608 - 8) };
  assert.equal(Buffer.byteLength(JSON.stringify(raw)), 8388608);
  invalid(raw, /expected exact record fields/);
  raw.x += 'x'; invalid(raw, /raw UTF-8 byte budget/);
  raw.x = 'Ω'.repeat((8388608 - 8) / 2); invalid(raw, /expected exact record fields/);
  raw.x += 'x'; invalid(raw, /raw UTF-8 byte budget/);
});

test('raw value guard charges shared occurrences up to 250000 and refuses the next value', () => {
  const shared = Array(30).fill(null), raw = { x: [...Array(8064).fill(shared), Array(13).fill(null)] };
  // 1 root + 1 array + 8064*(1 array + 30 nulls) + (1 array + 13 nulls).
  assert.equal(2 + 8064 * 31 + 14, 250000);
  invalid(raw, /expected exact record fields/);
  raw.x.at(-1).push(null); invalid(raw, /visited value budget/);
});

test('raw depth and property-name guards are exact and bounded diagnostics survive long paths', () => {
  const nested = depth => { let value = null; while (depth--) value = { x: value }; return value; };
  invalid(nested(16), /expected exact record fields/); invalid(nested(17), /raw depth budget/);
  invalid({ ['x'.repeat(64)]: null }, /expected exact record fields/);
  invalid({ ['x'.repeat(65)]: null }, /bounded enumerable own data/);
  let value = Infinity; for (let i = 0; i < 16; i++) value = { ['x'.repeat(64)]: value }; invalid(value, /finite number/);
});

test('decode bounds primitive characters then actual UTF-8 before parsing', async () => {
  await assert.rejects(decode('x'.repeat(8388609), '0'.repeat(64)), /bounded primitive JSON string/);
  await assert.rejects(decode('Ω'.repeat(4194305), '0'.repeat(64)), /UTF-8 byte budget/);
  await assert.rejects(decode('x'.repeat(8388608), '0'.repeat(64)), /malformed JSON/);
});

test('missing Web Crypto cannot produce an identity while pure normalization remains usable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    assert.equal(normalize(fixture()).version, 1);
    await assert.rejects(encode(fixture()), { code: 'REPLAY_HASH_UNAVAILABLE' });
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});

test('source cursors are independent and complete snapshot order cannot be silently repaired', () => {
  const f = fixture(); f.definition.sources.push(authority('b')); f.definition.signals.push({ source: { sourceId: 'b', signalId: 'note' }, kind: 'event' }); f.sourceConfigs.push({ sourceId: 'b', calibrationId: 'cal0', configuration: {} });
  f.operations = [event(5), event(0, 0, { source: { sourceId: 'b', signalId: 'note' } }), { kind: 'sources', atMs: 0, sources: [authority('a', 1), authority('b')] }, event(0, 0, { generation: 1 })];
  assert.equal(normalize(f).operations.length, 4);
  f.operations.push(event(0, 0, { source: { sourceId: 'b', signalId: 'note' } })); invalid(f, /sequence/);
  f.operations.pop(); f.operations[2].sources.reverse(); invalid(f, /complete declaration order/);
});
