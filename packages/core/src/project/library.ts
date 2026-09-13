import { hashMetadata, hashPackage, validateMetadata, metadataLimits, projectLimits } from './contracts.ts';
import type { DependencyLock, Hash, PackageManifest } from './contracts.ts';
import { snapshotJsonData } from './bounded-json.ts';
import { hashSchema } from '../../../runtime-contracts/src/index.ts';
import type { ProjectResolutionCode, ProjectResolutionError } from './resolver.ts';

export type PackagePin = DependencyLock['packages'][string];
export type VerifiedPackage = Readonly<{ packageId: string; pin: PackagePin; fileHashes: Readonly<Record<string, Hash>>; byteLength: number }>;

/** Internal shared mechanics for the two project-resolution modules. */
export function resolutionError(code: ProjectResolutionCode, message: string, details: Partial<Omit<ProjectResolutionError, 'name' | 'message' | 'code'>> = {}, cause?: unknown): ProjectResolutionError {
  return Object.assign(new Error(message, cause === undefined ? undefined : { cause }), { code }, details);
}
export function freezeData<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}
export function ownRecord(input: unknown, maxEntries: number = metadataLimits.nodes): Record<string, unknown> {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw resolutionError('PROJECT_INVALID', 'Expected a plain own-data record');
  const keys = Reflect.ownKeys(input);
  if (keys.length > maxEntries) throw resolutionError('QUOTA_EXCEEDED', 'Record cardinality limit exceeded', { expected: maxEntries, actual: keys.length });
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !d || !d.enumerable || !Object.hasOwn(d, 'value')) throw resolutionError('PROJECT_INVALID', 'Expected enumerable own string data fields');
    result[key] = d.value;
  }
  return result;
}
const arrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const intrinsicLength = Object.getOwnPropertyDescriptor(arrayPrototype, 'byteLength')!.get!;
const intrinsicBuffer = Object.getOwnPropertyDescriptor(arrayPrototype, 'buffer')!.get!;
const sharedLength = typeof SharedArrayBuffer === 'undefined' ? undefined : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, 'byteLength')!.get!;
/** Preflight every value before copying even the first payload. */
export function captureBytes(record: Record<string, unknown>, maxBytes: number): Record<string, Uint8Array> {
  let total = 0;
  const lengths: Record<string, number> = Object.create(null);
  for (const [path, value] of Object.entries(record)) {
    if (!(value instanceof Uint8Array)) throw resolutionError('PROJECT_INVALID', 'Expected Uint8Array content', { path });
    const buffer = intrinsicBuffer.call(value);
    let shared = false;
    if (sharedLength) { try { sharedLength.call(buffer); shared = true; } catch { /* Ordinary ArrayBuffer. */ } }
    if (shared) throw resolutionError('PROJECT_INVALID', 'Shared content buffers are unsupported', { path });
    // Constructing an empty intrinsic view detects detached storage without
    // reading a caller iterator or copying any payload.
    try { new Uint8Array(buffer, 0, 0); }
    catch (cause) { throw resolutionError('PROJECT_INVALID', 'Detached content buffers are unsupported', { path }, cause); }
    const length = intrinsicLength.call(value) as number;
    if (length > maxBytes - total) throw resolutionError('QUOTA_EXCEEDED', 'Original byte limit exceeded', { path, expected: maxBytes, actual: total + length });
    total += length; lengths[path] = length;
  }
  const result: Record<string, Uint8Array> = Object.create(null);
  for (const [path, value] of Object.entries(record)) {
    const copy = new Uint8Array(lengths[path]!);
    Uint8Array.prototype.set.call(copy, value as Uint8Array); result[path] = copy;
  }
  return result;
}
export async function sha256(bytes: Uint8Array): Promise<Hash> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** Verify chosen pin integrity only; this does not establish publisher or filesystem trust. */
export async function verifyPackageBytes(inputManifest: PackageManifest, inputPin: PackagePin, inputFiles: Readonly<Record<string, Uint8Array>>): Promise<VerifiedPackage> {
  let manifest: PackageManifest, pin: PackagePin;
  try {
    manifest = validateMetadata('package', snapshotJsonData(inputManifest));
    const data = ownRecord(snapshotJsonData(inputPin));
    if (Object.keys(data).sort().join(',') !== 'contentHash,manifestHash,version') throw Error('Expected exact package pin fields');
    if (typeof data.version !== 'string') throw Error('Expected exact package version string');
    pin = { version: data.version as string, manifestHash: hashSchema.parse(data.manifestHash), contentHash: hashSchema.parse(data.contentHash) };
  } catch (cause) { throw resolutionError('PROJECT_INVALID', `Invalid package metadata or pin: ${(cause as Error).message}`, {}, cause); }
  const details = { packageId: manifest.packageId };
  if (pin.version !== manifest.version) throw resolutionError('PACKAGE_MODIFIED', `Package ${manifest.packageId} version differs from chosen pin`, { ...details, expected: pin.version, actual: manifest.version });
  const record = ownRecord(inputFiles);
  for (const path of Object.keys(manifest.files)) if (!Object.hasOwn(record, path)) throw resolutionError('DEPENDENCY_UNAVAILABLE', `Missing ${manifest.packageId}@${pin.version} (${pin.contentHash}) original: ${path}`, { ...details, path });
  for (const path of Object.keys(record)) if (!Object.hasOwn(manifest.files, path)) throw resolutionError('PACKAGE_MODIFIED', `Undeclared ${manifest.packageId} original: ${path}`, { ...details, path });
  const files = captureBytes(record, projectLimits.packageBytes);
  const fileHashes: Record<string, Hash> = Object.create(null);
  let byteLength = 0;
  for (const path of Object.keys(files).sort()) {
    const bytes = files[path]!; byteLength += bytes.byteLength;
    const actual = await sha256(bytes); fileHashes[path] = actual;
    if (actual !== manifest.files[path]) throw resolutionError('PACKAGE_MODIFIED', `Modified ${manifest.packageId} original: ${path}`, { ...details, path, expected: manifest.files[path], actual });
  }
  const manifestHash = await hashMetadata('package', manifest), contentHash = await hashPackage(manifest, fileHashes);
  for (const [expected, actual, label] of [[pin.manifestHash, manifestHash, 'manifest'], [pin.contentHash, contentHash, 'content']] as const) {
    if (expected !== actual) throw resolutionError('PACKAGE_MODIFIED', `Package ${manifest.packageId} ${label} hash differs from chosen pin`, { ...details, expected, actual });
  }
  return freezeData({ packageId: manifest.packageId, pin, fileHashes, byteLength });
}
