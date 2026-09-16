export type {AudioBand,AudioAnalyzerConfig,AudioInputConfiguration,AudioBandSource,AudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
export {normalizeAudioAnalyzerConfig,normalizeAudioInputConfiguration,normalizeAudioBandSource,normalizeAudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
export function normalizeLocalAudioDeviceId(input: unknown): string | undefined;
