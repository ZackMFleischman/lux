import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodeScriptedReplayFixture as encode } from '../../packages/inputs/src/replay-fixture.mjs';
import { createScriptedReplayCursor as create, inspectScriptedReplayCursor as inspect, advanceScriptedReplayCursor as advance, resetScriptedReplayCursor as reset, seekScriptedReplayCursor as seek, replayCursorLimits as limits } from '../../packages/inputs/src/replay-cursor.mjs';

const empty = (durationMs = 10) => ({ version: 1, mode: 'scripted', durationMs, originEpoch: 0, seed: 1, generator: { id: 'test', version: '1', configuration: {} }, mapping: { version: 2, mapping: { version: 1, targets: [], bindings: [] }, smoothing: [] }, authority: 'studio', base: [], definition: { version: 1, sources: [], signals: [] }, sourceConfigs: [], operations: [] });
const budget = { evaluations: limits.evaluations, events: limits.events, work: limits.work };
const cursor = async (f = empty(), epoch = 7) => { const e = await encode(f); return create(e.json, e.sha256, epoch); };
const req = () => ({ runtimeEpoch: 7, previousMs: 0, nextMs: 10, budget: { ...budget } });
const invalid = fn => assert.throws(fn, e => e.code === 'INVALID_REPLAY_CURSOR' && e.path.length <= 200 && e.message.length <= 512);
const quota = fn => assert.throws(fn, { code: 'REPLAY_CURSOR_QUOTA_EXCEEDED' });

test('construction captures primitive JSON/hash/epoch and retains fixture decoder errors', async () => {
  const e = await encode(empty());
  for (const v of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '7', null, {}]) await assert.rejects(create(e.json, e.sha256, v), { code: 'INVALID_REPLAY_CURSOR' });
  for (const args of [[new String(e.json), e.sha256], [e.json, new String(e.sha256)], [e.json, '0'.repeat(64)], [' ' + e.json, e.sha256], [e, e.sha256]]) await assert.rejects(create(...args, 7), { code: 'INVALID_REPLAY_FIXTURE' });
  let json = e.json, hash = e.sha256, epoch = 7;
  const pending = create(json, hash, epoch); json = '{}'; hash = '0'.repeat(64); epoch = 100;
  const c = await pending; assert.equal(inspect(c).runtimeEpoch, 7); assert.equal(inspect(c).fixtureHash, e.sha256);
});

test('exact request records reject accessors, hidden/symbol/extra/exotic fields without invoking getters', async () => {
  const c = await cursor(), before = inspect(c); let reads = 0;
  const variants = [null, [], new Date(), Object.assign(Object.create({ inherited: true }), req()), { ...req(), base: [] }, { ...req(), hostValues: [] }, { ...req(), authority: 'host' }, { ...req(), extra: 1 }, { ...req(), [Symbol('x')]: 1 }];
  for (const key of ['runtimeEpoch', 'previousMs', 'nextMs', 'budget']) {
    const accessor = req(); Object.defineProperty(accessor, key, { enumerable: true, get() { reads++; throw Error('getter invoked'); } }); variants.push(accessor);
    const missing = req(); delete missing[key]; variants.push(missing);
  }
  const hidden = req(); Object.defineProperty(hidden, 'nextMs', { value: 10, enumerable: false }); variants.push(hidden);
  for (const value of variants) invalid(() => advance(c, value));
  for (const kind of ['evaluations', 'events', 'work']) {
    const r = req(); Object.defineProperty(r.budget, kind, { enumerable: true, get() { reads++; return 9; } }); invalid(() => advance(c, r));
  }
  for (const b of [[], null, { ...budget, extra: 0 }, { ...budget, evaluations: -1 }, { ...budget, events: 1.5 }, { ...budget, work: Infinity }]) invalid(() => advance(c, { ...req(), budget: b }));
  assert.equal(reads, 0); assert.deepEqual(inspect(c), before);
  const nullProto = Object.assign(Object.create(null), req()); assert.equal(advance(c, nullProto).nextMs, 10);
});

test('all methods reject forged handles before touching request properties', async () => {
  const c = await cursor(); let reads = 0;
  const trap = { get runtimeEpoch() { reads++; return 7; } };
  for (const handle of [{}, structuredClone(c), new Proxy(c, {}), 0, null]) {
    invalid(() => advance(handle, trap)); invalid(() => reset(handle, trap)); invalid(() => seek(handle, trap));
  }
  assert.equal(reads, 0);
});

