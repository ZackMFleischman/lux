// Pure browser-compatible parameter policy. No visual execution, hashing,
// environment access, or legacy Intensity fallback belongs at this boundary.
export const parameterLimits = Object.freeze({ count: 32, metadataBytes: 32768, id: 64, label: 80, unit: 24 });
const requiredFields = ['type', 'label', 'default', 'min', 'max'];
const optionalFields = ['step', 'unit'];
const reservedIds = new Set(['constructor', 'prototype', '__proto__']);
const encoder = new TextEncoder();

function invalid(path, message) {
  throw Object.assign(new Error(`${path}: ${message}`), { code: 'INVALID_PARAMETERS', path });
}
function record(input, path) {
  if (!input || typeof input !== 'object') invalid(path, 'expected a plain data record');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== null && prototype !== Object.prototype) invalid(path, 'expected a plain data record');
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      invalid(path, 'expected enumerable own data properties');
    }
    result[key] = descriptor.value;
  }
  return result;
}
function controlId(id) {
  if (typeof id !== 'string' || !/^[a-z][A-Za-z0-9_]{0,63}$/.test(id) || reservedIds.has(id)) {
    invalid('controls', 'invalid control ID');
  }
  return id;
}
function text(value, path, maximum) {
  if (typeof value !== 'string' || !value.isWellFormed() || /[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    invalid(path, 'expected valid Unicode without control characters');
  }
  const normalized = value.trim();
  if (!normalized || [...normalized].length > maximum) invalid(path, `expected 1–${maximum} code points`);
  return normalized;
}
function finite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected a finite number');
  return Object.is(value, -0) ? 0 : value;
}
function definition(id, input, normalizedRow) {
  const path = `controls.${controlId(id)}`, raw = record(input, path);
  const required = normalizedRow ? ['id', ...requiredFields, 'changeCost'] : requiredFields;
  for (const key of required) if (!Object.hasOwn(raw, key)) invalid(path, `missing field ${key}`);
  for (const key of Object.keys(raw)) if (!required.includes(key) && !optionalFields.includes(key)) invalid(path, `unsupported field ${key.slice(0, 80)}`);
  if (normalizedRow && raw.changeCost !== 'live') invalid(path, 'changeCost must be live');
  if (raw.type !== 'number') invalid(path, 'only number controls are supported');
  const label = text(raw.label, `${path}.label`, parameterLimits.label);
  const minimum = finite(raw.min, `${path}.min`), maximum = finite(raw.max, `${path}.max`);
  const value = finite(raw.default, `${path}.default`);
  if (!(minimum < maximum) || !Number.isFinite(maximum - minimum)) invalid(path, 'min must be below max with a finite range');
  if (value < minimum || value > maximum) invalid(`${path}.default`, `expected a number from ${minimum} to ${maximum}`);
  const result = { id, type: 'number', label, default: value, min: minimum, max: maximum };
  if (Object.hasOwn(raw, 'step')) {
    const step = finite(raw.step, `${path}.step`);
    if (step <= 0 || step > maximum - minimum) invalid(`${path}.step`, 'expected a positive increment no greater than the range');
    result.step = step;
  }
  if (Object.hasOwn(raw, 'unit')) result.unit = text(raw.unit, `${path}.unit`, parameterLimits.unit);
  result.changeCost = 'live';
  return Object.freeze(result);
}
function finishSchema(rows) {
  if (encoder.encode(JSON.stringify(rows)).byteLength > parameterLimits.metadataBytes) invalid('controls', 'schema exceeds 32 KiB UTF-8');
  return Object.freeze(rows);
}

export function normalizeControlDeclarations(input) {
  const raw = record(input, 'controls'), ids = Object.keys(raw);
  if (ids.length > parameterLimits.count) invalid('controls', 'at most 32 controls are supported');
  return finishSchema(ids.map(id => definition(id, raw[id], false)));
}

export function normalizeControlSchema(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) invalid('controls', 'expected a plain array of control definitions');
  const length = Object.getOwnPropertyDescriptor(input, 'length').value;
  if (length > parameterLimits.count) invalid('controls', 'at most 32 controls are supported');
  if (Reflect.ownKeys(input).length !== length + 1) invalid('controls', 'unexpected array properties');
  const rows = [], ids = new Set();
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid('controls', 'expected dense own data array elements');
    const raw = record(descriptor.value, `controls[${i}]`);
    const id = controlId(raw.id);
    if (ids.has(id)) invalid('controls', `duplicate control ID ${id}`);
    ids.add(id); rows.push(definition(id, raw, true));
  }
  return finishSchema(rows);
}

export function canonicalControlSchemaJson(schema) {
  return JSON.stringify(normalizeControlSchema(schema));
}

export function defaultControlValues(schema) {
  return Object.freeze(Object.fromEntries(normalizeControlSchema(schema).map(control => [control.id, control.default])));
}

function values(schema, input, complete) {
  const definitions = normalizeControlSchema(schema), raw = record(input, 'values'), keys = Object.keys(raw);
  if (!complete && !keys.length) invalid('values', 'expected a nonempty parameter patch');
  const known = new Map(definitions.map(control => [control.id, control]));
  for (const id of keys) if (!known.has(id)) invalid(`values.${id.slice(0, 64)}`, 'unknown parameter ID');
  const result = {};
  for (const control of definitions) {
    const path = `values.${control.id}`;
    if (!Object.hasOwn(raw, control.id)) {
      if (complete) invalid(path, 'missing parameter in full snapshot');
      continue;
    }
    const value = finite(raw[control.id], path);
    if (value < control.min || value > control.max) invalid(path, `expected a number from ${control.min} to ${control.max}`);
    result[control.id] = value;
  }
  return Object.freeze(result);
}
export function validateControlPatch(schema, input) { return values(schema, input, false); }
export function validateControlSnapshot(schema, input) { return values(schema, input, true); }

export function reconcileControlValues(previousSchema, previousValues, nextSchema) {
  const previous = normalizeControlSchema(previousSchema), next = normalizeControlSchema(nextSchema);
  const oldValues = validateControlSnapshot(previous, previousValues), old = new Map(previous.map(control => [control.id, control]));
  const result = {}, changes = [], nextIds = new Set();
  for (const control of next) {
    nextIds.add(control.id);
    const before = old.get(control.id), previousValue = oldValues[control.id];
    const reason = !before ? 'added' : before.unit !== control.unit ? 'unit-changed'
      : previousValue < control.min || previousValue > control.max ? 'out-of-range' : null;
    result[control.id] = reason ? control.default : previousValue;
    if (reason) changes.push(Object.freeze({ id: control.id, reason, ...(before ? { previousValue } : {}), value: control.default }));
  }
  for (const control of previous) if (!nextIds.has(control.id)) changes.push(Object.freeze({ id: control.id, reason: 'removed', previousValue: oldValues[control.id] }));
  return Object.freeze({ values: Object.freeze(result), changes: Object.freeze(changes) });
}
