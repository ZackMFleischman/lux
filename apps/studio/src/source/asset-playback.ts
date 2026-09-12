/** Export-only capability gate until transport and installed runtime retain v2. */
export function assertLegacyPlaybackSource(source: unknown): void {
  if (source && typeof source === 'object' && ('sourceVersion' in source || 'assets' in source))
    throw Error('Asset export is not available in this build yet. Preview and saving preserve the scene assets.');
}