// Reflection can execute caller code even when a Proxy reports ordinary own
// data. Publishing from a pre-reflection snapshot would lose the nested commit.
for (const [method, mutate] of Object.entries({ advance, reset, seek })) {
  for (const location of method === 'reset' ? ['request'] : ['request', 'budget']) {
    for (const trap of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) {
      for (const nested of ['reset', 'seek', 'advance', 'zero']) {
        test(`${method} preserves nested ${nested} committed by ${location}.${trap}`, async () => {
          const c = await cursor(); let fired = false, inner;
          const r = method === 'advance' ? req() : method === 'reset'
            ? { runtimeEpoch: 7, nextEpoch: 8 }
            : { runtimeEpoch: 7, nextEpoch: 8, nextMs: 10, budget: { ...budget } };
          const handler = { [trap](...args) {
            if (!fired) {
              fired = true;
              inner = nested === 'reset' ? reset(c, { runtimeEpoch: 7, nextEpoch: 9 })
                : nested === 'seek' ? seek(c, { runtimeEpoch: 7, nextEpoch: 9, nextMs: 5, budget })
                : advance(c, { ...req(), nextMs: nested === 'zero' ? 0 : 5 });
            }
            return Reflect[trap](...args);
          } };
          const input = location === 'request' ? new Proxy(r, handler)
            : { ...r, budget: new Proxy(r.budget, handler) };
          invalid(() => mutate(c, input));
          assert.equal(fired, true);
          const expected = inner.view ?? inner;
          assert.equal(expected.runtimeEpoch, nested === 'reset' || nested === 'seek' ? 9 : 7);
          assert.equal(expected.positionMs, nested === 'reset' || nested === 'zero' ? 0 : 5);
          assert.equal(expected.zeroConsumed, nested !== 'reset');
          assert.deepEqual(inspect(c), expected);
          // The inner transaction remains usable, including its consumed zero
          // batch: successful nested advances cannot be silently rolled back.
          const tail = advance(c, { runtimeEpoch: expected.runtimeEpoch, previousMs: expected.positionMs, nextMs: 10, budget });
          assert.equal(tail.evaluations.filter(row => row.reason === 'initial').length, nested === 'reset' ? 1 : 0);
        });
      }
    }
  }
}

test('reflection without a successful nested mutation leaves the outer request usable', async () => {
  const c = await cursor(); let fired = false;
  const input = new Proxy(req(), { ownKeys(target) {
    if (!fired) {
      fired = true;
      assert.equal(inspect(c).runtimeEpoch, 7);
      quota(() => seek(c, { runtimeEpoch: 7, nextEpoch: 9, nextMs: 10, budget: { evaluations: 0, events: 0, work: 0 } }));
    }
    return Reflect.ownKeys(target);
  } });
  const result = advance(c, input);
  assert.equal(result.view.runtimeEpoch, 7); assert.equal(result.view.positionMs, 10);
});

test('rejected outer advance preserves nested zero-batch event consumption', async () => {
  const f = empty(), source = { sourceId: 'a', signalId: 'note' };
  f.definition = { version: 1, sources: [{ sourceId: 'a', generation: 0, connected: true, calibrationId: 'cal0' }], signals: [{ source, kind: 'event' }] };
  f.sourceConfigs = [{ sourceId: 'a', calibrationId: 'cal0', configuration: {} }];
  f.operations = [0, 1].map(sequence => ({ kind: 'input', atMs: 0, envelope: { version: 1, epoch: 0, source, generation: 0, calibrationId: 'cal0', sequence, timestampMs: 0, kind: 'event', payload: { type: 'note', values: [0.5] } } }));
  const c = await cursor(f); let inner;
  const input = { ...req(), budget: new Proxy({ ...budget }, { ownKeys(target) {
    inner = advance(c, { ...req(), nextMs: 0 });
    return Reflect.ownKeys(target);
  } }) };
  invalid(() => advance(c, input));
  assert.equal(inner.events.length, 2);
  assert.deepEqual(inner.events.map(event => event.operationIndex), [0, 1]);
  assert.deepEqual(inspect(c), inner.view);
  const result = advance(c, req());
  assert.equal(result.events.length, 0);
  assert.equal(result.evaluations.filter(row => row.reason === 'initial').length, 0);
});

