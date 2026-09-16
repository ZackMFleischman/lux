import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePaths2DSnapshot } from '../../packages/runtime-contracts/src/paths2d.mjs';
import { normalizeComponentDeclaration } from '../../packages/runtime-contracts/src/components.mjs';

const point = (distance = 0) => ({ x: 0.25, y: -0.5, width: 0.02, distance, depositionTime: 1.5 });
const snapshot = () => ({ version: 1, paths: [{
  id: 7, generation: 2, styleSeed: 19, birthTime: 1, lifetime: 4, phase: 0.25, opacity: 0.8,
  points: [point(0), { ...point(0.5), x: 0.5 }],
}] });

test('paths2d normalization returns a detached deeply frozen frame snapshot', () => {
  const input = snapshot();
  const normalized = normalizePaths2DSnapshot(input);
  assert.deepEqual(normalized, input);
  assert.notEqual(normalized, input);
  assert.notEqual(normalized.paths, input.paths);
  assert.notEqual(normalized.paths[0], input.paths[0]);
  assert.notEqual(normalized.paths[0].points, input.paths[0].points);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.paths), true);
  assert.equal(Object.isFrozen(normalized.paths[0]), true);
  assert.equal(Object.isFrozen(normalized.paths[0].points), true);
  assert.equal(Object.isFrozen(normalized.paths[0].points[0]), true);
  input.paths[0].points[0].x = 99;
  assert.equal(normalized.paths[0].points[0].x, 0.25);
});

test('paths2d normalization rejects malformed identities, values, ordering and bounds', () => {
  const cases = [
    value => { value.version = 2; },
    value => { value.extra = true; },
    value => { value.paths[0].id = -1; },
    value => { value.paths[0].generation = 1.5; },
    value => { value.paths[0].styleSeed = Number.MAX_SAFE_INTEGER + 1; },
    value => { value.paths[0].birthTime = Infinity; },
    value => { value.paths[0].lifetime = Infinity; },
    value => { value.paths[0].phase = NaN; },
    value => { value.paths[0].opacity = -Infinity; },
    value => { value.paths[0].points[0].width = NaN; },
    value => { value.paths[0].points[1].distance = -1; },
    value => { value.paths = Array.from({ length: 33 }, (_, id) => ({ ...snapshot().paths[0], id })); },
    value => { value.paths[0].points = Array.from({ length: 257 }, (_, index) => point(index)); },
  ];
  for (const mutate of cases) {
    const value = snapshot();
    mutate(value);
    assert.throws(() => normalizePaths2DSnapshot(value), /paths2d/i);
  }
  const accessor = snapshot();
  Object.defineProperty(accessor.paths[0], 'opacity', { enumerable: true, get() { throw Error('must not run'); } });
  assert.throws(() => normalizePaths2DSnapshot(accessor), /paths2d/i);
});

test('component metadata admits only the canonical paths2d port descriptor', () => {
  const base = {
    declarationVersion: 1, key: 'demo/path-source', label: 'Path source', description: 'Produces paths', tags: [],
    inputs: {}, outputs: { paths: { type: { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' }, label: 'Paths', description: 'Tracer paths' } },
    controls: {}, controlDescriptions: {}, lifecycle: { state: 'stateful', reset: 'seed' },
  };
  const metadata = normalizeComponentDeclaration(base);
  assert.deepEqual(metadata.outputs.paths.type, { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' });
  for (const type of [
    { kind: 'paths2d', version: 2, coordinateSpace: 'canvas-height' },
    { kind: 'paths2d', version: 1, coordinateSpace: 'pixels' },
    { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height', extra: true },
  ]) assert.throws(() => normalizeComponentDeclaration({ ...base, outputs: { paths: { ...base.outputs.paths, type } } }), /port|paths2d|unsupported/i);
});
