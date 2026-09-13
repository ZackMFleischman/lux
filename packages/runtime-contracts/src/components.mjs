// Pure metadata policy. Declarations do not imply executable support or identity.
import { normalizeControlDeclarations, normalizeControlSchema, canonicalControlSchemaJson, parameterLimits } from './parameters.mjs';

export const componentMetadataLimits = Object.freeze({
  registryEntries: 128, inputs: 16, outputs: 16, controls: parameterLimits.count,
  tags: 16, tag: 32, key: 96, portId: parameterLimits.id, label: 80,
  description: 512, signalUnit: 24, metadataBytes: 65536, registryBytes: 1048576,
});
const encoder = new TextEncoder();
const reservedIds = new Set(['constructor', 'prototype', '__proto__']);
const fields = ['declarationVersion', 'key', 'label', 'description', 'tags', 'inputs', 'outputs', 'controls', 'controlDescriptions', 'lifecycle'];

function invalid(path, message) {
  throw Object.assign(new Error(`${path}: ${message}`), { code: 'INVALID_COMPONENT_METADATA', path });
}

function record(input, path, expected) {
  if (!input || typeof input !== 'object') invalid(path, 'expected a plain data record');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== null && prototype !== Object.prototype) invalid(path, 'expected a plain data record');
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      invalid(path, 'expected enumerable own data properties');
    }
    if (expected && !expected.includes(key)) invalid(path, 'unsupported field');
    result[key] = descriptor.value;
  }
  if (expected) for (const key of expected) if (!Object.hasOwn(result, key)) invalid(path, `missing field ${key}`);
  return result;
}

function text(value, path, maximum) {
  if (typeof value !== 'string' || !value.isWellFormed() || /[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    invalid(path, 'expected valid Unicode without control characters');
  }
  if (!value || value.trim() !== value || [...value].length > maximum) {
    invalid(path, `expected 1–${maximum} code points without edge whitespace`);
  }
  return value;
}

function portId(value, path) {
  if (!/^[a-z][A-Za-z0-9_]{0,63}$/.test(value) || reservedIds.has(value)) invalid(path, 'invalid port ID');
  return value;
}

function portType(input, path) {
  const raw = record(input, path);
  if (raw.kind === 'signal') {
    record(raw, path, ['kind', 'value', 'unit', 'clock']);
    if (raw.value !== 'number' || raw.clock !== 'frame') invalid(path, 'expected number signal with frame clock');
    const unit = raw.unit === null ? null : text(raw.unit, `${path}.unit`, componentMetadataLimits.signalUnit);
    return Object.freeze({ kind: 'signal', value: 'number', unit, clock: 'frame' });
  }
  if (raw.kind === 'image') {
    record(raw, path, ['kind', 'colorSpace', 'alphaMode']);
    if (raw.colorSpace !== 'linear-srgb' || raw.alphaMode !== 'premultiplied') invalid(path, 'expected linear-srgb premultiplied image');
    return Object.freeze({ kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' });
  }
  invalid(path, 'unsupported port type');
}

function ports(input, path, maximum) {
  const raw = record(input, path), keys = Object.keys(raw).sort();
  if (keys.length > maximum) invalid(path, `at most ${maximum} ports are supported`);
  return Object.freeze(Object.fromEntries(keys.map(key => {
    const location = `${path}.${portId(key, path)}`;
    const port = record(raw[key], location, ['type', 'label', 'description']);
    return [key, Object.freeze({
      type: portType(port.type, `${location}.type`),
      label: text(port.label, `${location}.label`, componentMetadataLimits.label),
      description: text(port.description, `${location}.description`, componentMetadataLimits.description),
    })];
  })));
}

function tags(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) invalid('tags', 'expected a plain array');
  const length = Object.getOwnPropertyDescriptor(input, 'length').value;
  if (length > componentMetadataLimits.tags) invalid('tags', 'at most 16 raw tags are supported');
  if (Reflect.ownKeys(input).length !== length + 1) invalid('tags', 'unexpected array properties');
  const values = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid('tags', 'expected dense own data array elements');
    values.push(text(descriptor.value, `tags[${i}]`, componentMetadataLimits.tag));
  }
  return Object.freeze([...new Set(values)].sort());
}

function serialize(metadata) {
  // The parameter module remains the authority for control bytes and order.
  return JSON.stringify({ ...metadata, controls: JSON.parse(canonicalControlSchemaJson(metadata.controls)) });
}

function normalize(input, normalizedControls) {
  const raw = record(input, 'component', fields);
  if (raw.declarationVersion !== 1) invalid('declarationVersion', 'expected version 1');
  if (typeof raw.key !== 'string' || raw.key.length > componentMetadataLimits.key || !/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test(raw.key)) {
    invalid('key', 'expected a bounded namespace/name declaration key');
  }
  const controls = normalizedControls ? normalizeControlSchema(raw.controls) : normalizeControlDeclarations(raw.controls);
  const descriptions = record(raw.controlDescriptions, 'controlDescriptions');
  if (Object.keys(descriptions).length !== controls.length || controls.some(control => !Object.hasOwn(descriptions, control.id))) {
    invalid('controlDescriptions', 'expected exactly one description per control');
  }
  const controlDescriptions = Object.freeze(Object.fromEntries(Object.keys(descriptions).sort().map(key =>
    [key, text(descriptions[key], `controlDescriptions.${key}`, componentMetadataLimits.description)])));
  const lifecycle = record(raw.lifecycle, 'lifecycle', ['state', 'reset']);
  if (!['stateless', 'stateful'].includes(lifecycle.state) || lifecycle.reset !== 'seed') invalid('lifecycle', 'unsupported state or reset');
  const result = Object.freeze({
    declarationVersion: 1, key: raw.key,
    label: text(raw.label, 'label', componentMetadataLimits.label),
    description: text(raw.description, 'description', componentMetadataLimits.description),
    tags: tags(raw.tags), inputs: ports(raw.inputs, 'inputs', componentMetadataLimits.inputs),
    outputs: ports(raw.outputs, 'outputs', componentMetadataLimits.outputs), controls, controlDescriptions,
    lifecycle: Object.freeze({ state: lifecycle.state, reset: lifecycle.reset }),
  });
  if (encoder.encode(serialize(result)).byteLength > componentMetadataLimits.metadataBytes) invalid('component', 'metadata exceeds 64 KiB UTF-8');
  return result;
}

export function normalizeComponentDeclaration(input) { return normalize(input, false); }
export function normalizeComponentMetadata(input) { return normalize(input, true); }
/** Canonical UTF-8 JSON input for caller-owned hashing, not execution identity. */
export function canonicalComponentMetadataJson(input) { return serialize(normalizeComponentMetadata(input)); }
