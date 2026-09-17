import assert from 'node:assert/strict';
import test from 'node:test';
import { makeLoops, samplePath, writeStrip, MAX_PATHS, POINTS } from './geometry.ts';

const settings = { count: 12, spread: 1, motion: 0.35, width: 0.018, seed: 7 };

test('loops are deterministic, closed, bounded and have monotonic arc distance', () => {
  const first = makeLoops(3, 16 / 9, settings);
  assert.deepEqual(first, makeLoops(3, 16 / 9, settings));
  assert.equal(first.paths.length, 12);
  for (const path of first.paths) {
    assert.equal(path.points.length, POINTS);
    const start = path.points[0]!;
    const end = path.points.at(-1)!;
    assert.ok(Math.hypot(start.x - end.x, start.y - end.y) < 1e-10);
    path.points.forEach((point, index) => {
      assert.ok([point.x, point.y, point.width, point.distance].every(Number.isFinite));
      assert.ok(point.width > 0);
      if (index) assert.ok(point.distance > path.points[index - 1]!.distance);
    });
  }
});

test('motion zero freezes paths and density changes preserve earlier identities', () => {
  const frozen = { ...settings, motion: 0 };
  assert.deepEqual(makeLoops(0, 1, frozen), makeLoops(100, 1, frozen));
  const a = makeLoops(2, 1, { ...settings, count: 3 });
  const b = makeLoops(2, 1, { ...settings, count: 6 });
  assert.deepEqual(a.paths, b.paths.slice(0, 3));
  assert.equal(makeLoops(0, 1, { ...settings, count: 100 }).paths.length, MAX_PATHS);
});

test('strip joins close without NaNs and collars wrap continuously', () => {
  const path = makeLoops(1, 1.5, settings).paths[0]!;
  const position = new Float32Array(POINTS * 6);
  const uv = new Float32Array(POINTS * 4);
  writeStrip(path.points, position, uv, 2);
  assert.ok(position.every(Number.isFinite));
  for (let i = 0; i < 6; i++) assert.equal(position[i], position[(POINTS - 1) * 6 + i]);
  assert.deepEqual(samplePath(path.points, 0), samplePath(path.points, 1));
  assert.deepEqual(samplePath(path.points, 0.25), samplePath(path.points, 1.25));
});

test('strip rejects over-capacity input and handles a stationary segment', () => {
  const point = { x: 0, y: 0, width: 0.02, distance: 0, depositionTime: 0 };
  const position = new Float32Array(12);
  const uv = new Float32Array(8);
  writeStrip([point, point], position, uv, 1);
  assert.ok(position.every(Number.isFinite));
  assert.throws(() => writeStrip([point, point, point], position, uv, 1), /capacity/);
});
