export type {AudioBand,AudioAnalyzerConfig,AudioInputConfiguration,AudioBandSource,AudioKickSource,AudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
export {normalizeAudioAnalyzerConfig,normalizeAudioInputConfiguration,normalizeAudioBandSource,normalizeAudioKickSource,normalizeAudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
export function normalizeLocalAudioDeviceId(input: unknown): string | undefined;
