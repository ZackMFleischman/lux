export const CAMERA_CONTROLLER_ABI = 'lux/camera-controller/v1' as const;

export const CAMERA_CONTROLLER_CONTROL_IDS = [
  'yaw',
  'pitch',
  'panX',
  'panY',
  'dolly',
  'roll',
] as const;

export type CameraControllerControlId = typeof CAMERA_CONTROLLER_CONTROL_IDS[number];

export type CameraControllerValues = Readonly<Record<CameraControllerControlId, number>>;

export type CameraTuple = readonly [number, number, number];

export type CameraPose = Readonly<{
  position: CameraTuple;
  target: CameraTuple;
  up: CameraTuple;
}>;

export type ResolvedCameraPose = Readonly<{
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  forward: [number, number, number];
  right: [number, number, number];
}>;

type CameraFieldData = Readonly<{
  version: number;
  abi: string;
  fragments: Readonly<Record<string, unknown>>;
  values: Readonly<Record<string, unknown>>;
}>;

const exactKeys = (record: Readonly<Record<string, unknown>>, expected: readonly string[]) => {
  const keys = Object.keys(record).sort();
  const sorted = [...expected].sort();
  return keys.length === sorted.length && keys.every((key, index) => key === sorted[index]);
};

export function readCameraController(data: unknown): CameraControllerValues {
  if (!data || typeof data !== 'object') {
    throw Error(`Camera consumer requires shader field ${CAMERA_CONTROLLER_ABI}.`);
  }
  const field = data as Partial<CameraFieldData>;
  if (field.version !== 1 || field.abi !== CAMERA_CONTROLLER_ABI) {
    throw Error(`Camera consumer requires shader field ${CAMERA_CONTROLLER_ABI}.`);
  }
  if (!field.fragments || typeof field.fragments !== 'object' || !exactKeys(field.fragments, [])) {
    throw Error(`${CAMERA_CONTROLLER_ABI} requires no shader fragments.`);
  }
  if (!field.values || typeof field.values !== 'object' || !exactKeys(field.values, CAMERA_CONTROLLER_CONTROL_IDS)) {
    throw Error(`${CAMERA_CONTROLLER_ABI} requires exactly yaw, pitch, panX, panY, dolly, and roll values.`);
  }
  const values = field.values as Readonly<Record<string, unknown>>;
  for (const id of CAMERA_CONTROLLER_CONTROL_IDS) {
    if (typeof values[id] !== 'number' || !Number.isFinite(values[id])) {
      throw Error(`${CAMERA_CONTROLLER_ABI} value ${id} must be finite.`);
    }
  }
  return Object.freeze(Object.fromEntries(CAMERA_CONTROLLER_CONTROL_IDS.map(id => [id, values[id]]))) as CameraControllerValues;
}

type MutableTuple = [number, number, number];

const add = (left: CameraTuple, right: CameraTuple): MutableTuple => [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
const subtract = (left: CameraTuple, right: CameraTuple): MutableTuple => [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
const scale = (value: CameraTuple, amount: number): MutableTuple => [value[0] * amount, value[1] * amount, value[2] * amount];
const dot = (left: CameraTuple, right: CameraTuple) => left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
const cross = (left: CameraTuple, right: CameraTuple): MutableTuple => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
];
const length = (value: CameraTuple) => Math.hypot(value[0], value[1], value[2]);
const clean = (value: number) => Math.abs(value) < 1e-12 ? 0 : value;
const cleaned = (value: CameraTuple): MutableTuple => [clean(value[0]), clean(value[1]), clean(value[2])];

function normalize(value: CameraTuple, label: string): MutableTuple {
  const magnitude = length(value);
  if (!Number.isFinite(magnitude) || magnitude < 1e-9) throw Error(`${label} must have a finite non-zero direction.`);
  return cleaned(scale(value, 1 / magnitude));
}

function rotate(value: CameraTuple, axisInput: CameraTuple, angle: number): MutableTuple {
  const axis = normalize(axisInput, 'Camera rotation axis');
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return cleaned(add(add(scale(value, cosine), scale(cross(axis, value), sine)), scale(axis, dot(axis, value) * (1 - cosine))));
}

export function resolveCameraPose(
  base: CameraPose,
  values: CameraControllerValues,
  options: Readonly<{ focusDistance: number; minDistance?: number }>,
): ResolvedCameraPose {
  if (!Number.isFinite(options.focusDistance) || options.focusDistance <= 0) {
    throw Error('Camera focusDistance must be a finite positive number.');
  }
  const minimum = options.minDistance ?? 0.001;
  if (!Number.isFinite(minimum) || minimum <= 0) throw Error('Camera minDistance must be a finite positive number.');
  for (const id of CAMERA_CONTROLLER_CONTROL_IDS) {
    if (!Number.isFinite(values[id])) throw Error(`Camera controller value ${id} must be finite.`);
  }

  const authoredOffset = subtract(base.position, base.target);
  const authoredDistance = length(authoredOffset);
  const authoredForward = normalize(subtract(base.target, base.position), 'Camera position and target');
  const authoredUpCandidate = subtract(base.up, scale(authoredForward, dot(base.up, authoredForward)));
  const authoredUp = normalize(authoredUpCandidate, 'Camera up');

  const yawedForward = normalize(rotate(authoredForward, authoredUp, -values.yaw), 'Yawed camera forward');
  const yawedRight = normalize(cross(yawedForward, authoredUp), 'Yawed camera right');
  const forward = normalize(rotate(yawedForward, yawedRight, values.pitch), 'Pitched camera forward');
  const pitchedUp = normalize(rotate(authoredUp, yawedRight, values.pitch), 'Pitched camera up');
  const up = normalize(rotate(pitchedUp, forward, values.roll), 'Rolled camera up');
  const right = normalize(cross(forward, up), 'Resolved camera right');

  const pan = add(scale(right, values.panX * options.focusDistance), scale(up, values.panY * options.focusDistance));
  const target = cleaned(add(base.target, pan));
  const distance = Math.max(minimum, authoredDistance + values.dolly * options.focusDistance);
  const position = cleaned(subtract(target, scale(forward, distance)));
  return Object.freeze({ position, target, up: cleaned(up), forward: cleaned(forward), right: cleaned(right) });
}
