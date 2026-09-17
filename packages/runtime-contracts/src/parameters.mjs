// Pure browser-compatible parameter policy. No visual execution, hashing,
// environment access, or legacy Intensity fallback belongs at this boundary.
export const parameterLimits = Object.freeze({ metadataBytes: 32768, id: 64, label: 80, unit: 24, description: 512, group: 80 });
const commonRequiredFields = ['type', 'label'];
const commonOptionalFields = ['description', 'group'];
const numberFields = ['min', 'max', 'step', 'unit'];
const enumFields = ['options', 'presentation'];
const reservedIds = new Set(['constructor', 'prototype', '__proto__']);
const enumPresentations = new Set(['segmented', 'radio', 'dropdown']);
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
    if (typeof key !== 'string' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(path, 'expected enumerable own data properties');
    result[key] = descriptor.value;
  }
  return result;
}
function denseArray(input, path) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) invalid(path, 'expected a plain array');
  const length = Object.getOwnPropertyDescriptor(input, 'length')?.value;
  if (!Number.isSafeInteger(length) || Reflect.ownKeys(input).length !== length + 1) invalid(path, 'expected a dense own data array');
  const result = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(path, 'expected dense own data array elements');
    result.push(descriptor.value);
  }
  return result;
}
function stableId(id, path) {
  if (typeof id !== 'string' || !/^[a-z][A-Za-z0-9_]{0,63}$/.test(id) || reservedIds.has(id)) invalid(path, 'invalid ID');
  return id;
}
function controlId(id) { return stableId(id, 'controls'); }
function text(value, path, maximum) {
  if (typeof value !== 'string' || !value.isWellFormed() || /[\u0000-\u001f\u007f-\u009f]/.test(value)) invalid(path, 'expected valid Unicode without control characters');
  const normalized = value.trim();
  if (!normalized || [...normalized].length > maximum) invalid(path, `expected 1–${maximum} code points`);
  return normalized;
}
function finite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected a finite number');
  return Object.is(value, -0) ? 0 : value;
}
function optionalMetadata(raw, result, path) {
  if (Object.hasOwn(raw, 'description')) result.description = text(raw.description, `${path}.description`, parameterLimits.description);
  if (Object.hasOwn(raw, 'group')) result.group = text(raw.group, `${path}.group`, parameterLimits.group);
}
function enumOptions(input, path) {
  const rows = denseArray(input, path);
  if (rows.length < 2 || rows.length > 64) invalid(path, 'expected 2–64 enum options');
  const result = [], ids = new Set();
  for (let index = 0; index < rows.length; index++) {
    const optionPath = `${path}.${index}`, raw = record(rows[index], optionPath);
    for (const key of ['id', 'label']) if (!Object.hasOwn(raw, key)) invalid(optionPath, `missing field ${key}`);
    for (const key of Object.keys(raw)) if (!['id', 'label', 'description'].includes(key)) invalid(optionPath, `unsupported field ${key.slice(0, 80)}`);
    const id = stableId(raw.id, `${optionPath}.id`);
    if (ids.has(id)) invalid(path, `duplicate option ID ${id}`);
    ids.add(id);
    const option = { id, label: text(raw.label, `${optionPath}.label`, parameterLimits.label) };
    if (Object.hasOwn(raw, 'description')) option.description = text(raw.description, `${optionPath}.description`, parameterLimits.description);
    result.push(Object.freeze(option));
  }
  return Object.freeze(result);
}
function definition(id, input, normalizedRow) {
  const path = `controls.${controlId(id)}`, raw = record(input, path);
  for (const key of [...(normalizedRow ? ['id'] : []), ...commonRequiredFields, ...(normalizedRow ? ['changeCost'] : [])]) if (!Object.hasOwn(raw, key)) invalid(path, `missing field ${key}`);
  if (normalizedRow && raw.changeCost !== 'live') invalid(path, 'changeCost must be live');
  const type = raw.type;
  const kindFields = type === 'number' ? numberFields : type === 'boolean' || type === 'trigger' ? [] : type === 'enum' ? enumFields : null;
  if (!kindFields) invalid(`${path}.type`, 'expected number, boolean, enum, or trigger');
  const requiredKindFields = type === 'number' ? ['default', 'min', 'max'] : type === 'boolean' ? ['default'] : type === 'enum' ? ['default', 'options'] : [];
  for (const key of requiredKindFields) if (!Object.hasOwn(raw, key)) invalid(path, `missing field ${key}`);
  const allowed = [...(normalizedRow ? ['id', 'changeCost'] : []), ...commonRequiredFields, ...(type === 'trigger' ? [] : ['default']), ...commonOptionalFields, ...kindFields];
  for (const key of Object.keys(raw)) if (!allowed.includes(key)) invalid(path, `unsupported field ${key.slice(0, 80)}`);

  const label = text(raw.label, `${path}.label`, parameterLimits.label);
  if (type === 'trigger') {
    const result = { id, type: 'trigger', label };
    optionalMetadata(raw, result, path); result.changeCost = 'live';
    return Object.freeze(result);
  }
  if (type === 'number') {
    const minimum = finite(raw.min, `${path}.min`), maximum = finite(raw.max, `${path}.max`), value = finite(raw.default, `${path}.default`);
    if (!(minimum < maximum) || !Number.isFinite(maximum - minimum)) invalid(path, 'min must be below max with a finite range');
    if (value < minimum || value > maximum) invalid(`${path}.default`, `expected a number from ${minimum} to ${maximum}`);
    const result = { id, type: 'number', label, default: value, min: minimum, max: maximum };
    if (Object.hasOwn(raw, 'step')) {
      const step = finite(raw.step, `${path}.step`);
      if (step <= 0 || step > maximum - minimum) invalid(`${path}.step`, 'expected a positive increment no greater than the range');
      result.step = step;
    }
    if (Object.hasOwn(raw, 'unit')) result.unit = text(raw.unit, `${path}.unit`, parameterLimits.unit);
    optionalMetadata(raw, result, path); result.changeCost = 'live';
    return Object.freeze(result);
  }
  if (type === 'boolean') {
    if (typeof raw.default !== 'boolean') invalid(`${path}.default`, 'expected a boolean');
    const result = { id, type: 'boolean', label, default: raw.default };
    optionalMetadata(raw, result, path); result.changeCost = 'live';
    return Object.freeze(result);
  }
  const options = enumOptions(raw.options, `${path}.options`);
  if (typeof raw.default !== 'string' || !options.some(option => option.id === raw.default)) invalid(`${path}.default`, 'expected an admitted enum option ID');
  const presentation = Object.hasOwn(raw, 'presentation') ? raw.presentation : 'dropdown';
  if (!enumPresentations.has(presentation)) invalid(`${path}.presentation`, 'expected segmented, radio, or dropdown');
  const result = { id, type: 'enum', label, default: raw.default, options, presentation };
  optionalMetadata(raw, result, path); result.changeCost = 'live';
  return Object.freeze(result);
}
function finishSchema(rows) {
  if (encoder.encode(JSON.stringify(rows)).byteLength > parameterLimits.metadataBytes) invalid('controls', 'schema exceeds 32 KiB UTF-8');
  return Object.freeze(rows);
}

