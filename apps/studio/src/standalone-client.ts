import type { StudioClient, StudioSnapshot, StudioOperation } from './service-client.ts';
import type { PresentationPort } from './presentation.ts';
import type { SourceBundle } from '../../../packages/runtime-contracts/src/index.ts';
import { studioOperationSchema } from './runtime-operations.ts';
import { DEFAULT_OUTPUT } from '../../../packages/runtime-contracts/src/index.ts';
import { SourceCompileError } from './source/diagnostics.ts';
import type { LinkedEnvelope } from '../../build-worker/src/artifact-identity.mjs';
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
  lastHeartbeat: number; lastFrame: number; frameId: string; terminal: boolean; watchdog: ReturnType<typeof setInterval>; activationTimer?: ReturnType<typeof setTimeout>; controls: number; desiredIntensity?: number; };
export class StandaloneClient implements StudioClient, PresentationPort {
  private snapshot: StudioSnapshot = { connection: 'connected', message: 'Open an example or write a visual, then Build & preview.', receivedAtMs: Date.now(), authoring: null, host: null, jobs: [], visualFps: null, uiFps: null };
  private listeners = new Set<() => void>();
  private running: Running | null = null;
  private target: HTMLElement | null = null;
  private generation = 0;
  private source: SourceBundle | null = null;
  private accepted: { linked: LinkedEnvelope; revisionId: string } | null = null;
  private busy = false;
  private pending = new Map<string, { runtime: Running; kind: 'command' | 'capture'; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
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
      const submittedSource = structuredClone(source);
      const result = await this.api.compile(submittedSource);
      if (!result.ok) throw new SourceCompileError(result.diagnostics ?? []);
      const linked = structuredClone(result.linked) as LinkedEnvelope;
      if (('sourceVersion' in submittedSource) !== ('linkedVersion' in linked)) throw Error('Compiled source and linked payload versions do not match');
      this.publish({ jobs: [{ jobId, state: 'initializing', summary: 'Preparing preview…' }] });
      await this.start(linked, result.sourceHash);
      this.source = submittedSource;
      this.accepted = { linked, revisionId: result.sourceHash };
      this.publish({ jobs: [{ jobId, state: 'succeeded', summary: 'Visual is ready in Lux.' }] });
    } catch (error) { this.publish({ jobs: [{ jobId, state: 'failed', summary: 'Build failed; previous preview retained.', fault: String(error) }] }); throw error; }
    finally { this.busy = false; }
  }
  private async start(linked: LinkedEnvelope, revisionId: string, restartIntensity?: number): Promise<void> {
    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
    canvas.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;object-fit:contain';
    const worker = new Worker(new URL('./visual-worker.js', import.meta.url), { type: 'module' });
    const candidate: Running = { worker, canvas, instanceId: this.running?.instanceId ?? crypto.randomUUID(), generation: ++this.generation,
      revisionId, lastHeartbeat: performance.now(), lastFrame: performance.now(), frameId: '0', terminal: false, watchdog: undefined as any, controls: 0 };
    const previous = this.running;
    const intensity = restartIntensity ?? this.snapshot.authoring?.intensity ?? 0.5;
    const playing = this.snapshot.authoring?.playback === 'playing';
    let ready = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const abort = (error: Error) => { clearTimeout(timer); this.stop(candidate, error.message); reject(error); };
        const timer = setTimeout(() => abort(Error('Visual initialization exceeded five seconds')), 5000);
        candidate.activationTimer = timer;
        const fail = (message: string) => { if (!ready) abort(Error(message)); else this.fault(candidate, message); };
        // Candidate JS needs the same liveness deadline as an accepted worker.
        // Healthy asynchronous startup can still use the independent 5 s cap.
        candidate.watchdog = setInterval(() => {
          const now = performance.now();
          if (now - candidate.lastHeartbeat >= 1250) fail(ready ? 'Visual stopped making progress. Restart the runtime to retry.' : 'Visual initialization stopped making progress');
          else if (ready && this.snapshot.authoring?.playback === 'playing' && now - candidate.lastFrame >= 1250) fail('Visual stopped completing frames. Restart the runtime to retry.');
        }, 250);
        worker.onerror = event => fail(event.message);
        worker.onmessage = event => {
          const message = event.data;
          if (candidate.terminal || message?.instanceId !== candidate.instanceId || message.generation !== candidate.generation || message.revisionId !== candidate.revisionId) return;
          if (message.type === 'failure') { fail(String(message.message)); return; }
          if (message.type === 'heartbeat') { if (/^\d{1,20}$/.test(message.frameId)) candidate.lastHeartbeat = performance.now(); return; }
          if (message.type === 'capture-error') {
            const wait = this.pending.get(message.requestId);
            if (wait?.runtime === candidate && wait.kind === 'capture') { candidate.lastHeartbeat = performance.now(); clearTimeout(wait.timer); this.pending.delete(message.requestId); wait.reject(Error(message.message)); }
            return;
          }
          if (message.type === 'capture') {
            const wait = this.pending.get(message.requestId);
            if (wait?.runtime === candidate && wait.kind === 'capture' && message.bytes instanceof ArrayBuffer && message.bytes.byteLength <= 8388608) {
              candidate.lastHeartbeat = performance.now();
              clearTimeout(wait.timer); this.pending.delete(message.requestId);
              wait.resolve({ bytes: message.bytes, metadata: { ...message.metadata, instanceId: candidate.instanceId, generation: candidate.generation, revisionId: candidate.revisionId } });
            }
            return;
          }
          if (!['ready', 'frame', 'status'].includes(message.type) || !/^\d{1,20}$/.test(message.frameId) ||
              !Number.isFinite(message.timeSeconds) || !Number.isSafeInteger(message.clockEpoch) ||
              !['playing', 'paused'].includes(message.playback) || !Number.isSafeInteger(message.controlSequence) || message.controlSequence < 0 ||
              !Number.isFinite(message.intensity) || message.intensity < 0 || message.intensity > 1) return;
          candidate.lastHeartbeat = performance.now();
          if (BigInt(message.frameId) > BigInt(candidate.frameId)) { candidate.frameId = message.frameId; candidate.lastFrame = performance.now(); }
          if (message.type === 'ready' && !ready) {
            ready = true; clearTimeout(timer); this.running = candidate;
            if (previous) { this.stop(previous, 'Runtime changed before command completed'); previous.canvas.remove(); }
            this.target?.appendChild(canvas);
            resolve();
          }
          if (this.running !== candidate) return;
          this.publish({ authoring: { instanceId: candidate.instanceId, generation: candidate.generation, revisionId,
            sceneName: 'Untitled visual', authority: 'studio', playback: message.playback,
            controlSequence: message.controlSequence, clockEpoch: message.clockEpoch, frameId: message.frameId, intensity: message.intensity,
            output: { width: 1920, height: 1080 }, fault: null } });
          const wait = this.pending.get(message.requestId);
          if (wait?.runtime === candidate && wait.kind === 'command') { clearTimeout(wait.timer); this.pending.delete(message.requestId); wait.resolve(message); }
        };
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({ type: 'init', requestId: crypto.randomUUID(), instanceId: candidate.instanceId, generation: candidate.generation,
          revisionId, linked: structuredClone(linked), canvas: offscreen, controls: { intensity }, settings: DEFAULT_OUTPUT, playing }, [offscreen]);
      });
    } catch (error) { this.stop(candidate, String(error)); canvas.remove(); throw error; }
  }
  private stop(runtime: Running, message: string) {
    if (runtime.terminal) return;
    runtime.terminal = true;
    clearInterval(runtime.watchdog); clearTimeout(runtime.activationTimer); runtime.worker.onmessage = null; runtime.worker.onerror = null;
    runtime.worker.terminate(); // Requests browser termination; not native/GPU stop acknowledgement.
    for (const [id, wait] of this.pending) if (wait.runtime === runtime) { clearTimeout(wait.timer); this.pending.delete(id); wait.reject(Error(message)); }
  }
  private fault(runtime: Running, message: string) {
    if (runtime !== this.running || runtime.terminal) return;
    this.stop(runtime, message);
    if (this.snapshot.authoring) this.publish({ authoring: { ...this.snapshot.authoring, playback: 'failed', fault: { code: 'RUNTIME_FAILED', message } } });
  }
  async invoke(operation: StudioOperation): Promise<unknown> {
    operation = studioOperationSchema.parse(operation);
    const runtime = this.running, input = operation.input;
    if (this.snapshot.authoring?.authority !== 'studio') throw Error('Authority conflict: Studio cannot control this instance');
    if (this.busy) throw Error('A visual build is already running');
    if (!runtime || input.instanceId !== runtime.instanceId || input.expectedGeneration !== runtime.generation) throw Error('Runtime changed; retry using its current state');
    if (operation.name === 'lux.runtime.restart') {
      if (!this.accepted) throw Error('No visual to restart');
      this.busy = true;
      try { await this.start(this.accepted.linked, this.accepted.revisionId, runtime.desiredIntensity); return this.snapshot.authoring; }
      finally { this.busy = false; }
    }
    if (this.snapshot.authoring?.playback === 'failed') throw Error('Restart the failed runtime first');
    if (this.pending.has(input.requestId)) throw Error('Request ID already pending');
    let message;
    if (operation.name === 'lux.parameters.set') {
      if (operation.input.expectedRevisionId !== runtime.revisionId) throw Error('Revision changed; read current runtime state');
      // Retain admitted authority intent even if execution faults before acknowledgement.
      // It belongs to this runtime's restart closure, not the next submitted source.
      runtime.desiredIntensity = operation.input.values.intensity;
      message = { type: 'controls', values: operation.input.values, controlSequence: ++runtime.controls };
    } else message = { type: 'playback', action: operation.input.action };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fault(runtime, 'Runtime command timed out'), 5000);
      this.pending.set(input.requestId, { runtime, kind: 'command', resolve, reject, timer });
      try { runtime.worker.postMessage({ ...message, requestId: input.requestId, instanceId: runtime.instanceId, generation: runtime.generation }); }
      catch (error) { this.fault(runtime, String(error)); }
    });
  }
  async attach({ target, runtimeKey }: Parameters<PresentationPort['attach']>[0]) {
    if (!this.running || runtimeKey.instanceId !== this.running.instanceId || runtimeKey.generation !== this.running.generation) throw Error('Preview runtime changed');
    this.target = target; const canvas = this.running.canvas; target.appendChild(canvas);
    return { detach: async () => { if (this.target === target) this.target = null; if (canvas.parentElement === target) canvas.remove(); } };
  }
  async capture(): Promise<{ bytes: ArrayBuffer; metadata: Record<string, unknown> }> {
    const runtime = this.running;
    if (!runtime || runtime.terminal || this.snapshot.authoring?.playback === 'failed') throw Error('No working visual to capture');
    if ([...this.pending.values()].filter(wait => wait.runtime === runtime && wait.kind === 'capture').length >= 2) throw Error('Capture queue is full; retry after the current capture completes');
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fault(runtime, 'Capture timed out'), 5000);
      this.pending.set(requestId, { runtime, kind: 'capture', resolve: value => resolve(value as any), reject, timer });
      try { runtime.worker.postMessage({ type: 'capture', requestId, instanceId: runtime.instanceId, generation: runtime.generation }); }
      catch (error) { this.fault(runtime, String(error)); }
    });
  }
}
