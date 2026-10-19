import { validateSourceAssets, snapshotSourceAssetRecords, assetJsonBytes, formatBytes } from '../../../packages/assets/src/index.mjs';
import { storyLifecycleLimits } from '../../../packages/runtime-contracts/src/story.mjs';
import { sdkSourceFile } from './sdk-selection.mjs';
const MiB = 1048576, sourceBytes = 4 * MiB, codeOutputBytes = 16 * MiB;
// Source code: 128 TypeScript files and 4 MiB UTF-8. Compact source-v2 JSON
// allows worst-case 6x JSON escaping of that code beside the base64 assets.
// Artifacts and linked envelopes carry the assets once beside the emitted code.
const sourceJsonBytes = assetJsonBytes + 6 * sourceBytes;
const compileMs = 120000, linkMs = 60000;
export const limits = Object.freeze({
  sourceBytes, files: 128, diagnosticBytes: 131072,
  compileMs, linkMs,
  /** Studio compile+link child deadline; agent and MCP waits extend it. */
  buildMs: compileMs + linkMs + 30000,
  /** One Studio agent operation (bridge/MCP): a full build plus Studio-side admission. */
  agentOperationMs: compileMs + linkMs + 60000,
  outputBytes: assetJsonBytes + codeOutputBytes,
  linkedBytes: storyLifecycleLimits.linkedEnvelopeBytes,
  sourceJsonBytes, requestBytes: sourceJsonBytes + 2 * MiB,
  /** Single-visual Scene v2–v6 JSON (one source plus settings/controls) and its file. */
  sceneJsonBytes: sourceJsonBytes + MiB, sceneFileBytes: sourceJsonBytes + 2 * MiB,
  /** Isolated compiler/linker child processes hold the whole request, parsed copy and decoded images. */
  // The Job Object supervisor accepts at most 4 GiB (scripts/experiment-job.cs).
  workerHeapMiB: 2048, workerMemoryBytes: 4 * 1024 * MiB,
  /** Scene v7 shared linking: every visual's artifact, and the sealed capsule, stay within the aggregate linked budget. */
  sharedCapsuleBytes: storyLifecycleLimits.aggregateLinkedEnvelopeBytes,
  sharedRequestBytes: storyLifecycleLimits.aggregateLinkedEnvelopeBytes + 8 * MiB,
});
if (limits.outputBytes !== limits.linkedBytes) throw Error('Linked envelope budget must equal the artifact budget');
export function violation(message, code = 'SOURCE_BOUNDARY_VIOLATION') { return Object.assign(new Error(message), { code }); }
export function validateSource(source) {
  const envelope = validateSourceEnvelope(source);
  if (envelope.sourceVersion === 2) {
    try { envelope.assets = validateSourceAssets(envelope.assets); }
    catch(error) { throw Object.assign(violation(error.message,error.code === 'QUOTA_EXCEEDED' ? error.code : 'SOURCE_BOUNDARY_VIOLATION'), error.path ? {path:error.path} : {}); }
  }
  return envelope;
}

// Explicitly untrusted envelope: suitable before worker dispatch or for files
// derived from an internally owned admitted source, never full admission itself.
export function validateSourceEnvelope(source) {
  if (source && typeof source === 'object' && 'sourceVersion' in source) {
    const raw = snapshotRecord(source, ['sourceVersion','sdkVersion','entry','files','assets']);
    if (raw.sourceVersion !== 2) throw violation('Unsupported source version');
    const files = snapshotRecord(raw.files);
    const legacy = validateLegacySource({sdkVersion:raw.sdkVersion,entry:raw.entry,files});
    let assets;
    try { assets = snapshotSourceAssetRecords(raw.assets); }
    catch(error) { throw Object.assign(violation(error.message,error.code === 'QUOTA_EXCEEDED' ? error.code : 'SOURCE_BOUNDARY_VIOLATION'), error.path ? {path:error.path} : {}); }
    const canonical = {sourceVersion:2,sdkVersion:legacy.sdkVersion,entry:legacy.entry,files:Object.fromEntries(Object.keys(files).sort().map(key=>[key,files[key]])),assets};
    if (new TextEncoder().encode(JSON.stringify(canonical)).byteLength > limits.sourceJsonBytes) throw violation(`Source v2 compact JSON exceeds ${formatBytes(limits.sourceJsonBytes)}`,'QUOTA_EXCEEDED');
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
  if (!entries.length || entries.length > limits.files) throw violation(`Submit 1 to ${limits.files} source files`, 'QUOTA_EXCEEDED');
  const seen = new Set(); let bytes = 0;
  for (const [path, text] of entries) {
    if (path.length > 240) throw violation('Module paths must be at most 240 ASCII characters');
    if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(path) || path.split('/').some(p => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw violation(`Invalid relative TypeScript module path: ${path}`);
    if (path.startsWith('__lux') || seen.has(path.toLowerCase())) throw violation('Reserved path or case-fold collision');
    if (typeof text !== 'string' || !text.isWellFormed()) throw violation(`Source must be valid UTF-8 text: ${path}`);
    seen.add(path.toLowerCase()); bytes += new TextEncoder().encode(text).byteLength;
    if (bytes > limits.sourceBytes) throw violation(`Source exceeds ${formatBytes(limits.sourceBytes)} UTF-8 limit`, 'QUOTA_EXCEEDED');
  }
  if (!Object.hasOwn(source.files, source.entry)) throw violation('Entry must name a submitted module');
  return { sdkVersion: source.sdkVersion, entry: source.entry, files: Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b, 'en'))) };
}