export function normalizeControlDeclarations(input) {
  const raw = record(input, 'controls');
  return finishSchema(Object.keys(raw).map(id => definition(id, raw[id], false)));
}
export function normalizeControlSchema(input) {
  const values = denseArray(input, 'controls'), rows = [], ids = new Set();
  for (let index = 0; index < values.length; index++) {
    const raw = record(values[index], `controls[${index}]`), id = controlId(raw.id);
    if (ids.has(id)) invalid('controls', `duplicate control ID ${id}`);
    ids.add(id); rows.push(definition(id, raw, true));
  }
  return finishSchema(rows);
}
export function canonicalControlSchemaJson(schema) { return JSON.stringify(normalizeControlSchema(schema)); }
export function defaultControlValues(schema) { return Object.freeze(Object.fromEntries(normalizeControlSchema(schema).filter(control => control.type !== 'trigger').map(control => [control.id, control.default]))); }
export function isNumberControlDefinition(value) { return value.type === 'number'; }

function admittedValue(control, input, path) {
  if (control.type === 'trigger') throw Object.assign(new Error('Trigger controls use the trigger command.'), { code: 'INVALID_PARAMETERS', path });
  if (control.type === 'number') {
    const value = finite(input, path);
    if (value < control.min || value > control.max) invalid(path, `expected a number from ${control.min} to ${control.max}`);
    return value;
  }
  if (control.type === 'boolean') {
    if (typeof input !== 'boolean') invalid(path, 'expected a boolean');
    return input;
  }
  if (typeof input !== 'string' || !control.options.some(option => option.id === input)) invalid(path, 'expected an admitted enum option ID');
  return input;
}
function values(schema, input, complete) {
  const definitions = normalizeControlSchema(schema), raw = record(input, 'values'), keys = Object.keys(raw);
  if (!complete && !keys.length) invalid('values', 'expected a nonempty parameter patch');
  const known = new Map(definitions.map(control => [control.id, control]));
  for (const id of keys) if (!known.has(id)) invalid(`values.${id.slice(0, 64)}`, 'unknown parameter ID');
  for (const id of keys) if (known.get(id).type === 'trigger') admittedValue(known.get(id), raw[id], `values.${id}`);
  const result = {};
  for (const control of definitions) {
    if (control.type === 'trigger') continue;
    const path = `values.${control.id}`;
    if (!Object.hasOwn(raw, control.id)) {
      if (complete) invalid(path, 'missing parameter in full snapshot');
      continue;
    }
    result[control.id] = admittedValue(control, raw[control.id], path);
  }
  return Object.freeze(result);
}
export function validateControlPatch(schema, input) { return values(schema, input, false); }
export function validateControlSnapshot(schema, input) { return values(schema, input, true); }

export function reconcileControlValues(previousSchema, previousValues, nextSchema) {
  const previousSchemaRows = normalizeControlSchema(previousSchema), nextSchemaRows = normalizeControlSchema(nextSchema);
  const oldValues = validateControlSnapshot(previousSchemaRows, previousValues);
  const previous = previousSchemaRows.filter(control => control.type !== 'trigger'), next = nextSchemaRows.filter(control => control.type !== 'trigger');
  const old = new Map(previous.map(control => [control.id, control]));
  const result = {}, changes = [], nextIds = new Set();
  for (const control of next) {
    nextIds.add(control.id);
    const before = old.get(control.id), previousValue = oldValues[control.id];
    let reason = !before ? 'added' : before.type !== control.type ? 'type-changed' : null;
    if (!reason && control.type === 'number') reason = before.unit !== control.unit ? 'unit-changed' : previousValue < control.min || previousValue > control.max ? 'out-of-range' : null;
    else if (!reason && control.type === 'enum' && !control.options.some(option => option.id === previousValue)) reason = 'option-removed';
    result[control.id] = reason ? control.default : previousValue;
    if (reason) changes.push(Object.freeze({ id: control.id, reason, ...(before ? { previousValue } : {}), value: control.default }));
  }
  for (const control of previous) if (!nextIds.has(control.id)) changes.push(Object.freeze({ id: control.id, reason: 'removed', previousValue: oldValues[control.id] }));
  return Object.freeze({ values: Object.freeze(result), changes: Object.freeze(changes) });
}
