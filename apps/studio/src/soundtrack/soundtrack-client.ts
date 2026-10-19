/** Renderer view of the main-process soundtrack service (see soundtrack-files.ts). */
export type SoundtrackFileResult = Readonly<{ name: string; absolutePath: string; sha256: string; bytes: Uint8Array }>;
export type SoundtrackLoadResult = Readonly<({ status: 'loaded' } & SoundtrackFileResult) | { status: 'missing' | 'mismatch' | 'unreadable'; name: string; message: string }>;
export interface SoundtrackClient {
  choose(): Promise<SoundtrackFileResult | null>;
  loadLinked(sceneToken: string): Promise<SoundtrackLoadResult>;
}

declare global {
  interface Window {
    luxSoundtrack?: SoundtrackClient;
  }
}
