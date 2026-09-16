export type AudioBand = 'level' | 'bass' | 'mids' | 'highs';
export type AudioAnalyzerConfig = Readonly<{ version: 1; fftSize: 2048; minDecibels: number; maxDecibels: number }>;
export type AudioInputConfiguration = Readonly<{ logicalInputId: 'primary-audio'; analyzer: AudioAnalyzerConfig }>;
export type AudioBandSource = Readonly<{ kind: 'audio-band'; logicalInputId: 'primary-audio'; band: AudioBand; analyzer: AudioAnalyzerConfig }>;
export function normalizeAudioAnalyzerConfig(input: unknown): AudioAnalyzerConfig;
export function normalizeAudioInputConfiguration(input: unknown): AudioInputConfiguration;
export function normalizeAudioBandSource(input: unknown): AudioBandSource;
export function normalizeLocalAudioDeviceId(input: unknown): string | undefined;
