import assert from 'node:assert/strict';
import test from 'node:test';
import { createResourceLedger, resourceCapacities } from '../../packages/runtime/src/graph/resource-accounting.ts';
import type { ResourceCounts, ResourceLedger, ResourceReservation } from '../../packages/runtime/src/graph/resource-accounting.ts';

const zero = { allocations: 0, backend: 0, inputs: 0, frames: 0, captures: 0 };
const invalidCharges = { name: 'TypeError', message: 'Invalid resource charges' };
const invalidReservation = { name: 'TypeError', message: 'Invalid resource reservation' };
const reentry = { name: 'TypeError', message: 'Resource ledger reentry' };

function usable(ledger: ResourceLedger, expected: ResourceCounts): void {
  assert.deepEqual(ledger.snapshot(), expected);
  const token = ledger.reserve({ ...zero, captures: 1 });
  ledger.release(token);
  ledger.release(token);
  assert.deepEqual(ledger.snapshot(), expected);
}

test('captures charges and releases each authentic reservation exactly once', () => {
  const ledger = createResourceLedger();
  const charges = { ...zero, allocations: 1, backend: 1 };
  const a = ledger.reserve(charges);
  const b = ledger.reserve({ ...zero, inputs: 2 });
  charges.allocations = 8000;
  charges.backend = 8000;
  assert.deepEqual(ledger.snapshot(), { allocations: 1, backend: 1, inputs: 2, frames: 0, captures: 0 });
  assert.equal(ledger.release(a), undefined);
  assert.equal(ledger.release(a), undefined);
  assert.deepEqual(ledger.snapshot(), { allocations: 0, backend: 0, inputs: 2, frames: 0, captures: 0 });
  ledger.release(b);
  assert.deepEqual(ledger.snapshot(), zero);
});

test('snapshots and capabilities are immutable and do not expose accounting state', () => {
  const ledger = createResourceLedger();
  const snapshot = ledger.snapshot();
  const token = ledger.reserve({ ...zero, allocations: 1 });
  assert.deepEqual(snapshot, zero);
  assert.notEqual(snapshot, ledger.snapshot());
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(ledger));
  for (const method of Object.values(ledger)) assert.ok(Object.isFrozen(method));
  assert.ok(Object.isFrozen(resourceCapacities));
  assert.equal(Reflect.set(snapshot, 'allocations', 999), false);
  assert.equal(Reflect.set(resourceCapacities, 'allocations', 999), false);
  assert.equal(Object.getPrototypeOf(token), null);
  assert.deepEqual(Reflect.ownKeys(token), []);
  assert.ok(Object.isFrozen(token));
  assert.deepEqual(ledger.snapshot(), { allocations: 1, backend: 0, inputs: 0, frames: 0, captures: 0 });
  ledger.release(token);
});

test('full aggregate reservation rejects each overflow without changing totals', () => {
  const ledger = createResourceLedger();
  const full = ledger.reserve({ allocations: 8192, backend: 8192, inputs: 4096, frames: 16, captures: 16 });
  for (const field of ['allocations', 'backend', 'inputs', 'frames', 'captures'] as const) {
    assert.throws(() => ledger.reserve({ ...zero, [field]: 1 }), {
      name: 'RangeError', message: `Resource capacity exceeded: ${field}`,
    });
    assert.deepEqual(ledger.snapshot(), { allocations: 8192, backend: 8192, inputs: 4096, frames: 16, captures: 16 });
  }
  ledger.release(full);
  usable(ledger, zero);
});

test('later dimension overflow never partially increments earlier counters', () => {
  const ledger = createResourceLedger();
  const full = ledger.reserve({ ...zero, frames: 16 });
  assert.throws(() => ledger.reserve({ allocations: 1, backend: 2, inputs: 3, frames: 1, captures: 4 }), {
    name: 'RangeError', message: 'Resource capacity exceeded: frames',
  });
  usable(ledger, { allocations: 0, backend: 0, inputs: 0, frames: 16, captures: 0 });
  ledger.release(full);
  usable(ledger, zero);
});