test('fractional times, negative zero and exact epoch/position checks include repeated-time no-ops', async () => {
  const c = await cursor();
  const r = advance(c, { ...req(), previousMs: -0, nextMs: 0.25 }); assert.equal(r.previousMs, 0); assert.equal(r.nextMs, 0.25);
  for (const change of [{ runtimeEpoch: 6 }, { previousMs: 0 }, { nextMs: 0 }, { nextMs: 10.1 }, { nextMs: NaN }, { runtimeEpoch: 7.5 }]) invalid(() => advance(c, { ...req(), previousMs: 0.25, nextMs: 0.25, ...change }));
  const noOp = advance(c, { runtimeEpoch: 7, previousMs: 0.25, nextMs: 0.25, budget: { evaluations: 0, events: 0, work: 0 } }); assert.equal(noOp.work, 0);
  invalid(() => advance(c, { runtimeEpoch: 6, previousMs: 0.25, nextMs: 0.25, budget: { evaluations: 0, events: 0, work: 0 } }));
  for (const kind of ['evaluations', 'events', 'work']) quota(() => advance(c, { runtimeEpoch: 7, previousMs: 0.25, nextMs: 0.25, budget: { ...budget, [kind]: limits[kind] + 1 } }));
});

test('reset/seek require exact fields and increasing safe epochs; failed seek preserves previous epoch', async () => {
  const c = await cursor(), before = inspect(c);
  for (const nextEpoch of [7, 6, NaN, Infinity, 7.5, Number.MAX_SAFE_INTEGER + 1]) {
    invalid(() => reset(c, { runtimeEpoch: 7, nextEpoch })); invalid(() => seek(c, { runtimeEpoch: 7, nextEpoch, nextMs: 0, budget }));
  }
  invalid(() => reset(c, { runtimeEpoch: 7, nextEpoch: 8, base: [] })); invalid(() => seek(c, { runtimeEpoch: 7, nextEpoch: 8, nextMs: 11, budget }));
  quota(() => seek(c, { runtimeEpoch: 7, nextEpoch: 8, nextMs: 10, budget: { evaluations: 1, events: 0, work: 2 } })); assert.deepEqual(inspect(c), before);
  assert.equal(advance(c, req()).view.runtimeEpoch, 7);
  const max = reset(c, { runtimeEpoch: 7, nextEpoch: Number.MAX_SAFE_INTEGER }); assert.equal(max.runtimeEpoch, Number.MAX_SAFE_INTEGER);
  invalid(() => reset(c, { runtimeEpoch: Number.MAX_SAFE_INTEGER, nextEpoch: Number.MAX_SAFE_INTEGER + 1 }));
});

test('work/evaluation preflights reject without partial position or zero-batch publication', async () => {
  const c = await cursor(), before = inspect(c);
  for (const b of [{ evaluations: 1, events: 0, work: 2 }, { evaluations: 2, events: 0, work: 1 }]) { quota(() => advance(c, { ...req(), budget: b })); assert.deepEqual(inspect(c), before); }
  const result = advance(c, { ...req(), budget: { evaluations: 2, events: 0, work: 2 } }); assert.equal(result.work, 2); assert.equal(result.evaluations.length, 2);
});

