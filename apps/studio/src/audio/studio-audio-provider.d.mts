import type { AudioInputConfiguration } from './audio-contract.mjs';
import type { AudioBandAnalyzer } from './audio-analysis.mjs';

export type {AudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
import type {AudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
export type StudioAudioProvider = Readonly<{
  connect(configuration: AudioInputConfiguration, localDeviceId?: string): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): AudioBandSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): Promise<void>;
}>;
export type AudioCapture = Readonly<{ stream: MediaStream; context: AudioContext; dispose?(): void }>;
export type AudioFrameScheduler = Readonly<{ request(callback: FrameRequestCallback): number; cancel(id: number): void }>;
export function createStudioAudioProvider(options: Readonly<{
  openCapture(request: Readonly<{ configuration: AudioInputConfiguration; localDeviceId?: string }>): Promise<AudioCapture>;
  createAnalyzer?(context: AudioContext, stream: MediaStream, config: AudioInputConfiguration['analyzer']): AudioBandAnalyzer;
  scheduler: AudioFrameScheduler;
}>): StudioAudioProvider;