const dimensions: ReadonlyArray<readonly [keyof ResourceCounts, number, ResourceCounts]> = [
  ['allocations', 8192, { allocations: 8192, backend: 0, inputs: 0, frames: 0, captures: 0 }],
  ['backend', 8192, { allocations: 0, backend: 8192, inputs: 0, frames: 0, captures: 0 }],
  ['inputs', 4096, { allocations: 0, backend: 0, inputs: 4096, frames: 0, captures: 0 }],
  ['frames', 16, { allocations: 0, backend: 0, inputs: 0, frames: 16, captures: 0 }],
  ['captures', 16, { allocations: 0, backend: 0, inputs: 0, frames: 0, captures: 16 }],
];
for (const [field, cap, fullVector] of dimensions) {
  test(`${field}: individual tokens reach the cap, reject cap+1, and remain releasable`, () => {
    const ledger = createResourceLedger();
    const tokens: ResourceReservation[] = [];
    for (let i = 0; i < cap; i++) tokens.push(ledger.reserve({ ...zero, [field]: 1 }));
    assert.equal(new Set(tokens).size, cap);
    assert.deepEqual(ledger.snapshot(), fullVector);
    assert.throws(() => ledger.reserve({ ...zero, [field]: 1 }), {
      name: 'RangeError', message: `Resource capacity exceeded: ${field}`,
    });
    assert.deepEqual(ledger.snapshot(), fullVector);
    for (const token of tokens) { ledger.release(token); ledger.release(token); }
    usable(ledger, zero);
    assert.throws(() => ledger.reserve({ ...zero, [field]: Number.MAX_SAFE_INTEGER }), {
      name: 'RangeError', message: `Resource capacity exceeded: ${field}`,
    });
    usable(ledger, zero);
  });
}

test('capacity errors use interface order and never unsafe addition', () => {
  const ledger = createResourceLedger();
  for (const [field] of dimensions) {
    const vector = { allocations: 8193, backend: 8193, inputs: 4097, frames: 17, captures: 17 };
    for (const [earlier] of dimensions) {
      if (earlier === field) break;
      vector[earlier] = 0;
    }
    assert.throws(() => ledger.reserve(vector), { name: 'RangeError', message: `Resource capacity exceeded: ${field}` });
    usable(ledger, zero);
  }
});

test('invalid values in every dimension reject without coercion and restore the guard', () => {
  const ledger = createResourceLedger();
  let conversions = 0;
  const coercible = { valueOf() { conversions++; return 1; } };
  const values: unknown[] = [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined, true, 1n, coercible];
  for (const [field] of dimensions) for (const value of values) {
    assert.throws(() => ledger.reserve({ ...zero, allocations: 1, [field]: value } as ResourceCounts), invalidCharges);
    usable(ledger, zero);
  }
  assert.equal(conversions, 0);
  assert.throws(() => ledger.reserve(zero), invalidCharges);
  usable(ledger, zero);
});

test('only exact ordinary own-data records are admitted and getters never execute', () => {
  const ledger = createResourceLedger();
  let getters = 0;
  const accessor = Object.defineProperty({ ...zero, allocations: 1 }, 'backend', { get() { getters++; return 0; } });
  const symbol = { ...zero, allocations: 1, [Symbol('extra')]: 0 };
  const missing = { allocations: 1, backend: 0, inputs: 0, frames: 0 };
  const inherited = Object.assign(Object.create({ captures: 0 }), missing);
  const shapes: unknown[] = [null, undefined, 1, 'counts', true, Symbol(), 1n, () => {}, [],
    Object.assign([], { ...zero, allocations: 1 }), new Date(), inherited, missing,
    { ...zero, allocations: 1, extra: 0 }, symbol, accessor];
  for (const shape of shapes) {
    assert.throws(() => ledger.reserve(shape as ResourceCounts), invalidCharges);
    usable(ledger, zero);
  }
  assert.equal(getters, 0);
  for (const record of [Object.freeze({ ...zero, allocations: 1 }),
    Object.assign(Object.create(null), { allocations: 1, backend: -0, inputs: -0, frames: -0, captures: -0 })]) {
    const token = ledger.reserve(record);
    assert.deepEqual(ledger.snapshot(), { allocations: 1, backend: 0, inputs: 0, frames: 0, captures: 0 });
    ledger.release(token);
    usable(ledger, zero);
  }
});

test('invalid prototype and key count reject before descriptor value inspection', () => {
  const ledger = createResourceLedger();
  let descriptors = 0;
  for (const target of [Object.assign(Object.create({}), { ...zero, allocations: 1 }),
    { ...zero, allocations: 1, extra: 0 }, { ...zero, allocations: 1, [Symbol()]: 0 },
    { allocations: 1, backend: 0, inputs: 0, frames: 0, other: 0 }]) {
    const request = new Proxy(target, { getOwnPropertyDescriptor(t, key) { descriptors++; return Reflect.getOwnPropertyDescriptor(t, key); } });
    assert.throws(() => ledger.reserve(request), invalidCharges);
    usable(ledger, zero);
  }
  assert.equal(descriptors, 0);
});

