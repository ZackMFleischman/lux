import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizeScriptedReplayFixture as normalize, encodeScriptedReplayFixture as encode, decodeScriptedReplayFixture as decode, replayFixtureLimits } from '../../packages/inputs/src/replay-fixture.mjs';

const empty = () => ({ version: 1, mode: 'scripted', durationMs: 0, originEpoch: 0, seed: 1,
  generator: { id: 'test', version: '1', configuration: {} },
  mapping: { version: 2, mapping: { version: 1, targets: [], bindings: [] }, smoothing: [] },
  authority: 'studio', base: [], definition: { version: 1, sources: [], signals: [] }, sourceConfigs: [], operations: [] });
const canonicalEmpty = '{"version":1,"mode":"scripted","durationMs":0,"originEpoch":0,"seed":1,"generator":{"id":"test","version":"1","configuration":{}},"mapping":{"version":2,"mapping":{"version":1,"targets":[],"bindings":[]},"smoothing":[]},"authority":"studio","base":[],"definition":{"version":1,"sources":[],"signals":[]},"sourceConfigs":[],"operations":[]}';
const digest = json => createHash('sha256').update(json, 'utf8').digest('hex');
const authority = (sourceId = 'a', generation = 0, calibrationId = 'cal0', connected = true) => ({ sourceId, generation, connected, calibrationId });
const event = (sequence = 0, atMs = 0, sourceId = 'a', extra = {}) => ({ kind: 'input', atMs,
  envelope: { version: 1, epoch: 0, source: { sourceId, signalId: 'note' }, generation: 0, calibrationId: 'cal0', sequence, timestampMs: atMs, kind: 'event', payload: { type: 'note', values: [60, 0.5] }, ...extra } });
const tape = (count = 2) => ({ ...empty(), definition: { version: 1, sources: [authority()], signals: [{ source: { sourceId: 'a', signalId: 'note' }, kind: 'event' }] },
  sourceConfigs: [{ sourceId: 'a', calibrationId: 'cal0', configuration: {} }], operations: Array.from({ length: count }, (_, i) => event(i)) });
const target = { sceneId: '11111111-1111-4111-8111-111111111111', nodePath: [], controlId: 'gain' };
const controlled = (value = 0.75) => { const f = empty(); f.mapping.mapping.targets = [{ target, definition: { id: 'gain', type: 'number', label: 'Gain', default: 0, min: 0, max: 1, changeCost: 'live' } }]; f.base = [{ target, value }]; return f; };
const invalid = fn => assert.throws(fn, e => e.code === 'INVALID_REPLAY_FIXTURE' && e.path.length <= 200 && e.message.length <= 512);
const frozen = value => { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };

test('empty fixture has exact independent canonical bytes and SHA, and verifies its roundtrip', async () => {
  assert.equal(replayFixtureLimits.operations, 8192);
  assert.deepEqual(normalize(empty()), empty());
  const result = await encode(empty());
  assert.equal(result.json, canonicalEmpty);
  assert.equal(result.sha256, '42e2c8bce5334af386f822ed8a04b5917e94e47f0ab64355563b525af807f21c');
  assert.equal(result.sha256, digest(canonicalEmpty));
  assert.deepEqual(await decode(result.json, result.sha256), result);
});

test('repeated equal notes survive at zero and the full 8192 operation boundary without live truncation', async () => {
  for (const count of [2, 8192]) {
    const f = tape(count), result = await encode(f), roundtrip = await decode(result.json, result.sha256);
    assert.equal(roundtrip.fixture.operations.length, count);
    assert.deepEqual(roundtrip.fixture.operations, f.operations);
    if (count === 8192) assert.equal(Buffer.byteLength(result.json), 1916345);
  }
  invalid(() => normalize(tape(8193)));
});