// Exercise private accounting in an isolated copy, never a production export.
// Limits on operation/metadata shape may dominate before a legal 16MiB result.
async function accountingModule() {
  const url = new URL('../../packages/inputs/src/replay-cursor.mjs', import.meta.url), original = await readFile(url, 'utf8');
  const dir = await mkdtemp(join(tmpdir(), 'lux-replay-accounting-'));
  const relocated = original.replaceAll("from './replay-fixture.mjs'", `from '${new URL('./replay-fixture.mjs', url).href}'`).replaceAll("from './mapping.mjs'", `from '${new URL('./mapping.mjs', url).href}'`);
  const path = join(dir, 'cursor.mjs');
  await writeFile(path, relocated + '\nexport { chargeResult, jsonBytes };\n');
  return { module: await import(pathToFileURL(path)), original, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
test('exact UTF8 publication guard accepts limit equality and rejects +1 before publication', async () => {
  const copy = await accountingModule();
  try {
    const { chargeResult, jsonBytes } = copy.module;
    assert.equal(chargeResult(limits.resultBytes - 1, 1), limits.resultBytes); quota(() => chargeResult(limits.resultBytes, 1));
    for (const value of [{ text: '\u0000Ω😀"\\', a: [1e-9, null, true, false, -0] }, { view: { values: [] }, events: [] }]) assert.equal(jsonBytes(value), Buffer.byteLength(JSON.stringify(value)));
    // Prove a real return path charges the same guard: a copied implementation
    // with the cap reduced below its real skeleton rejects and retains state.
    const dir = await mkdtemp(join(tmpdir(), 'lux-replay-quota-'));
    try {
      const owner = new URL('../../packages/inputs/src/replay-cursor.mjs', import.meta.url);
      const source = copy.original.replace('resultBytes: 16777216', 'resultBytes: 1').replaceAll("from './replay-fixture.mjs'", `from '${new URL('./replay-fixture.mjs', owner).href}'`).replaceAll("from './mapping.mjs'", `from '${new URL('./mapping.mjs', owner).href}'`);
      const file = join(dir, 'cursor.mjs'); await writeFile(file, source); const m = await import(pathToFileURL(file));
      const e = await encode(empty()), c = await m.createScriptedReplayCursor(e.json, e.sha256, 7), before = m.inspectScriptedReplayCursor(c);
      quota(() => m.advanceScriptedReplayCursor(c, req())); assert.deepEqual(m.inspectScriptedReplayCursor(c), before);
    } finally { await rm(dir, { recursive: true, force: true }); }
  } finally { await copy.cleanup(); }
});

test('complete result accounting includes nested value/event copies and all exact delimiters', async () => {
  const f = empty(), target = { sceneId: '11111111-1111-4111-8111-111111111111', nodePath: [], controlId: 'gain' };
  f.mapping.mapping.targets = [{ target, definition: { id: 'gain', type: 'number', label: 'Gain', default: 0, min: 0, max: 1, changeCost: 'live' } }]; f.base = [{ target, value: 0.75 }];
  const source = { sourceId: 'a', signalId: 'note' };
  f.definition = { version: 1, sources: [{ sourceId: 'a', generation: 0, connected: true, calibrationId: 'cal0' }], signals: [{ source, kind: 'event' }] };
  f.sourceConfigs = [{ sourceId: 'a', calibrationId: 'cal0', configuration: {} }];
  f.operations = [0, 1].map(sequence => ({ kind: 'input', atMs: 0, envelope: { version: 1, epoch: 0, source, generation: 0, calibrationId: 'cal0', sequence, timestampMs: 0, kind: 'event', payload: { type: 'note', values: [1e-9, 0.5] } } }));
  const e = await encode(f), real = await create(e.json, e.sha256, 123456789), r = { ...req(), runtimeEpoch: 123456789 }, result = advance(real, r), size = Buffer.byteLength(JSON.stringify(result));
  const copy = await accountingModule();
  try {
    for (const cap of [size, size - 1]) {
      const dir = await mkdtemp(join(tmpdir(), 'lux-replay-exact-output-'));
      try {
        const owner = new URL('../../packages/inputs/src/replay-cursor.mjs', import.meta.url);
        const source = copy.original.replace('resultBytes: 16777216', `resultBytes: ${cap}`).replaceAll("from './replay-fixture.mjs'", `from '${new URL('./replay-fixture.mjs', owner).href}'`).replaceAll("from './mapping.mjs'", `from '${new URL('./mapping.mjs', owner).href}'`);
        const file = join(dir, 'cursor.mjs'); await writeFile(file, source); const m = await import(pathToFileURL(file));
        const c = await m.createScriptedReplayCursor(e.json, e.sha256, 123456789), before = m.inspectScriptedReplayCursor(c);
        invalid(() => m.inspectScriptedReplayCursor(real));
        if (cap === size) assert.deepEqual(m.advanceScriptedReplayCursor(c, r), result);
        else { quota(() => m.advanceScriptedReplayCursor(c, r)); assert.deepEqual(m.inspectScriptedReplayCursor(c), before); }
      } finally { await rm(dir, { recursive: true, force: true }); }
    }
  } finally { await copy.cleanup(); }
});
