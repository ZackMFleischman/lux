import type { AudioPermissionArm } from './audio-permission-broker.ts';

export interface StudioAudioPermissionClient {
  discover(): Promise<AudioPermissionArm>;
  arm(): Promise<AudioPermissionArm>;
  activate(token: string): Promise<boolean>;
  cancel(token: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
}

declare global {
  interface Window {
    luxAudioPermissions: StudioAudioPermissionClient;
  }
}
