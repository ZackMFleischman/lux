// Internal, stateless numeric mapping policy. Call before executing authored code;
// this boundary does not defend intrinsics already modified by that code.
import { normalizeControlSchema, validateControlSnapshot } from '../../runtime-contracts/src/parameters.mjs';

export const inputMappingLimits = Object.freeze({ targets: 256, bindings: 256, sources: 256, nodeDepth: 8, metadataBytes: 262144 });
const encoder = new TextEncoder();
const targetFields = ['sceneId', 'nodePath', 'controlId'];
const bindingFields = ['id', 'phase', 'source', 'target', 'inputMin', 'inputMax', 'outputMin', 'outputMax', 'exponent', 'invert', 'mode', 'enabled'];
const definitionFields = ['id', 'type', 'label', 'default', 'min', 'max', 'changeCost'];

function invalid(path, message) {
  const bounded = path.slice(0, 200);
  throw Object.assign(new Error(`${bounded}: ${message}`), { code: 'INVALID_INPUT_MAPPING', path: bounded });
}

// Copy only bounded own data descriptors before any property-value access or
// JSON encoding. Charge the raw representation, including whitespace in labels.
function data(input, root) {
  let bytes = 0;
  function charge(n, path) {
    bytes += n;
    if (bytes > inputMappingLimits.metadataBytes) invalid(path, 'metadata exceeds 256 KiB UTF-8');
  }
  function copy(value, path, depth) {
    if (typeof value === 'string') {
      if (value.length > inputMappingLimits.metadataBytes) invalid(path, 'string exceeds metadata budget');
      charge(encoder.encode(JSON.stringify(value)).byteLength, path);
      return value;
    }
    if (typeof value === 'number') {
      const normalized = finite(value, path);
      charge(JSON.stringify(normalized).length, path);
      return normalized;
    }
    if (typeof value === 'boolean') { charge(value ? 4 : 5, path); return value; }
    if (!value || typeof value !== 'object' || depth > 6) invalid(path, 'expected bounded plain data');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) invalid(path, 'unexpected prototype');
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length').value;
      if (length > 256) invalid(path, 'array exceeds declared limit');
      if (Reflect.ownKeys(value).length !== length + 1) invalid(path, 'expected bounded dense ordinary array');
      charge(2 + Math.max(0, length - 1), path);
      const result = [];
      for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(path, 'expected own data elements');
        result.push(copy(descriptor.value, `${path}[${i}]`, depth + 1));
      }
      return result;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > 12) invalid(path, 'too many record fields');
    charge(2 + Math.max(0, keys.length - 1), path);
    const result = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || key.length > 64 || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(path, 'expected enumerable own data properties');
      charge(encoder.encode(JSON.stringify(key)).byteLength + 1, path);
      result[key] = copy(descriptor.value, `${path}.${key}`, depth + 1);
    }
    return result;
  }
  return copy(input, root, 0);
}

