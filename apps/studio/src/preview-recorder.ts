import type { PreviewCaptureClient } from './preview-capture-client.ts';

export type PreviewRecorderSnapshot =
  | Readonly<{ phase: 'idle' }>
  | Readonly<{ phase: 'recording' | 'stopping'; width: number; height: number; mimeType: string; path: string }>;
type OutputSize = Readonly<{ width: number; height: number }>;
type FinishedVideo = Readonly<{ path: string; bytes: number }>;
type Session = {
  id: string; path: string; width: number; height: number; mimeType: string;
  recorder: MediaRecorder; stream: MediaStream; pendingBytes: number; writes: Promise<void>;
  stopped: Promise<void>; resolveStopped: () => void; failure: Error | null; completion: Promise<FinishedVideo | null> | null; startedAt: number;
};

const webmTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] as const;
export function selectWebmMimeType(Recorder: typeof MediaRecorder): string {
  const selected = webmTypes.find(value => Recorder.isTypeSupported(value));
  if (!selected) throw Error('This runtime does not support WebM recording');
  return selected;
}

function errorValue(reason: unknown): Error { return reason instanceof Error ? reason : Error(String(reason)); }

/** Records the fixed-size output canvas. Encoded chunks are immediately handed to
 * the main process; the renderer retains only the bounded pending write queue. */
export class PreviewRecorder {
  private snapshot: PreviewRecorderSnapshot = Object.freeze({ phase: 'idle' });
  private readonly listeners = new Set<() => void>();
  private readonly client: PreviewCaptureClient;
  private readonly Recorder: typeof MediaRecorder;
  private readonly onError: (error: Error) => void;
  private readonly maxPendingBytes: number;
  private readonly now: () => number;
  private session: Session | null = null;
  private starting = false;
  constructor(client: PreviewCaptureClient, options: { MediaRecorder?: typeof MediaRecorder; onError?: (error: Error) => void; maxPendingBytes?: number; now?: () => number } = {}) {
    this.client = client;
    this.Recorder = options.MediaRecorder ?? MediaRecorder;
    this.onError = options.onError ?? (() => {});
    this.maxPendingBytes = options.maxPendingBytes ?? 32 * 1024 * 1024;
    this.now = options.now ?? (() => performance.now());
  }
  getSnapshot = (): PreviewRecorderSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(snapshot: PreviewRecorderSnapshot): void { this.snapshot = Object.freeze(snapshot); for (const listener of this.listeners) listener(); }
  async start(canvas: HTMLCanvasElement, output: OutputSize, isCurrent: () => boolean = () => true): Promise<boolean> {
    if (this.session || this.starting) throw Error('A preview recording is already active');
    this.starting = true;
    try {
      if (!Number.isInteger(output.width) || !Number.isInteger(output.height) || canvas.width !== output.width || canvas.height !== output.height) {
        throw Error('Preview output dimensions changed before recording could start');
      }
      const mimeType = selectWebmMimeType(this.Recorder);
      const recording = await this.client.beginVideo({ ...output, mimeType });
      if (!recording) return false;
      let stream: MediaStream | null = null;
      try {
        if (!isCurrent() || canvas.width !== output.width || canvas.height !== output.height) {
          throw Error('Preview changed while choosing the video destination');
        }
        stream = canvas.captureStream(30);
        const recorder = new this.Recorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
        let resolveStopped!: () => void;
        const stopped = new Promise<void>(resolve => { resolveStopped = resolve; });
        const session: Session = { ...recording, ...output, mimeType, recorder, stream, pendingBytes: 0, startedAt: this.now(),
          writes: Promise.resolve(), stopped, resolveStopped, failure: null, completion: null };
        recorder.addEventListener('stop', () => resolveStopped(), { once: true });
        recorder.addEventListener('error', event => this.abort(session, errorValue((event as ErrorEvent).error || 'Video encoder failed')));
        recorder.addEventListener('dataavailable', event => this.write(session, (event as BlobEvent).data));
        recorder.start(1000);
        this.session = session;
        this.publish({ phase: 'recording', ...output, mimeType, path: recording.path });
        return true;
      } catch (reason) {
        for (const track of stream?.getTracks() ?? []) track.stop();
        await this.client.cancelVideo(recording.id).catch(() => {});
        throw reason;
      }
    } finally { this.starting = false; }
  }
  stop(): Promise<FinishedVideo | null> {
    const session = this.session;
    return session ? this.complete(session, false) : Promise.resolve(null);
  }
  cancel(): Promise<FinishedVideo | null> {
    const session = this.session;
    return session ? this.complete(session, true) : Promise.resolve(null);
  }
  private write(session: Session, chunk: Blob): void {
    if (!chunk.size || session !== this.session || session.failure) return;
    if (session.pendingBytes + chunk.size > this.maxPendingBytes) {
      this.abort(session, Error('Video recording fell behind disk writes and was canceled')); return;
    }
    session.pendingBytes += chunk.size;
    const write = session.writes.then(async () => this.client.appendVideo(session.id, await chunk.arrayBuffer()))
      .finally(() => { session.pendingBytes -= chunk.size; });
    session.writes = write;
    void write.catch(reason => this.abort(session, errorValue(reason)));
  }
  private abort(session: Session, error: Error): void {
    if (session !== this.session || session.failure) return;
    session.failure = error;
    void this.complete(session, true).then(() => this.onError(error), reason => this.onError(errorValue(reason)));
  }
  private complete(session: Session, cancel: boolean): Promise<FinishedVideo | null> {
    if (session.completion) return session.completion;
    this.publish({ phase: 'stopping', width: session.width, height: session.height, mimeType: session.mimeType, path: session.path });
    session.completion = (async () => {
      try {
        if (session.recorder.state !== 'inactive') session.recorder.stop(); else session.resolveStopped();
        await session.stopped;
        await session.writes.catch(reason => { session.failure ??= errorValue(reason); });
        if (cancel || session.failure) { await this.client.cancelVideo(session.id); return null; }
        return await this.client.finishVideo(session.id, Math.max(1, this.now() - session.startedAt));
      } catch (reason) {
        await this.client.cancelVideo(session.id).catch(() => {}); throw reason;
      } finally {
        for (const track of session.stream.getTracks()) track.stop();
        if (this.session === session) { this.session = null; this.publish({ phase: 'idle' }); }
      }
    })();
    return session.completion;
  }
}
