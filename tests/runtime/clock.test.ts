import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeClock } from '../../packages/runtime/src/clock.ts';

test('paused animation time remains frozen despite elapsed monotonic time', () => {
  let now = 1000;
  const clock = new RuntimeClock(() => now);
  assert.deepEqual(clock.snapshot(), { playback: 'paused', timeSeconds: 0, clockEpoch: 0 });
  now = 61000;
  assert.equal(clock.snapshot().timeSeconds, 0);
  clock.play(); now += 1500;
  assert.equal(clock.pause().timeSeconds, 1.5);
  now += 90000;
  assert.equal(clock.snapshot().timeSeconds, 1.5);
});

test('resume excludes every paused interval and repeated play or pause does not restart time', () => {
  let now = 0;
  const clock = new RuntimeClock(() => now);
  clock.play(); now = 1000;
  assert.equal(clock.play().timeSeconds, 1);
  now = 2000; clock.pause(); now = 5000;
  assert.equal(clock.pause().timeSeconds, 2);
  now = 6000; clock.play(); now = 6500;
  assert.deepEqual(clock.snapshot(), { playback: 'playing', timeSeconds: 2.5, clockEpoch: 0 });
});

test('reset returns time zero and a new epoch while retaining either playback state', () => {
  let now = 100;
  const clock = new RuntimeClock(() => now, 'playing');
  now = 1100;
  assert.deepEqual(clock.reset(), { playback: 'playing', timeSeconds: 0, clockEpoch: 1 });
  now = 1600;
  assert.equal(clock.snapshot().timeSeconds, 0.5);
  clock.pause(); now = 9000;
  assert.deepEqual(clock.reset(), { playback: 'paused', timeSeconds: 0, clockEpoch: 2 });
  now = 10000;
  assert.equal(clock.snapshot().timeSeconds, 0);
});

test('backwards or invalid clock samples fail explicitly without corrupting animation state', () => {
  let now = 1000;
  const clock = new RuntimeClock(() => now, 'playing');
  now = 1500; const before = clock.snapshot();
  for (const invalid of [1400, NaN, Infinity, -1]) {
    now = invalid;
    assert.throws(() => clock.reset(), /monotonic/i);
  }
  now = 2000;
  assert.deepEqual(clock.snapshot(), { playback: 'playing', timeSeconds: 1, clockEpoch: 0 });
  assert.deepEqual(before, { playback: 'playing', timeSeconds: 0.5, clockEpoch: 0 });
});
