// Fixed routine policy, not an acceptance benchmark mode. Eligibility uses the
// owner-local frame ID so draining summaries never resets the sampling phase.
export const GPU_SAMPLE_EVERY = 30;
export const GPU_SAMPLING_POLICY = 'one in 30 frames (frame IDs 1,31,61,...)';
export function collectionMode(value = 'routine') {
  if (value !== 'baseline' && value !== 'routine') throw Error('Invalid performance collection mode');
  return value;
}
export function gpuSampleFrame(frame) { return (frame - 1) % GPU_SAMPLE_EVERY === 0; }
