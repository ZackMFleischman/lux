import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTracerGenerator,
  stepTracerGenerator,
  type TracerControls,
} from './tracer-state.ts';

const controls: TracerControls = {
  count: 2,
  speed: 1,
  curl: 1,
  sway: 0.7,
  seed: 17,
  width: 0.045,
  pace: 1,
};

test('grows deterministic perimeter paths with scene-time deposition stamps', () => {
  const left = createTracerGenerator(16 / 9, 91);
  const right = createTracerGenerator(16 / 9, 91);

  const initial = stepTracerGenerator(left, { timeSeconds: 10, deltaSeconds: 0 }, controls);
  const matchingInitial = stepTracerGenerator(right, { timeSeconds: 10, deltaSeconds: 0 }, controls);
  assert.deepEqual(initial, matchingInitial);
  assert.equal(initial.version, 1);
  assert.equal(initial.paths.length, 2);

  for (const path of initial.paths) {
    assert.equal(path.points.length, 1);
    const point = path.points[0]!;
    const onVerticalEdge = Math.abs(Math.abs(point.x) - 8 / 9) < 1e-9;
    const onHorizontalEdge = Math.abs(Math.abs(point.y) - 0.5) < 1e-9;
    assert.ok(onVerticalEdge || onHorizontalEdge, 'the first point is on the canvas perimeter');
    assert.equal(point.distance, 0);
    assert.equal(point.depositionTime, 10);
  }

  const grown = stepTracerGenerator(left, { timeSeconds: 11, deltaSeconds: 1 }, controls);
  const matchingGrown = stepTracerGenerator(right, { timeSeconds: 11, deltaSeconds: 1 }, controls);
  assert.deepEqual(grown, matchingGrown);
  for (const path of grown.paths) {
    assert.ok(path.points.length > 1 && path.points.length <= 64);
    assert.ok(path.points.every((point, index, points) =>
      Number.isFinite(point.x) && Number.isFinite(point.y) && point.width > 0 &&
      point.depositionTime >= 10 && point.depositionTime <= 11 &&
      (index === 0 || point.distance > points[index - 1]!.distance)));
    assert.equal(path.points.at(-1)!.distance, Math.max(...path.points.map(point => point.distance)));
  }
});

test('uses pace for growth without converting deposition times to artistic time', () => {
  const generator = createTracerGenerator(1, 5);
  stepTracerGenerator(generator, { timeSeconds: 20, deltaSeconds: 0 }, { ...controls, count: 1 });
  const slow = stepTracerGenerator(generator, { timeSeconds: 22, deltaSeconds: 2 }, {
    ...controls,
    count: 1,
    pace: 0.25,
  });
  const slowHead = slow.paths[0]!.points.at(-1)!;
  assert.ok(slowHead.depositionTime > 20 && slowHead.depositionTime <= 22);

  const fast = stepTracerGenerator(generator, { timeSeconds: 23, deltaSeconds: 1 }, {
    ...controls,
    count: 1,
    pace: 2,
  });
  const newPoints = fast.paths[0]!.points.filter(point => point.distance > slowHead.distance);
  assert.ok(newPoints.length > 0);
  assert.ok(newPoints.every(point => point.depositionTime >= 22 && point.depositionTime <= 23));
});

test('count zero removes all paths and re-enabling starts fresh generations', () => {
  const generator = createTracerGenerator(1.5, 12);
  const first = stepTracerGenerator(generator, { timeSeconds: 0, deltaSeconds: 0 }, {
    ...controls,
    count: 1,
  });
  assert.equal(first.paths.length, 1);

  const hidden = stepTracerGenerator(generator, { timeSeconds: 1, deltaSeconds: 1 }, {
    ...controls,
    count: 0,
  });
  assert.deepEqual(hidden.paths, []);

  const restarted = stepTracerGenerator(generator, { timeSeconds: 2, deltaSeconds: 1 }, {
    ...controls,
    count: 1,
  });
  assert.equal(restarted.paths.length, 1);
  assert.equal(restarted.paths[0]!.id, first.paths[0]!.id);
  assert.ok(restarted.paths[0]!.generation > first.paths[0]!.generation);
  assert.equal(restarted.paths[0]!.birthTime, 2);
  assert.equal(restarted.paths[0]!.points.length, 1);
});

test('keeps the final deposition timestamp stable while a completed path fades', () => {
  const generator = createTracerGenerator(1, 27);
  const fast = { ...controls, count: 1, speed: 2 };
  let time = 0;
  let snapshot = stepTracerGenerator(generator, { timeSeconds: time, deltaSeconds: 0 }, fast);
  while (snapshot.paths[0]!.phase < 0.72) {
    time += 0.25;
    snapshot = stepTracerGenerator(generator, { timeSeconds: time, deltaSeconds: 0.25 }, fast);
  }
  const depositedAt = snapshot.paths[0]!.points.at(-1)!.depositionTime;
  time += 0.1;
  const fading = stepTracerGenerator(generator, { timeSeconds: time, deltaSeconds: 0.1 }, fast);
  assert.equal(fading.paths[0]!.points.at(-1)!.depositionTime, depositedAt);
});

test('preserves the painting’s broad curling route and fine tapered width', () => {
  const generator = createTracerGenerator(16 / 9, 91);
  const painting = { ...controls, count: 1, curl: 2.5, width: 0.021, sway: 0 };
  stepTracerGenerator(generator, { timeSeconds: 0, deltaSeconds: 0 }, painting);
  const path = stepTracerGenerator(generator, { timeSeconds: 20, deltaSeconds: 20 }, painting).paths[0]!;
  const first = path.points[0]!, last = path.points.at(-1)!;
  const dx = last.x - first.x, dy = last.y - first.y;
  const deviation = Math.max(...path.points.map(p => Math.abs(dx * (p.y - first.y) - dy * (p.x - first.x)) / Math.hypot(dx, dy)));
  assert.ok(deviation > 0.08, 'the drawing must curl visibly instead of becoming a straight thick bar');
  assert.ok(last.width < 0.007, 'the growing head remains fine');
  assert.ok(path.points.some(p => p.width > last.width * 2));
  assert.ok(path.points.every(p => p.width < 0.03));
});
