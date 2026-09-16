type Vint = Readonly<{ width: number; value: number; unknown: boolean }>;

function find(bytes: Uint8Array, id: readonly number[], from = 0): number {
  outer: for (let at = from; at <= bytes.length - id.length; at++) {
    for (let offset = 0; offset < id.length; offset++) if (bytes[at + offset] !== id[offset]) continue outer;
    return at;
  }
  return -1;
}
function readVint(bytes: Uint8Array, at: number): Vint {
  const first = bytes[at]; if (first === undefined || first === 0) throw Error('Invalid WebM element size');
  let width = 1, marker = 0x80;
  while (width <= 8 && !(first & marker)) { width++; marker >>= 1; }
  if (width > 8 || at + width > bytes.length) throw Error('Truncated WebM element size');
  let value = BigInt(first & (marker - 1));
  for (let index = 1; index < width; index++) value = (value << 8n) | BigInt(bytes[at + index]!);
  const unknown = value === (1n << BigInt(7 * width)) - 1n;
  if (!unknown && value > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('WebM element size exceeds safe bounds');
  return { width, value: unknown ? 0 : Number(value), unknown };
}
function writeVint(value: number, width: number): Uint8Array {
  const maximum = (1n << BigInt(7 * width)) - 2n, encoded = BigInt(value);
  if (!Number.isSafeInteger(value) || value < 0 || encoded > maximum) throw Error('WebM element size cannot contain duration metadata');
  const result = new Uint8Array(width); let remaining = encoded;
  for (let index = width - 1; index >= 0; index--) { result[index] = Number(remaining & 0xffn); remaining >>= 8n; }
  result[0] = result[0]! | 1 << (8 - width); return result;
}
function idWidth(first: number | undefined): number {
  if (first === undefined || first === 0) throw Error('Invalid WebM element identifier');
  let width = 1, marker = 0x80;
  while (width <= 4 && !(first & marker)) { width++; marker >>= 1; }
  if (width > 4) throw Error('Invalid WebM element identifier');
  return width;
}
function unsigned(bytes: Uint8Array): number {
  if (!bytes.length || bytes.length > 6) throw Error('Invalid WebM unsigned integer');
  let value = 0; for (const byte of bytes) value = value * 256 + byte; return value;
}
function float64(value: number): Uint8Array {
  const result = new Uint8Array(8); new DataView(result.buffer).setFloat64(0, value); return result;
}

/** Patches only the bounded WebM prefix containing Segment Info. The caller
 * streams the untouched remainder; no encoded frames are buffered here. */
export function patchWebmDurationHeader(prefix: Uint8Array, durationMs: number): Readonly<{ bytes: Uint8Array; delta: number }> {
  if (!(prefix instanceof Uint8Array) || !Number.isFinite(durationMs) || durationMs <= 0) throw Error('Invalid WebM recording duration');
  const segmentAt = find(prefix, [0x18, 0x53, 0x80, 0x67]);
  const infoAt = find(prefix, [0x15, 0x49, 0xa9, 0x66], Math.max(0, segmentAt));
  if (segmentAt < 0 || infoAt < 0) throw Error('WebM Segment Info is unavailable in the bounded header');
  const segmentSize = readVint(prefix, segmentAt + 4), infoSize = readVint(prefix, infoAt + 4);
  if (infoSize.unknown) throw Error('WebM Segment Info has an unknown size');
  const infoContent = infoAt + 4 + infoSize.width, infoEnd = infoContent + infoSize.value;
  if (infoEnd > prefix.length) throw Error('Truncated WebM Segment Info');
  let scale = 1_000_000, durationData = -1, durationBytes = 0;
  for (let at = infoContent; at < infoEnd;) {
    const width = idWidth(prefix[at]), size = readVint(prefix, at + width), data = at + width + size.width, end = data + size.value;
    if (size.unknown || end > infoEnd) throw Error('Truncated WebM Segment Info element');
    const id = [...prefix.subarray(at, at + width)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (id === '2ad7b1') scale = unsigned(prefix.subarray(data, end));
    if (id === '4489') { durationData = data; durationBytes = size.value; }
    at = end;
  }
  const duration = durationMs * 1_000_000 / scale;
  if (!Number.isFinite(duration) || duration <= 0) throw Error('Invalid WebM duration scale');
  if (durationData >= 0) {
    if (durationBytes !== 8) throw Error('Unsupported WebM Duration encoding');
    const result = prefix.slice(); result.set(float64(duration), durationData); return { bytes: result, delta: 0 };
  }
  const element = Uint8Array.from([0x44, 0x89, 0x88, ...float64(duration)]), delta = element.byteLength;
  const result = new Uint8Array(prefix.byteLength + delta);
  result.set(prefix.subarray(0, infoEnd)); result.set(element, infoEnd); result.set(prefix.subarray(infoEnd), infoEnd + delta);
  result.set(writeVint(infoSize.value + delta, infoSize.width), infoAt + 4);
  if (!segmentSize.unknown) result.set(writeVint(segmentSize.value + delta, segmentSize.width), segmentAt + 4);
  return { bytes: result, delta };
}
