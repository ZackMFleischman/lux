// Pure bounded asset admission. No Node, browser codec, filesystem or network APIs.
export const assetLimits = Object.freeze({ count: 4, imageBytes: 786486, totalBytes: 1048576, rgbaBytes: 2097152, dimension: 512, pathCharacters: 240 });
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const sourceFields = ['mediaType', 'encoding', 'data'];
const derivedFields = [...sourceFields, 'byteLength', 'sha256', 'width', 'height'];

function fail(message, path, quota = false) {
  throw Object.assign(new Error(path === undefined ? message : `${message}: ${path}`), {
    code: quota ? 'QUOTA_EXCEEDED' : 'ASSET_BOUNDARY_VIOLATION', ...(path === undefined ? {} : { path }),
  });
}

// Inspect descriptors before reading values: getters and inherited properties are
// never accepted as wire data. Null-prototype JSON-like records are also valid.
function dataRecord(value, fields, path) {
  if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail('Expected a plain asset data record', path);
  const keys = Reflect.ownKeys(value);
  if (fields && (keys.length !== fields.length || fields.some(key => !Object.hasOwn(value, key)))) fail('Missing or unsupported asset fields', path);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || (fields && !fields.includes(key))) fail('Asset fields must be enumerable own data properties', path);
  }
  return keys;
}

export function validateAssetPath(path) {
  if (typeof path !== 'string' || path.length > assetLimits.pathCharacters || !/^assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.bmp$/.test(path)) fail('Invalid logical BMP asset path', typeof path === 'string' ? path : undefined);
  for (const segment of path.split('/')) {
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment) || /^__lux/i.test(segment)) fail('Reserved asset path', path);
  }
  return path;
}

export function decodeCanonicalBase64(data) {
  if (typeof data !== 'string' || !data.length) fail('Asset base64 must be a nonempty string');
  if (data.length > Math.ceil(assetLimits.imageBytes / 3) * 4) fail('Encoded asset exceeds image byte limit', undefined, true);
  if (data.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) fail('Asset base64 is not canonical');
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  const length = data.length / 4 * 3 - padding;
  if (!length || length > assetLimits.imageBytes) fail('Decoded asset exceeds image byte limit', undefined, true);
  const bytes = new Uint8Array(length);
  let at = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = alphabet.indexOf(data[i]), b = alphabet.indexOf(data[i + 1]);
    const c = data[i + 2] === '=' ? 0 : alphabet.indexOf(data[i + 2]);
    const d = data[i + 3] === '=' ? 0 : alphabet.indexOf(data[i + 3]);
    bytes[at++] = (a << 2) | (b >> 4);
    if (at < length) bytes[at++] = (b << 4) | (c >> 2);
    if (at < length) bytes[at++] = (c << 6) | d;
  }
  // Re-encoding also rejects nonzero pad bits (AB==, AAB=).
  let encoded = '';
  for (let i = 0; i < length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    encoded += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)] + (i + 1 < length ? alphabet[((b & 15) << 2) | (c >> 6)] : '=') + (i + 2 < length ? alphabet[c & 63] : '=');
  }
  if (encoded !== data) fail('Asset base64 has noncanonical pad bits');
  return bytes;
}

export function validateBmp(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 54) fail('Truncated BMP header');
  if (bytes.byteLength > assetLimits.imageBytes) fail('BMP exceeds image byte limit', undefined, true);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d || view.getUint32(2, true) !== bytes.byteLength || view.getUint16(6, true) || view.getUint16(8, true) || view.getUint32(10, true) !== 54 || view.getUint32(14, true) !== 40) fail('Unsupported BMP file header');
  const width = view.getInt32(18, true), height = view.getInt32(22, true);
  if (width < 1 || height < 1 || width > assetLimits.dimension || height > assetLimits.dimension) fail('BMP dimensions must be positive and at most 512');
  if (view.getUint16(26, true) !== 1 || view.getUint16(28, true) !== 24 || view.getUint32(30, true) !== 0 || view.getUint32(46, true) || view.getUint32(50, true)) fail('BMP must be opaque 24-bit BI_RGB without a palette');
  const stride = Math.ceil(width * 3 / 4) * 4, payload = stride * height, rgbaByteLength = width * height * 4;
  if (!Number.isSafeInteger(payload) || !Number.isSafeInteger(rgbaByteLength) || bytes.byteLength !== 54 + payload || (view.getUint32(34, true) !== 0 && view.getUint32(34, true) !== payload)) fail('BMP pixel payload size mismatch');
  return { width, height, stride, byteLength: bytes.byteLength, rgbaByteLength };
}

export function decodeBmp(bytes) {
  const { width, height, stride, rgbaByteLength } = validateBmp(bytes);
  const data = new Uint8Array(rgbaByteLength);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const from = 54 + (height - 1 - y) * stride + x * 3, to = (y * width + x) * 4;
    data[to] = bytes[from + 2]; data[to + 1] = bytes[from + 1]; data[to + 2] = bytes[from]; data[to + 3] = 255;
  }
  return { width, height, data };
}

