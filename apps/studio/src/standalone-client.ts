import type { StudioClient, StudioSnapshot, StudioOperation } from './service-client.ts';
import type { PresentationPort } from './presentation.ts';
import type { SourceBundle } from '../../../packages/runtime-contracts/src/index.ts';
import { studioOperationSchema } from './runtime-operations.ts';
import { DEFAULT_OUTPUT } from '../../../packages/runtime-contracts/src/index.ts';
import { SourceCompileError } from './source/diagnostics.ts';
export interface AuthoringApi {
  example(): Promise<SourceBundle>;
  compile(source: SourceBundle): Promise<any>;
  smokeResult?(result: unknown): Promise<void>;
  smokeEnabled?(): Promise<boolean>;
  open(): Promise<any>;
  save(request: unknown): Promise<any>;
  dirty(value: boolean): Promise<void>;
  smokeSave(document: unknown): Promise<any>;
  onAgentCommand(listener: (command: any) => Promise<unknown>): () => void;
}
declare global { interface Window { luxAuthoring: AuthoringApi } }
type Running = { worker: Worker; canvas: HTMLCanvasElement; instanceId: string; generation: number; revisionId: string;
  lastHeartbeat: number; lastFrame: number; watchdog: ReturnType<typeof setInterval>; controls: number; };
