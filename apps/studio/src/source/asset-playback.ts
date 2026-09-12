/** Temporary capability gate until preview and export retain the entire v2 envelope. */
export function assertLegacyPlaybackSource(source: unknown): void {
  if (source && typeof source === 'object' && ('sourceVersion' in source || 'assets' in source))
    throw Error('Asset playback is not available in this build yet. The scene can be saved without losing its assets.');
}
