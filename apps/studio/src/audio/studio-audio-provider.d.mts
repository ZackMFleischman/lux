import type { AudioInputConfiguration } from './audio-contract.mjs';
import type { AudioBandAnalyzer } from './audio-analysis.mjs';

export type AudioBandSnapshot = Readonly<{
  generation: number; sequence: number; available: boolean;
  level: number; bass: number; mids: number; highs: number;kickSequence:number;kickStrength:number;
}>;
export type StudioAudioProvider = Readonly<{
  connect(configuration: AudioInputConfiguration, localDeviceId?: string): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): AudioBandSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): Promise<void>;
}>;
export type AudioCapture = Readonly<{ stream: MediaStream; context: AudioContext }>;
export type AudioFrameScheduler = Readonly<{ request(callback: FrameRequestCallback): number; cancel(id: number): void }>;
export function createStudioAudioProvider(options: Readonly<{
  openCapture(request: Readonly<{ configuration: AudioInputConfiguration; localDeviceId?: string }>): Promise<AudioCapture>;
  createAnalyzer?(context: AudioContext, stream: MediaStream, config: AudioInputConfiguration['analyzer']): AudioBandAnalyzer;
  scheduler: AudioFrameScheduler;
}>): StudioAudioProvider;