export class StandaloneClient implements StudioClient, PresentationPort {
  private snapshot: StudioSnapshot = { connection: 'connected', message: 'Open an example or write a visual, then Build & preview.', receivedAtMs: Date.now(), authoring: null, host: null, jobs: [], visualFps: null, uiFps: null };
  private listeners = new Set<() => void>();
  private running: Running | null = null;
  private target: HTMLElement | null = null;
  private generation = 0;
  private source: SourceBundle | null = null;
  private busy = false;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private api: AuthoringApi;
  constructor(api: AuthoringApi) { this.api = api; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<StudioSnapshot>) { this.snapshot = { ...this.snapshot, ...patch, receivedAtMs: Date.now() }; for (const listener of this.listeners) listener(); }
  async submit(source: SourceBundle): Promise<void> {
    if (this.busy) throw Error('A visual build is already running');
    this.busy = true;
    const jobId = crypto.randomUUID();
    this.publish({ jobs: [{ jobId, state: 'compiling', summary: 'Compiling visual…' }] });
    try {
      const result = await this.api.compile(source);
      if (!result.ok) throw new SourceCompileError(result.diagnostics ?? []);
      this.publish({ jobs: [{ jobId, state: 'initializing', summary: 'Preparing preview…' }] });
      await this.start(result.linked.code, result.sourceHash);
      this.source = structuredClone(source);
      this.publish({ jobs: [{ jobId, state: 'succeeded', summary: 'Visual is ready in Lux.' }] });
    } catch (error) { this.publish({ jobs: [{ jobId, state: 'failed', summary: 'Build failed; previous preview retained.', fault: String(error) }] }); throw error; }
    finally { this.busy = false; }
  }
  private async start(moduleSource: string, revisionId: string): Promise<void> {
    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
    canvas.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;object-fit:contain';
    const worker = new Worker(new URL('./visual-worker.js', import.meta.url), { type: 'module' });
    const candidate: Running = { worker, canvas, instanceId: this.running?.instanceId ?? crypto.randomUUID(), generation: ++this.generation,
      revisionId, lastHeartbeat: performance.now(), lastFrame: performance.now(), watchdog: undefined as any, controls: 0 };
    const previous = this.running;
    const intensity = this.snapshot.authoring?.intensity ?? 0.5;
    const playing = this.snapshot.authoring?.playback === 'playing';
    let ready = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Visual initialization exceeded five seconds')), 5000);
        worker.onerror = event => { clearTimeout(timer); if (!ready) reject(Error(event.message)); else this.fault(candidate, event.message); };
        worker.onmessage = event => {
          const message = event.data;
          if (message?.instanceId !== candidate.instanceId || message.generation !== candidate.generation || message.revisionId !== candidate.revisionId) return;
          candidate.lastHeartbeat = performance.now();
          if (message.type === 'failure') { clearTimeout(timer); if (!ready) reject(Error(message.message)); else this.fault(candidate, message.message); return; }
          if (message.type === 'heartbeat') return;
          if (message.type === 'capture-error') {
            const wait = this.pending.get(message.requestId);
            if (wait) { clearTimeout(wait.timer); this.pending.delete(message.requestId); wait.reject(Error(message.message)); }
            return;
          }
          if (message.type === 'capture') {
            const wait = this.pending.get(message.requestId);
            if (wait && message.bytes instanceof ArrayBuffer && message.bytes.byteLength <= 8388608) {
              clearTimeout(wait.timer); this.pending.delete(message.requestId);
              wait.resolve({ bytes: message.bytes, metadata: { ...message.metadata, instanceId: candidate.instanceId, generation: candidate.generation, revisionId: candidate.revisionId } });
            }
            return;
          }
          if (!['ready', 'frame', 'status'].includes(message.type) || !/^\d+$/.test(message.frameId) ||
              !Number.isFinite(message.timeSeconds) || !Number.isSafeInteger(message.clockEpoch) ||
              !['playing', 'paused'].includes(message.playback) || !Number.isSafeInteger(message.controlSequence) || message.controlSequence < 0 ||
              !Number.isFinite(message.intensity) || message.intensity < 0 || message.intensity > 1) return;
          candidate.lastFrame = performance.now();
          if (message.type === 'ready' && !ready) {
            ready = true; clearTimeout(timer); this.running = candidate;
            if (previous) { for (const wait of this.pending.values()) { clearTimeout(wait.timer); wait.reject(Error('Runtime changed before command completed')); } this.pending.clear(); clearInterval(previous.watchdog); previous.worker.terminate(); previous.canvas.remove(); }
            this.target?.appendChild(canvas);
            resolve();
          }
          if (this.running !== candidate) return;
          this.publish({ authoring: { instanceId: candidate.instanceId, generation: candidate.generation, revisionId,
            sceneName: 'Untitled visual', authority: 'studio', playback: message.playback,
            controlSequence: message.controlSequence, clockEpoch: message.clockEpoch, frameId: message.frameId, intensity: message.intensity,
            output: { width: 1920, height: 1080 }, fault: null } });
          const wait = this.pending.get(message.requestId);
          if (wait) { clearTimeout(wait.timer); this.pending.delete(message.requestId); wait.resolve(message); }
        };
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({ type: 'init', requestId: crypto.randomUUID(), instanceId: candidate.instanceId, generation: candidate.generation,
          revisionId, moduleSource, canvas: offscreen, controls: { intensity }, settings: DEFAULT_OUTPUT, playing }, [offscreen]);
      });
      candidate.watchdog = setInterval(() => {
        const now = performance.now();
        if (now - candidate.lastHeartbeat > 1500 || (this.snapshot.authoring?.playback === 'playing' && now - candidate.lastFrame > 2000)) this.fault(candidate, 'Visual stopped making progress. Restart the runtime to retry.');
      }, 250);
    } catch (error) { worker.terminate(); canvas.remove(); throw error; }
  }
  private fault(runtime: Running, message: string) {
    if (runtime !== this.running) return;
    clearInterval(runtime.watchdog); runtime.worker.terminate();
    for (const wait of this.pending.values()) { clearTimeout(wait.timer); wait.reject(Error(message)); } this.pending.clear();
    if (this.snapshot.authoring) this.publish({ authoring: { ...this.snapshot.authoring, playback: 'failed', fault: { code: 'RUNTIME_FAILED', message } } });
  }
  async invoke(operation: StudioOperation): Promise<unknown> {
    operation = studioOperationSchema.parse(operation);
    const runtime = this.running, input = operation.input;
    if (this.snapshot.authoring?.authority !== 'studio') throw Error('Authority conflict: Studio cannot control this instance');
    if (this.busy) throw Error('A visual build is already running');
    if (!runtime || input.instanceId !== runtime.instanceId || input.expectedGeneration !== runtime.generation) throw Error('Runtime changed; retry using its current state');
    if (operation.name === 'lux.runtime.restart') { if (!this.source) throw Error('No visual to restart'); await this.submit(this.source); return this.snapshot.authoring; }
    if (this.snapshot.authoring?.playback === 'failed') throw Error('Restart the failed runtime first');
    let message;
    if (operation.name === 'lux.parameters.set') {
      if (operation.input.expectedRevisionId !== runtime.revisionId) throw Error('Revision changed; read current runtime state');
      message = { type: 'controls', values: operation.input.values, controlSequence: ++runtime.controls };
    } else message = { type: 'playback', action: operation.input.action };
    if (this.pending.has(input.requestId)) throw Error('Request ID already pending');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(input.requestId); reject(Error('Runtime command timed out')); }, 5000);
      this.pending.set(input.requestId, { resolve, reject, timer });
      runtime.worker.postMessage({ ...message, requestId: input.requestId, instanceId: runtime.instanceId, generation: runtime.generation });
    });
  }
  async attach({ target, runtimeKey }: Parameters<PresentationPort['attach']>[0]) {
    if (!this.running || runtimeKey.instanceId !== this.running.instanceId || runtimeKey.generation !== this.running.generation) throw Error('Preview runtime changed');
    this.target = target; const canvas = this.running.canvas; target.appendChild(canvas);
    return { detach: async () => { if (this.target === target) this.target = null; if (canvas.parentElement === target) canvas.remove(); } };
  }
  async capture(): Promise<{ bytes: ArrayBuffer; metadata: Record<string, unknown> }> {
    const runtime = this.running;
    if (!runtime || this.snapshot.authoring?.playback === 'failed') throw Error('No working visual to capture');
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(Error('Capture timed out')); }, 5000);
      this.pending.set(requestId, { resolve: value => resolve(value as any), reject, timer });
      runtime.worker.postMessage({ type: 'capture', requestId, instanceId: runtime.instanceId, generation: runtime.generation });
    });
  }
}
