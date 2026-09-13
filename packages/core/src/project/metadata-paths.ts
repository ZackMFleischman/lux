import { validateAssetPath } from '../../../assets/src/index.mjs';

const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
/** Lexical metadata grammar only; this is not native filesystem containment. */
export function metadataPath(value: string): string {
  if (value.length > 240 || !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(value) || value.split('/').some(part => reserved.test(part)) || value.startsWith('__lux')) throw Error(`Invalid metadata path: ${value}`);
  return value;
}
export function sourcePath(value: string): string {
  metadataPath(value);
  if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(value)) throw Error(`Invalid TypeScript path: ${value}`);
  return value;
}
export function logicalAssetPath(value: string): string { return validateAssetPath(value); }
export function uniquePaths(paths: string[], nonoverlapping = false): void {
  const normalized = paths.map(path => metadataPath(path).toLowerCase());
  const seen = new Set(normalized);
  if (seen.size !== paths.length) throw Error('Duplicate or case-colliding metadata paths');
  if (nonoverlapping) for (const path of normalized) {
    const segments = path.split('/');
    for (let length = 1; length < segments.length; length++) {
      if (seen.has(segments.slice(0, length).join('/'))) throw Error('Overlapping metadata paths');
    }
  }
}
