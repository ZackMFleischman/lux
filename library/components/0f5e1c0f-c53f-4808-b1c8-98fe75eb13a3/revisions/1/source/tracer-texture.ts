import type { PathsSnapshot } from './tracer-state.ts';

export const TRACER_TEXTURE_WIDTH = 260;
const MAX_PATHS = 4;
const MAX_POINTS = 64;

export function packTracerTexture(snapshot: PathsSnapshot, target: Float32Array): void {
  if (target.length !== TRACER_TEXTURE_WIDTH * 4) {
    throw Error(`Tracer texture requires ${TRACER_TEXTURE_WIDTH * 4} float values`);
  }
  if (snapshot.paths.length > MAX_PATHS) {
    throw Error(`Tracer renderer accepts at most ${MAX_PATHS} paths`);
  }
  const oversizedPath = snapshot.paths.find(path => path.points.length > MAX_POINTS);
  if (oversizedPath) {
    throw Error(`Tracer renderer accepts at most ${MAX_POINTS} points per path; path ${oversizedPath.id} has ${oversizedPath.points.length}`);
  }
  target.fill(0);
  snapshot.paths.forEach((path, pathIndex) => {
    const points = path.points;
    points.forEach((point, pointIndex) => {
      target.set(
        [point.x, point.y, point.width, point.distance],
        (pathIndex * MAX_POINTS + pointIndex) * 4,
      );
    });
    target.set(
      [points.length, path.opacity, path.styleSeed, path.generation],
      (MAX_PATHS * MAX_POINTS + pathIndex) * 4,
    );
  });
}
