export type CollectionMode = 'baseline' | 'routine';
export const GPU_SAMPLE_EVERY: 30;
export const GPU_SAMPLING_POLICY: 'one in 30 frames (frame IDs 1,31,61,...)';
export function collectionMode(value?: unknown): CollectionMode;
export function gpuSampleFrame(frame: number): boolean;