function admit(input, derived = false) {
  const keys = dataRecord(input);
  if (keys.length > assetLimits.count) fail('At most four image assets are supported', undefined, true);
  keys.sort(); // Code-unit ASCII order; never localeCompare.
  const seen = new Set(), result = {}, decoded = [];
  let totalBytes = 0, totalRgba = 0;
  for (const path of keys) {
    validateAssetPath(path);
    if (seen.has(path.toLowerCase())) fail('Case-fold asset path collision', path);
    seen.add(path.toLowerCase());
    const descriptor = input[path]; dataRecord(descriptor, derived ? derivedFields : sourceFields, path);
    if (descriptor.mediaType !== 'image/bmp' || descriptor.encoding !== 'base64') fail('Asset must use image/bmp and base64', path);
    let bytes, info;
    try { bytes = decodeCanonicalBase64(descriptor.data); info = validateBmp(bytes); }
    catch (error) { fail(error.message, path, error.code === 'QUOTA_EXCEEDED'); }
    totalBytes += info.byteLength; totalRgba += info.rgbaByteLength;
    if (totalBytes > assetLimits.totalBytes || totalRgba > assetLimits.rgbaBytes) fail('Aggregate asset byte budget exceeded', path, true);
    const normalized = { mediaType: 'image/bmp', encoding: 'base64', data: descriptor.data };
    if (derived) {
      if (descriptor.byteLength !== info.byteLength || descriptor.width !== info.width || descriptor.height !== info.height || typeof descriptor.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) fail('Invalid derived asset metadata', path);
      Object.assign(normalized, { byteLength: info.byteLength, sha256: descriptor.sha256, width: info.width, height: info.height });
    }
    result[path] = Object.freeze(normalized);
    decoded.push({ path, bytes, info });
  }
  return { assets: Object.freeze(result), decoded };
}

export function validateSourceAssets(input) { return admit(input).assets; }

function identity(assets) {
  return JSON.stringify(Object.keys(assets).sort().map(path => {
    const { mediaType, byteLength, sha256, width, height } = assets[path];
    return { path, mediaType, byteLength, sha256, width, height };
  }));
}

export function canonicalAssetSet(assets) { return identity(admit(assets, true).assets); }

async function digest(bytes, hashBytes) {
  const hash = await hashBytes(bytes);
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) fail('Trusted hash callback must return lowercase SHA-256 hex');
  return hash;
}

export async function deriveAssets(input, hashBytes) {
  const { assets: sourceAssets, decoded } = admit(input), assets = {};
  for (const { path, bytes, info } of decoded) {
    const sha256 = await digest(bytes, hashBytes);
    assets[path] = Object.freeze({ ...sourceAssets[path], byteLength: info.byteLength, sha256, width: info.width, height: info.height });
  }
  const assetSetHash = await digest(new TextEncoder().encode(identity(assets)), hashBytes);
  return Object.freeze({ assets: Object.freeze(assets), assetSetHash });
}

export async function verifyDerivedAssets(input, expectedAssetSetHash, hashBytes) {
  const { assets, decoded } = admit(input, true), sourceAssets = {};
  for (const { path, bytes } of decoded) {
    if (await digest(bytes, hashBytes) !== assets[path].sha256) fail('Asset SHA-256 mismatch', path);
    const { mediaType, encoding, data } = assets[path];
    sourceAssets[path] = Object.freeze({ mediaType, encoding, data });
  }
  const assetSetHash = await digest(new TextEncoder().encode(identity(assets)), hashBytes);
  if (assetSetHash !== expectedAssetSetHash) fail('Asset set SHA-256 mismatch');
  return Object.freeze({ assets, assetSetHash, sourceAssets: Object.freeze(sourceAssets) });
}

// Construct BEFORE importing submitted code. Admission and hash wrappers above
// are trusted pre-import operations; only this facade supports a modified realm.
export function createReadonlyAssetMap(input) {
  const { decoded } = admit(input);
  const Bytes = Uint8Array, freeze = Object.freeze, create = Object.create, apply = Reflect.apply;
  const iteratorSymbol = Symbol.iterator, count = decoded.length;
  // Private dense entries: never passed to a method, callback or constructor.
  // Copy byte-by-byte using the saved constructor and stored lengths: no species,
  // buffer getter, slice/subarray, typed-array set or backing Map receiver.
  const copy = index => {
    const row = decoded[index], length = row.info.byteLength, out = new Bytes(length);
    for (let i = 0; i < length; i++) out[i] = row.bytes[i];
    return out;
  };
  const lookup = key => {
    for (let i = 0; i < count; i++) if (decoded[i].path === key) return i;
    return -1;
  };
  const iterator = kind => {
    let index = 0;
    const result = create(null);
    result.next = () => {
      if (index === count) return { value: undefined, done: true };
      const i = index++, key = decoded[i].path;
      return { value: kind === 0 ? key : kind === 1 ? copy(i) : [key, copy(i)], done: false };
    };
    result[iteratorSymbol] = () => result;
    return freeze(result);
  };
  const facade = create(null);
  facade.size = count;
  facade.has = key => lookup(key) !== -1;
  facade.get = key => { const i = lookup(key); return i === -1 ? undefined : copy(i); };
  facade.keys = () => iterator(0);
  facade.values = () => iterator(1);
  facade.entries = () => iterator(2);
  facade[iteratorSymbol] = facade.entries;
  facade.forEach = (callback, thisArg) => {
    if (typeof callback !== 'function') throw new TypeError('Asset forEach callback must be a function');
    for (let i = 0; i < count; i++) apply(callback, thisArg, [copy(i), decoded[i].path, facade]);
  };
  return freeze(facade);
}
