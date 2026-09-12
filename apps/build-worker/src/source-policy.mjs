import { validateSourceAssets } from '../../../packages/assets/src/index.mjs';
import { sdkSourceFile } from './sdk-selection.mjs';
export const limits = Object.freeze({ sourceBytes: 1048576, files: 32, diagnosticBytes: 131072, compileMs: 30000, outputBytes: 4194304, sourceJsonBytes: 6291456, requestBytes: 8388608 });
export function violation(message, code = 'SOURCE_BOUNDARY_VIOLATION') { return Object.assign(new Error(message), { code }); }
export function validateSource(source) {
  if (source && typeof source === 'object' && 'sourceVersion' in source) {
    const raw = snapshotRecord(source, ['sourceVersion','sdkVersion','entry','files','assets']);
    if (raw.sourceVersion !== 2) throw violation('Unsupported source version');
    const files = snapshotRecord(raw.files);
    const legacy = validateLegacySource({sdkVersion:raw.sdkVersion,entry:raw.entry,files});
    let assets;
    try { assets = validateSourceAssets(raw.assets); }
    catch(error) { throw Object.assign(violation(error.message,error.code === 'QUOTA_EXCEEDED' ? error.code : 'SOURCE_BOUNDARY_VIOLATION'), error.path ? {path:error.path} : {}); }
    const canonical = {sourceVersion:2,sdkVersion:legacy.sdkVersion,entry:legacy.entry,files:Object.fromEntries(Object.keys(files).sort().map(key=>[key,files[key]])),assets};
    if (new TextEncoder().encode(JSON.stringify(canonical)).byteLength > limits.sourceJsonBytes) throw violation('Source v2 compact JSON exceeds 6 MiB','QUOTA_EXCEEDED');
    return canonical;
  }
  return validateLegacySource(source);
}

// Capture own descriptor values once; never ordinary-read caller properties.
export function snapshotRecord(value, fields) {
  if (!value || typeof value !== 'object') throw violation('Expected plain data record');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw violation('Expected plain data record');
  const keys = Reflect.ownKeys(value), result = Object.create(null);
  if (fields && (keys.length !== fields.length || fields.some(key=>!keys.includes(key)))) throw violation('Missing or unsupported fields');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value,key);
    if (typeof key !== 'string' || !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor,'value')) throw violation('Expected enumerable own data properties');
    result[key] = descriptor.value;
  }
  return result;
}

function validateLegacySource(source) {
  source = snapshotRecord(source, ['sdkVersion','entry','files']);
  sdkSourceFile(source.sdkVersion);
  if (typeof source.entry !== 'string' || source.entry.length > 240) throw violation('Entry must be a module path of at most 240 ASCII characters');
  if (!source.files || typeof source.files !== 'object' || Array.isArray(source.files)) throw violation('files must be a module-path to UTF-8 source record');
  const entries = Object.entries(snapshotRecord(source.files));
  if (!entries.length || entries.length > limits.files) throw violation('Submit 1 to 32 source files', 'QUOTA_EXCEEDED');
  const seen = new Set(); let bytes = 0;
  for (const [path, text] of entries) {
    if (path.length > 240) throw violation('Module paths must be at most 240 ASCII characters');
    if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(path) || path.split('/').some(p => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw violation(`Invalid relative TypeScript module path: ${path}`);
    if (path.startsWith('__lux') || seen.has(path.toLowerCase())) throw violation('Reserved path or case-fold collision');
    if (typeof text !== 'string' || !text.isWellFormed()) throw violation(`Source must be valid UTF-8 text: ${path}`);
    seen.add(path.toLowerCase()); bytes += new TextEncoder().encode(text).byteLength;
    if (bytes > limits.sourceBytes) throw violation('Source exceeds 1 MiB UTF-8 limit', 'QUOTA_EXCEEDED');
  }
  if (!Object.hasOwn(source.files, source.entry)) throw violation('Entry must name a submitted module');
  return { sdkVersion: source.sdkVersion, entry: source.entry, files: Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b, 'en'))) };
}
