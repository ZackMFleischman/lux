/** Bounded authored WGSL fragments and live scalar values. */
export const shaderFieldLimits = Object.freeze({ abi: 96, key: 64, fragments: 32, values: 128, totalUTF8Bytes: 262144 });
const encoder = new TextEncoder();
const reserved = new Set(['__proto__', 'prototype', 'constructor']);
function invalid(path, message) {
  throw Object.assign(new Error(`shader-field ${path}: ${message}`), { code: 'INVALID_SHADER_FIELD_SNAPSHOT', path });
}
function record(input, path, maximum, fields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid(path, 'expected a plain data record');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) invalid(path, 'expected a plain data record');
  const keys = Reflect.ownKeys(input);
  if (keys.length > maximum || (fields && keys.length !== fields.length)) invalid(path, 'field count exceeds bounds or fields mismatch');
  const result = {};
  for (const key of keys) {
    if (typeof key !== 'string' || key.split('.').some(part => reserved.has(part)) || (fields ? !fields.includes(key) : key.length > shaderFieldLimits.key || !/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(key))) invalid(path, 'invalid field key');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(`${path}.${key}`, 'expected an enumerable own data property');
    result[key] = descriptor.value;
  }
  return result;
}
export function normalizeShaderFieldSnapshot(input) {
  const raw = record(input, 'snapshot', 4, ['version', 'abi', 'fragments', 'values']);
  if (raw.version !== 1) invalid('snapshot.version', 'expected version 1');
  if (typeof raw.abi !== 'string' || raw.abi.length > shaderFieldLimits.abi || !/^[a-z][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)+$/.test(raw.abi)) invalid('snapshot.abi', 'expected a bounded slash-separated ABI identifier');
  const fragments = record(raw.fragments, 'snapshot.fragments', shaderFieldLimits.fragments);
  const values = record(raw.values, 'snapshot.values', shaderFieldLimits.values);
  // Payload keys and ABI count as UTF-8; each scalar counts as eight bytes.
  let bytes = encoder.encode(raw.abi).byteLength;
  for (const [key, value] of Object.entries(fragments)) {
    if (typeof value !== 'string' || !value.isWellFormed() || value.length > shaderFieldLimits.totalUTF8Bytes) invalid(`snapshot.fragments.${key}`, 'expected bounded valid Unicode shader text');
    bytes += encoder.encode(key).byteLength + encoder.encode(value).byteLength;
    if (bytes > shaderFieldLimits.totalUTF8Bytes) invalid('snapshot', 'aggregate UTF-8 byte limit exceeded');
  }
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`snapshot.values.${key}`, 'expected a finite scalar');
    bytes += encoder.encode(key).byteLength + 8;
  }
  if (bytes > shaderFieldLimits.totalUTF8Bytes) invalid('snapshot', 'aggregate UTF-8 byte limit exceeded');
  return Object.freeze({ version: 1, abi: raw.abi, fragments: Object.freeze(fragments), values: Object.freeze(values) });
}
