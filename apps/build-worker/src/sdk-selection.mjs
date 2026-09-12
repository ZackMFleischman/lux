// Exact trusted version selection, never a path supplied by submitted source.
const entries = Object.freeze({ '0.1.0': 'index.ts', '0.2.0': 'sdk-v2.ts' });
export function sdkSourceFile(version) {
  if (typeof version !== 'string' || !Object.hasOwn(entries, version)) {
    throw Object.assign(Error('SDK version must be 0.1.0 or 0.2.0'), {code:'SOURCE_BOUNDARY_VIOLATION'});
  }
  return entries[version];
}
export function sourceArtifactVersion(source) {
  sdkSourceFile(source.sdkVersion);
  return source.sdkVersion === '0.2.0' ? 3 : source.sourceVersion === 2 ? 2 : 1;
}
