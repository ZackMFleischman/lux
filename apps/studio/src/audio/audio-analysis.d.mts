import type { AudioAnalyzerConfig } from './audio-contract.mjs';

export type AudioBands = Readonly<{ level: number; bass: number; mids: number; highs: number }>;
export type AudioBandAnalyzer = Readonly<{ sample(): AudioBands; dispose(): void }>;
export function analyzeAudioFrame(timeDomain: Float32Array, frequencyDecibels: Float32Array,
  sampleRate: number, config: AudioAnalyzerConfig): AudioBands;
export function createWebAudioBandAnalyzer(context: AudioContext, stream: MediaStream,
  config: AudioAnalyzerConfig): AudioBandAnalyzer;
