export const PATHS2D_PORT_DESCRIPTOR = Object.freeze({
  kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height',
});

function invalid(path, message) {
  throw Object.assign(new Error(`paths2d ${path}: ${message}`), { code: 'INVALID_PATHS2D_SNAPSHOT', path });
}

function record(input, path, fields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid(path, 'expected a plain data record');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) invalid(path, 'expected a plain data record');
  const keys = Reflect.ownKeys(input);
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key))) invalid(path, 'fields mismatch');
  const result = {};
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(`${path}.${field}`, 'expected an enumerable own data property');
    result[field] = descriptor.value;
  }
  return result;
}

function array(input, path, maximum) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) invalid(path, 'expected a plain dense array');
  const length = Object.getOwnPropertyDescriptor(input, 'length')?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum || Reflect.ownKeys(input).length !== length + 1) invalid(path, `expected at most ${maximum} dense values`);
  const values = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(`${path}[${index}]`, 'expected an enumerable own data property');
    values.push(descriptor.value);
  }
  return values;
}

function finite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected a finite number');
  return value;
}

function identity(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) invalid(path, 'expected a nonnegative safe integer');
  return value;
}

function normalizePoint(input, path) {
  const value = record(input, path, ['x', 'y', 'width', 'distance', 'depositionTime']);
  return Object.freeze({
    x: finite(value.x, `${path}.x`),
    y: finite(value.y, `${path}.y`),
    width: finite(value.width, `${path}.width`),
    distance: finite(value.distance, `${path}.distance`),
    depositionTime: finite(value.depositionTime, `${path}.depositionTime`),
  });
}

function normalizePath(input, path) {
  const value = record(input, path, ['id', 'generation', 'styleSeed', 'birthTime', 'lifetime', 'phase', 'opacity', 'points']);
  const points = array(value.points, `${path}.points`, 256).map((point, index) => normalizePoint(point, `${path}.points[${index}]`));
  for (let index = 1; index < points.length; index++) if (points[index].distance < points[index - 1].distance) invalid(`${path}.points[${index}].distance`, 'expected nondecreasing distance order');
  return Object.freeze({
    id: identity(value.id, `${path}.id`),
    generation: identity(value.generation, `${path}.generation`),
    styleSeed: identity(value.styleSeed, `${path}.styleSeed`),
    birthTime: finite(value.birthTime, `${path}.birthTime`),
    lifetime: finite(value.lifetime, `${path}.lifetime`),
    phase: finite(value.phase, `${path}.phase`),
    opacity: finite(value.opacity, `${path}.opacity`),
    points: Object.freeze(points),
  });
}

export function normalizePaths2DSnapshot(input) {
  const value = record(input, 'snapshot', ['version', 'paths']);
  if (value.version !== 1) invalid('snapshot.version', 'expected version 1');
  const paths = array(value.paths, 'snapshot.paths', 32).map((path, index) => normalizePath(path, `snapshot.paths[${index}]`));
  return Object.freeze({ version: 1, paths: Object.freeze(paths) });
}
