import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../../packages/runtime/src/seed.ts';

test('same uint32 seed reproduces the stream after reset, including canonical seed zero', () => {
  for (const seed of [0, 1, 0xffffffff]) {
    const first = new SeededRandom(seed), second = new SeededRandom(seed);
    const expected = Array.from({ length: 20 }, () => first.next());
    assert.deepEqual(Array.from({ length: 20 }, () => second.next()), expected);
    first.reset();
    assert.deepEqual(Array.from({ length: 20 }, () => first.next()), expected);
    assert.ok(expected.every(value => Number.isFinite(value) && value >= 0 && value < 1));
    assert.ok(new Set(expected).size > 1);
  }
});

test('independent streams and seed replacement do not mutate another instance', () => {
  const left = new SeededRandom(42), right = new SeededRandom(42);
  const expected = right.next();
  left.next(); left.next(); left.reset(8);
  assert.notEqual(left.next(), expected);
  right.reset();
  assert.equal(right.next(), expected);
  left.reset(42);
  assert.equal(left.next(), expected);
});

test('invalid seeds are rejected instead of silently truncating creative state', () => {
  const stream = new SeededRandom(8), reference = new SeededRandom(8);
  for (const invalid of [-1, 0x100000000, 0.5, NaN, Infinity]) {
    assert.throws(() => new SeededRandom(invalid), /seed/i);
    assert.throws(() => stream.reset(invalid), /seed/i);
  }
  assert.equal(stream.next(), reference.next());
});