function fields(value, required, path, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'expected record');
  for (const key of required) if (!Object.hasOwn(value, key)) invalid(path, 'missing required field');
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) invalid(path, 'unsupported field');
  return value;
}
function array(value, limit, path) {
  if (!Array.isArray(value) || value.length > limit) invalid(path, 'array exceeds declared limit');
  return value;
}
function finite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected finite number');
  return Object.is(value, -0) ? 0 : value;
}
function choice(value, allowed, path) {
  if (!allowed.includes(value)) invalid(path, 'unsupported value');
  return value;
}
function id(value, path) {
  if (typeof value !== 'string' || !/^[a-z][A-Za-z0-9_]{0,63}$/.test(value) || ['constructor', 'prototype', '__proto__'].includes(value)) invalid(path, 'invalid control/source ID');
  return value;
}
function uuid(value, path) {
  // Local canonical identity policy: RFC versions 1–8 and RFC variant. Nil and
  // max sentinels are not addresses; this does not change core UUID admission.
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) invalid(path, 'expected canonical RFC UUID');
  return value;
}
function target(value, path) {
  fields(value, targetFields, path);
  return { sceneId: uuid(value.sceneId, `${path}.sceneId`), nodePath: array(value.nodePath, inputMappingLimits.nodeDepth, `${path}.nodePath`).map((node, i) => uuid(node, `${path}.nodePath[${i}]`)), controlId: id(value.controlId, `${path}.controlId`) };
}
function source(value, path) {
  fields(value, ['sourceId', 'signalId'], path);
  return { sourceId: id(value.sourceId, `${path}.sourceId`), signalId: id(value.signalId, `${path}.signalId`) };
}
const targetKey = value => JSON.stringify([value.sceneId, value.nodePath, value.controlId]);
const sourceKey = value => JSON.stringify([value.sourceId, value.signalId]);
function unique(set, key, path) {
  if (set.has(key)) invalid(path, 'duplicate identity');
  set.add(key);
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function parameterCall(fn, path) {
  try { return fn(); } catch (error) {
    if (error?.code === 'INVALID_PARAMETERS') invalid(path, 'invalid numeric control definition or value');
    throw error;
  }
}

export function normalizeNumericMappingPlan(input) {
  const raw = fields(data(input, 'plan'), ['version', 'targets', 'bindings'], 'plan');
  if (raw.version !== 1) invalid('plan.version', 'unsupported version');
  const keys = new Set(), bindingIds = new Set(), sources = new Set();
  const targets = array(raw.targets, inputMappingLimits.targets, 'plan.targets').map((row, i) => {
    const path = `plan.targets[${i}]`;
    fields(row, ['target', 'definition'], path);
    const address = target(row.target, `${path}.target`);
    unique(keys, targetKey(address), path);
    fields(row.definition, definitionFields, `${path}.definition`, ['step', 'unit']);
    const definition = parameterCall(() => normalizeControlSchema([row.definition])[0], `${path}.definition`);
    if (definition.id !== address.controlId) invalid(path, 'definition ID must match target');
    return { target: address, definition };
  });
  const bindings = array(raw.bindings, inputMappingLimits.bindings, 'plan.bindings').map((row, i) => {
    const path = `plan.bindings[${i}]`;
    fields(row, bindingFields, path);
    const bindingId = uuid(row.id, `${path}.id`); unique(bindingIds, bindingId, path);
    const address = target(row.target, `${path}.target`), ref = source(row.source, `${path}.source`);
    if (!keys.has(targetKey(address))) invalid(path, 'binding target absent from catalogue');
    sources.add(sourceKey(ref));
    const inputMin = finite(row.inputMin, path), inputMax = finite(row.inputMax, path);
    const outputMin = finite(row.outputMin, path), outputMax = finite(row.outputMax, path);
    if (!(inputMin < inputMax)) invalid(path, 'input range must increase');
    finite(inputMax - inputMin, path);
    if (outputMin > outputMax) invalid(path, 'output range must not decrease');
    finite(outputMax - outputMin, path);
    const exponent = finite(row.exponent, path);
    if (exponent < 0.125 || exponent > 8) invalid(path, 'exponent outside bounds');
    return { id: bindingId, phase: choice(row.phase, ['macro', 'modulation'], path), source: ref, target: address, inputMin, inputMax, outputMin, outputMax, exponent,
      invert: choice(row.invert, [true, false], path), mode: choice(row.mode, ['replace', 'add', 'multiply'], path), enabled: choice(row.enabled, [true, false], path) };
  });
  if (sources.size > inputMappingLimits.sources) invalid('plan.bindings', 'too many sources');
  return freeze({ version: 1, targets, bindings });
}

export function evaluateNumericMappings(input, inputFrame) {
  const plan = normalizeNumericMappingPlan(input);
  const frame = fields(data(inputFrame, 'frame'), ['authority', 'base', 'signals', 'hostValues'], 'frame');
  choice(frame.authority, ['studio', 'host'], 'frame.authority');
  const catalogue = new Map(plan.targets.map(row => [targetKey(row.target), row]));
  function values(rows, path, complete) {
    const result = new Map();
    for (const [i, row] of array(rows, inputMappingLimits.targets, path).entries()) {
      const at = `${path}[${i}]`; fields(row, ['target', 'value'], at);
      const key = targetKey(target(row.target, `${at}.target`)), entry = catalogue.get(key);
      if (!entry || result.has(key)) invalid(at, 'unknown or duplicate target');
      const value = parameterCall(() => validateControlSnapshot([entry.definition], { [entry.definition.id]: row.value })[entry.definition.id], at);
      result.set(key, value);
    }
    if (complete && result.size !== catalogue.size) invalid(path, 'base must cover every target');
    return result;
  }
  const base = values(frame.base, 'frame.base', true), host = values(frame.hostValues, 'frame.hostValues', false);
  if (frame.authority === 'studio' && host.size) invalid('frame.hostValues', 'Studio authority cannot supply host values');
  const signals = new Map(), sourceIds = new Set(plan.bindings.map(row => sourceKey(row.source)));
  for (const [i, row] of array(frame.signals, inputMappingLimits.sources, 'frame.signals').entries()) {
    const path = `frame.signals[${i}]`; fields(row, ['source', 'value'], path);
    const key = sourceKey(source(row.source, `${path}.source`));
    if (signals.has(key)) invalid(path, 'duplicate source signal');
    signals.set(key, finite(row.value, path)); sourceIds.add(key);
  }
  if (sourceIds.size > inputMappingLimits.sources) invalid('frame.signals', 'too many distinct source references');
  const traces = [], output = [];
  for (const { target: address, definition } of plan.targets) {
    const key = targetKey(address), owned = host.has(key), authored = base.get(key);
    let current = owned ? host.get(key) : authored, afterMacros = current;
    const bindings = [];
    for (const phase of ['macro', 'modulation']) {
      for (const row of plan.bindings) {
        if (row.phase !== phase || targetKey(row.target) !== key) continue;
        const before = current, signal = sourceKey(row.source);
        let status, mapped = null;
        if (owned) status = 'host-owned';
        else if (!row.enabled) status = 'disabled';
        else if (!signals.has(signal)) status = 'unresolved-source';
        else {
          const path = `evaluation.${row.id}`;
          const offset = finite(signals.get(signal) - row.inputMin, path);
          const ratio = finite(offset / (row.inputMax - row.inputMin), path);
          const unit = Math.max(0, Math.min(1, ratio));
          const shaped = finite((row.invert ? 1 - unit : unit) ** row.exponent, path);
          const scaled = finite((row.outputMax - row.outputMin) * shaped, path);
          mapped = finite(row.outputMin + scaled, path);
          current = finite(row.mode === 'replace' ? mapped : row.mode === 'add' ? current + mapped : current * mapped, path);
          status = 'applied';
        }
        bindings.push({ bindingId: row.id, phase, status, before, mapped, after: current });
      }
      if (phase === 'macro') afterMacros = current;
    }
    const effective = finite(Math.max(definition.min, Math.min(definition.max, current)), 'evaluation');
    output.push({ target: address, value: effective });
    traces.push({ target: address, authority: owned ? 'host' : 'studio', base: authored, afterMacros, beforeClamp: current, effective, clamped: effective !== current, bindings });
  }
  return freeze({ version: 1, values: output, traces });
}
