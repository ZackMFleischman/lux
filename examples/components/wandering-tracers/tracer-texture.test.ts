import assert from 'node:assert/strict';
import test from 'node:test';

import { packTracerTexture } from './tracer-texture.ts';
import type { PathsSnapshot } from './tracer-state.ts';

test('packs four bounded polylines and metadata into the renderer texture layout', () => {
  const points = Array.from({ length: 64 }, (_value, index) => ({
    x: index * 0.01,
    y: -index * 0.02,
    width: 0.006 + index * 0.0001,
    distance: index * 0.03,
    depositionTime: 4 + index * 0.1,
  }));
  const snapshot: PathsSnapshot = {
    version: 1,
    paths: Array.from({ length: 4 }, (_value, index) => ({
      id: index,
      generation: index + 2,
      styleSeed: 100 + index,
      birthTime: 4,
      lifetime: 12,
      phase: 0.4,
      opacity: 0.9 - index * 0.1,
      points,
    })),
  };
  const target = new Float32Array(260 * 4).fill(-1);

  packTracerTexture(snapshot, target);

  assert.equal(target[0], 0);
  assert.equal(Math.abs(target[1]!), 0);
  assert.ok(Math.abs(target[2]! - 0.006) < 1e-6);
  assert.ok(Math.abs(target[63 * 4]! - 0.63) < 1e-6);
  assert.deepEqual([target[256 * 4], target[256 * 4 + 2], target[256 * 4 + 3]], [64, 100, 2]);
  assert.ok(Math.abs(target[256 * 4 + 1]! - 0.9) < 1e-6);
  assert.deepEqual([target[259 * 4], target[259 * 4 + 2], target[259 * 4 + 3]], [64, 103, 5]);
  assert.ok(Math.abs(target[259 * 4 + 1]! - 0.6) < 1e-6);
  assert.equal(target.length, 1040);
});

test('clears stale texels when the next snapshot contains fewer paths', () => {
  const target = new Float32Array(260 * 4).fill(9);
  packTracerTexture({ version: 1, paths: [] }, target);
  assert.ok(target.every(value => value === 0));
});

test('rejects snapshots that exceed the shader texture budget', () => {
  const path = {
    id: 0,
    generation: 0,
    styleSeed: 7,
    birthTime: 0,
    lifetime: 10,
    phase: 0.2,
    opacity: 1,
    points: [{ x: 0, y: 0, width: 0.01, distance: 0, depositionTime: 0 }],
  };
  const target = new Float32Array(260 * 4);
  assert.throws(
    () => packTracerTexture({ version: 1, paths: Array.from({ length: 5 }, () => path) }, target),
    /at most 4 paths/,
  );
  assert.throws(
    () => packTracerTexture({ version: 1, paths: [{ ...path, points: Array.from({ length: 65 }, () => path.points[0]!) }] }, target),
    /at most 64 points/,
  );
});
