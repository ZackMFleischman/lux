// Single source of truth for image asset budgets. Source, scene, transport and
// Studio byte limits derive from these values.
//
// Per image: 32 MiB original file and 8192 px per side (the WebGPU default
// maxTextureDimension2D). Per source: 64 images, 128 MiB of originals and
// 512 MiB of decoded RGBA. The aggregate is bounded because originals travel as
// base64 inside JSON documents and V8 strings cannot exceed about 512 Mi chars.
const MiB = 1048576;
export const assetLimits = Object.freeze({ count: 64, imageBytes: 32 * MiB, totalBytes: 128 * MiB, rgbaBytes: 512 * MiB, dimension: 8192, pathCharacters: 240 });
/** Compact JSON bytes of one source's complete asset record: base64 originals plus per-record path/field overhead. */
export const assetJsonBytes = Math.ceil(assetLimits.totalBytes / 3) * 4 + assetLimits.count * 1024;
/** Human-readable byte size used in limit messages. */
export function formatBytes(bytes) {
  return bytes % MiB === 0 ? `${bytes / MiB} MiB` : `${(bytes / MiB).toFixed(1)} MiB`;
}
