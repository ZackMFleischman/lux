export type WindowState = Readonly<{ detached: boolean; fullscreen: boolean }>;
export interface StudioWindowClient {
  getState(): Promise<WindowState>;
  subscribe(listener: (state: WindowState) => void): () => void;
  popout?(): Promise<void>;
  dock(): Promise<void>;
  fullscreen(value: boolean): Promise<void>;
}
declare global { interface Window { luxStudioWindows?: StudioWindowClient } }
