import type { SourceBundle } from '../../../../packages/runtime-contracts/src/index.ts';

export const sourceAssets = (source: SourceBundle) => 'sourceVersion' in source ? source.assets : {};
export function changedAssets(a: SourceBundle, b: SourceBundle): string[] {
  const left = sourceAssets(a), right = sourceAssets(b);
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().filter(path => {
    const x = left[path], y = right[path];
    return !x || !y || x.mediaType !== y.mediaType || x.encoding !== y.encoding || x.data !== y.data;
  });
}
/** Whole-source equality: binary assets and format are part of the draft identity. */
export function equalSource(a: SourceBundle | null, b: SourceBundle): boolean {
  return a !== null && ('sourceVersion' in a) === ('sourceVersion' in b) &&
    a.sdkVersion === b.sdkVersion && a.entry === b.entry &&
    Object.keys(a.files).length === Object.keys(b.files).length &&
    Object.entries(a.files).every(([path, text]) => Object.hasOwn(b.files, path) && b.files[path] === text) &&
    changedAssets(a, b).length === 0;
}