test('clones, foreign tokens and wrappers reject without reflecting or affecting either owner', () => {
  const ledger = createResourceLedger(), other = createResourceLedger();
  const token = ledger.reserve({ ...zero, allocations: 1 });
  const foreign = other.reserve({ ...zero, backend: 1 });
  let traps = 0;
  const wrapper = new Proxy(token, {
    getPrototypeOf() { traps++; throw new Error('reflection'); },
    ownKeys() { traps++; throw new Error('reflection'); },
    getOwnPropertyDescriptor() { traps++; throw new Error('reflection'); },
  });
  const revoked = Proxy.revocable(token, {}); revoked.revoke();
  const invalid: unknown[] = [null, undefined, 1, 'token', true, Symbol(), 1n, {}, Object.create(null),
    { ...token }, structuredClone(token), Object.freeze(Object.create(null)), wrapper, revoked.proxy, foreign];
  for (const candidate of invalid) {
    assert.throws(() => ledger.release(candidate as ResourceReservation), invalidReservation);
    usable(ledger, { allocations: 1, backend: 0, inputs: 0, frames: 0, captures: 0 });
    assert.deepEqual(other.snapshot(), { allocations: 0, backend: 1, inputs: 0, frames: 0, captures: 0 });
  }
  assert.equal(traps, 0);
  ledger.release(token); other.release(foreign);
  usable(ledger, zero); usable(other, zero);
});

const hooks = ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor'] as const;
function trapped(action: () => void, hook: typeof hooks[number]): ResourceCounts {
  const handler: ProxyHandler<ResourceCounts> = {
    getPrototypeOf(target) { if (hook === 'getPrototypeOf') action(); return Reflect.getPrototypeOf(target); },
    ownKeys(target) { if (hook === 'ownKeys') action(); return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) { if (hook === 'getOwnPropertyDescriptor') action(); return Reflect.getOwnPropertyDescriptor(target, key); },
  };
  return new Proxy({ ...zero, backend: 1 }, handler);
}

for (const hook of hooks) for (const operation of ['reserve', 'release'] as const) {
  for (const caught of [true, false]) {
    test(`${hook}: ${caught ? 'caught' : 'propagated'} nested ${operation} rejects before reflection`, () => {
      const ledger = createResourceLedger();
      const held = ledger.reserve({ ...zero, allocations: 1 });
      let calls = 0, nestedReflections = 0;
      const nested = trapped(() => { nestedReflections++; }, 'getPrototypeOf');
      const action = () => operation === 'reserve' ? ledger.reserve(nested) : ledger.release(held);
      const request = trapped(() => {
        calls++;
        assert.deepEqual(ledger.snapshot(), { allocations: 1, backend: 0, inputs: 0, frames: 0, captures: 0 });
        if (caught) assert.throws(action, reentry); else action();
      }, hook);
      if (caught) {
        const pending = ledger.reserve(request);
        assert.equal(calls, hook === 'getOwnPropertyDescriptor' ? 5 : 1);
        assert.deepEqual(ledger.snapshot(), { allocations: 1, backend: 1, inputs: 0, frames: 0, captures: 0 });
        ledger.release(pending);
      } else {
        assert.throws(() => ledger.reserve(request), reentry);
        assert.equal(calls, 1);
      }
      assert.equal(nestedReflections, 0);
      usable(ledger, { allocations: 1, backend: 0, inputs: 0, frames: 0, captures: 0 });
      ledger.release(held);
      usable(ledger, zero);
    });
  }
}

for (const hook of hooks) {
  test(`${hook}: arbitrary throwing traps restore the guard and preserve existing tokens`, () => {
    const ledger = createResourceLedger();
    const held = ledger.reserve({ ...zero, inputs: 2 });
    const sentinel = new Error('trap failure');
    assert.throws(() => ledger.reserve(trapped(() => { throw sentinel; }, hook)), error => error === sentinel);
    usable(ledger, { allocations: 0, backend: 0, inputs: 2, frames: 0, captures: 0 });
    ledger.release(held);
    usable(ledger, zero);
  });
}

test('other ledgers can reserve and release during caller reflection', () => {
  const ledger = createResourceLedger(), other = createResourceLedger();
  const held = other.reserve({ ...zero, inputs: 2 });
  let calls = 0;
  const token = ledger.reserve(trapped(() => {
    calls++;
    other.release(held);
    const independent = other.reserve({ ...zero, frames: 1 });
    assert.deepEqual(other.snapshot(), { allocations: 0, backend: 0, inputs: 0, frames: 1, captures: 0 });
    other.release(independent);
  }, 'getPrototypeOf'));
  assert.equal(calls, 1);
  ledger.release(token);
  usable(ledger, zero); usable(other, zero);
});

// Compile-time opacity is independent of the runtime forgery tests above.
if (false) {
  // @ts-expect-error Structural objects cannot construct the private reservation brand.
  const forged: ResourceReservation = {};
  void forged;
  // @ts-expect-error Counts cannot be used as an authentic reservation.
  createResourceLedger().release(zero);
}
