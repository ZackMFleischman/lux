export type PreviewVideoSettings = Readonly<{ width: number; height: number; mimeType: string }>;
export type PreviewRecording = Readonly<{ id: string; path: string }>;
const agentCaptureByteLimit = 8 * 1024 * 1024;
export function assertAgentCaptureSize(bytes: ArrayBuffer): void {
  if (bytes.byteLength > agentCaptureByteLimit) {
    throw Error('Agent capture exceeds 8 MiB; use Preview > Save frame PNG for the full-resolution output');
  }
}
export interface PreviewCaptureClient {
  saveFrame(bytes: ArrayBuffer): Promise<Readonly<{ path: string; bytes: number }> | null>;
  beginVideo(settings: PreviewVideoSettings): Promise<PreviewRecording | null>;
  appendVideo(id: string, bytes: ArrayBuffer): Promise<void>;
  finishVideo(id: string, durationMs: number): Promise<Readonly<{ path: string; bytes: number }>>;
  cancelVideo(id: string): Promise<void>;
}
declare global { interface Window { luxPreviewCapture?: PreviewCaptureClient } }
