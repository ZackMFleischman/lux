export {normalizeAudioAnalyzerConfig,normalizeAudioInputConfiguration,normalizeAudioBandSource,normalizeAudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';

export function normalizeLocalAudioDeviceId(input) {
  if (input === undefined) return undefined;
  if (typeof input !== 'string' || input.length < 1 || input.length > 512) throw new Error('Invalid local audio device');
  return input;
}