test('full authored nondefault base survives owner admission and changes identity', async () => {
  assert.equal(normalize(controlled()).base[0].value, 0.75);
  assert.notEqual((await encode(controlled(0))).sha256, (await encode(controlled(1))).sha256);
  for (const change of [f => f.base = [], f => f.base.push(f.base[0]), f => f.base[0] = { target: { ...target, controlId: 'other' }, value: 0 }, f => f.base[0].value = 2, f => f.authority = 'host', f => f.hostValues = []]) {
    const f = controlled(); change(f); invalid(() => normalize(f));
  }
  const f = controlled(); f.operations = [{ kind: 'controls', atMs: 0, base: f.base }]; invalid(() => normalize(f));
});

test('canonical ordering uses defined DTO order, sorted configuration, and original declaration order', async () => {
  const f = tape(); f.generator.configuration = { z: 1, a: true }; f.sourceConfigs[0].configuration = { z: 'Ω', a: null };
  const reverseRecords = value => Array.isArray(value) ? value.map(reverseRecords) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseRecords(v)])) : value;
  const a = await encode(f), b = await encode(reverseRecords(f));
  assert.equal(a.json, b.json); assert.equal(a.sha256, b.sha256);
  assert.deepEqual(Object.keys(a.fixture.generator.configuration), ['a', 'z']);
  assert.deepEqual(Object.keys(a.fixture.sourceConfigs[0].configuration), ['a', 'z']);
  assert.equal(a.sha256, digest(a.json)); frozen(a);
});

test('every identity field and legal equal-time order binds the hash', async () => {
  const base = tape(1); base.definition.sources.push(authority('b')); base.definition.signals.push({ source: { sourceId: 'b', signalId: 'note' }, kind: 'event' });
  base.sourceConfigs.push({ sourceId: 'b', calibrationId: 'cal0', configuration: {} }); base.operations.push(event(0, 0, 'b'));
  const initial = (await encode(base)).sha256;
  for (const change of [f => f.seed++, f => f.durationMs++, f => f.operations[0].envelope.payload.values[0]++, f => f.operations.reverse(), f => f.definition.sources.reverse(), f => f.definition.signals.reverse(), f => f.generator.version = '2', f => f.sourceConfigs[0].configuration.unit = 'ms']) {
    const f = structuredClone(base); change(f); assert.notEqual((await encode(f)).sha256, initial);
  }
  const a = controlled(), b = controlled(); b.mapping.mapping.targets[0].definition.label = 'Level';
  assert.notEqual((await encode(a)).sha256, (await encode(b)).sha256);
});

test('encode captures all caller data synchronously before its real asynchronous digest', async () => {
  const f = tape(), before = structuredClone(f), pending = encode(f);
  f.operations[0].envelope.payload.values[0] = 99; f.operations = []; f.seed = 42; f.generator.configuration.later = true;
  const result = await pending;
  assert.deepEqual(result.fixture, before); assert.equal(result.sha256, digest(JSON.stringify(before))); frozen(result);
  assert.notEqual(result.fixture.definition, before.definition);
  assert.throws(() => result.fixture.operations[0].envelope.payload.values.push(9), TypeError);
});

test('canonical decoder refuses corruption, alternate representations and forged identity', async () => {
  const encoded = await encode(empty());
  for (const json of [' ' + encoded.json, encoded.json + '\n', '\uFEFF' + encoded.json, encoded.json.replace('"version":1', '"version":1,"version":1'), encoded.json.replace('"durationMs":0', '"durationMs":-0'), encoded.json.replace('"seed":1', '"seed":1.0'), encoded.json.replace('"test"', '"\\u0074est"'), '{', 'null']) {
    await assert.rejects(decode(json, digest(json)), { code: 'INVALID_REPLAY_FIXTURE' });
  }
  for (const hash of ['0'.repeat(64), encoded.sha256.toUpperCase(), '', null]) await assert.rejects(decode(encoded.json, hash), { code: 'INVALID_REPLAY_FIXTURE' });
  await assert.rejects(decode(new String(encoded.json), encoded.sha256), { code: 'INVALID_REPLAY_FIXTURE' });
});
