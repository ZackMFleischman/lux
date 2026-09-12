export const limits = Object.freeze({ sourceBytes: 1048576, files: 32, diagnosticBytes: 131072, compileMs: 30000, outputBytes: 4194304 });
export function violation(message, code = 'SOURCE_BOUNDARY_VIOLATION') { return Object.assign(new Error(message), { code }); }
export function validateSource(source) {
  if (!source || source.sdkVersion !== '0.1.0') throw violation('SDK version must be 0.1.0');
  if (Object.keys(source).some(key => !['sdkVersion', 'entry', 'files'].includes(key))) throw violation('Source bundle contains unsupported fields');
  if (typeof source.entry !== 'string' || source.entry.length > 240) throw violation('Entry must be a module path of at most 240 ASCII characters');
  if (!source.files || typeof source.files !== 'object' || Array.isArray(source.files)) throw violation('files must be a module-path to UTF-8 source record');
  const entries = Object.entries(source.files);
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
