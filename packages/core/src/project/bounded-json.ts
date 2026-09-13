/** Version-one metadata policy. Keys are not value nodes; root/containers are. */
export const metadataLimits = Object.freeze({ documentBytes: 1048576, projectBytes: 1048576, depth: 32, nodes: 65536, stringBytes: 65536, keyBytes: 240 });
const encoder = new TextEncoder();
const typedArrayLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'byteLength')!.get!;
function byteLength(input: Uint8Array): number {
  if (!(input instanceof Uint8Array)) throw Error('Expected metadata bytes');
  return typedArrayLength.call(input) as number;
}
function copyBytes(input: Uint8Array, length: number): Uint8Array {
  const copy = new Uint8Array(length);
  // TypedArray.set uses internal slots for typed-array sources, not iteration,
  // constructor/species or caller-defined properties.
  Uint8Array.prototype.set.call(copy, input);
  return copy;
}
function checkString(value: string, key: boolean) {
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) throw Error('Metadata contains invalid Unicode');
  }
  if (encoder.encode(value).byteLength > (key ? metadataLimits.keyBytes : metadataLimits.stringBytes)) throw Error(`Metadata ${key ? 'key' : 'string'} byte limit exceeded`);
}

/** Raw wire admission: duplicate keys are rejected before assigning any value. */
export function parseMetadataJson(bytes: Uint8Array): unknown {
  const length = byteLength(bytes);
  if (length > metadataLimits.documentBytes) throw Error('Metadata document byte limit exceeded');
  bytes = copyBytes(bytes, length);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw Error('Metadata BOM is unsupported');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  let index = 0, nodes = 0;
  const whitespace = () => { while (index < text.length && /[\x20\t\r\n]/.test(text[index]!)) index++; };
  function string(key: boolean): string {
    const start = index++;
    while (index < text.length) {
      const character = text[index++];
      if (character === '"') {
        // JSON.parse only decodes this bounded string token, never an object.
        const value: string = JSON.parse(text.slice(start, index));
        checkString(value, key);
        return value;
      }
      if (character === '\\') index++;
    }
    throw Error('Unterminated metadata string');
  }
  function value(depth: number): unknown {
    whitespace();
    if (++nodes > metadataLimits.nodes) throw Error('Metadata value node limit exceeded');
    const token = text[index];
    if (token === '"') return string(false);
    if (token === '{' || token === '[') {
      if (depth + 1 > metadataLimits.depth) throw Error('Metadata nesting limit exceeded');
      index++; whitespace();
      if (token === '[') {
        const result: unknown[] = [];
        if (text[index] === ']') { index++; return result; }
        while (true) {
          result.push(value(depth + 1)); whitespace();
          if (text[index] === ']') { index++; return result; }
          if (text[index++] !== ',') throw Error('Invalid metadata array');
        }
      }
      const result: Record<string, unknown> = Object.create(null);
      if (text[index] === '}') { index++; return result; }
      while (true) {
        whitespace();
        if (text[index] !== '"') throw Error('Expected metadata object key');
        const key = string(true);
        if (Object.hasOwn(result, key)) throw Error(`Duplicate metadata key: ${key}`);
        whitespace();
        if (text[index++] !== ':') throw Error('Expected metadata colon');
        result[key] = value(depth + 1); whitespace();
        if (text[index] === '}') { index++; return result; }
        if (text[index++] !== ',') throw Error('Invalid metadata object');
      }
    }
    for (const [literal, parsed] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(literal, index)) { index += literal.length; return parsed; }
    }
    const numeric = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(index));
    if (!numeric) throw Error('Invalid metadata JSON value');
    index += numeric[0].length;
    const number = Number(numeric[0]);
    if (!Number.isFinite(number)) throw Error('Nonfinite metadata number');
    return number;
  }
  const parsed = value(0);
  whitespace();
  if (index !== text.length) throw Error('Trailing metadata JSON content');
  return parsed;
}

/** Own-descriptor snapshots avoid executing getters. Proxies are not a wire format. */
export function snapshotJsonData(input: unknown): unknown {
  let nodes = 0;
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > metadataLimits.nodes) throw Error('Metadata value node limit exceeded');
    if (typeof value === 'string') { checkString(value, false); return value; }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object') throw Error('Expected JSON metadata data');
    if (depth + 1 > metadataLimits.depth) throw Error('Metadata nesting limit exceeded');
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw Error('Expected plain metadata data');
    const keys = Reflect.ownKeys(value);
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length')!.value as number;
      if (length > metadataLimits.nodes || keys.length !== length + 1) throw Error('Expected dense metadata array');
      const result: unknown[] = [];
      for (let index = 0; index < length; index++) result.push(visit(data(value, String(index)), depth + 1));
      return result;
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string') throw Error('Expected string metadata key');
      checkString(key, true);
      result[key] = visit(data(value, key), depth + 1);
    }
    return result;
  }
  const snapshot = visit(input, 0);
  if (encoder.encode(JSON.stringify(snapshot)).byteLength > metadataLimits.documentBytes) throw Error('Metadata document byte limit exceeded');
  return snapshot;
}

function data(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error('Expected enumerable own metadata data');
  return descriptor.value;
}

/** A closed record capture for trusted byte-array inputs; never reads accessors. */
export function byteRecord(input: unknown, maxBytes = Number.MAX_SAFE_INTEGER): Record<string, Uint8Array> {
  if (!input || typeof input !== 'object' || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)) throw Error('Expected own byte record');
  const result: Record<string, Uint8Array> = Object.create(null);
  let total = 0;
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string') throw Error('Expected byte path');
    const value = data(input, key);
    if (!(value instanceof Uint8Array)) throw Error('Expected metadata bytes');
    const length = byteLength(value);
    total += length;
    if (total > maxBytes) throw Error('Project metadata byte limit exceeded');
    result[key] = copyBytes(value, length);
  }
  return result;
}
