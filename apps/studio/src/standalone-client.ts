import type { StudioClient, StudioSnapshot, StudioOperation, RuntimeView } from './service-client.ts';
import { getRuntimeControlState } from './service-client.ts';
import type { PresentationPort } from './presentation.ts';
import type { SourceBundle } from '../../../packages/runtime-contracts/src/index.ts';
import { studioOperationSchema } from './runtime-operations.ts';
import { DEFAULT_OUTPUT } from '../../../packages/runtime-contracts/src/index.ts';
import { SourceCompileError } from './source/diagnostics.ts';
import type { LinkedEnvelope } from '../../build-worker/src/artifact-identity.mjs';
import { normalizeControlSchema, validateControlSnapshot, validateControlPatch } from '../../../packages/runtime-contracts/src/parameters.mjs';
import type { ControlValues, ControlMigration } from '../../../packages/runtime-contracts/src/parameters.mjs';
import { LEGACY_CONTROL_SCHEMA, LEGACY_CONTROL_SCHEMA_HASH, initialControlValues, validateSavedControls, sha256 } from './controls/control-state.ts';
import type { SavedControlSnapshot, RuntimeControlState } from './controls/control-state.ts';
import { validateSource, snapshotRecord } from '../../build-worker/src/source-policy.mjs';
import { verifyLinked } from '../../build-worker/src/artifact-identity.mjs';
import { PerformanceReceiver } from './performance/performance-state.ts';
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
type RetryPolicy={lastFaultAt:number|null};
type Running = { worker: Worker; canvas: HTMLCanvasElement; instanceId: string; generation: number; revisionId: string; performance:PerformanceReceiver;retryPolicy:RetryPolicy;autoRetry:boolean;
  lastHeartbeat: number; lastFrame: number; frameId: string; terminal: boolean; watchdog: ReturnType<typeof setInterval>; activationTimer?: ReturnType<typeof setTimeout>; controls: number; state:RuntimeControlState; desiredControls?:ControlValues; };
export class StandaloneClient implements StudioClient, PresentationPort {
  private snapshot: StudioSnapshot = { connection: 'connected', message: 'Open an example or write a visual, then Build & preview.', receivedAtMs: Date.now(), authoring: null, host: null, jobs: [], visualFps: null, uiFps: null };
  private listeners = new Set<() => void>();
  private running: Running | null = null;
  private target: HTMLElement | null = null;
  private generation = 0;
  private source: SourceBundle | null = null;
  private accepted: { linked: LinkedEnvelope; revisionId: string; state:RuntimeControlState } | null = null;
  private busy = false;
  private automaticRetry:ReturnType<typeof setTimeout>|undefined;
  private pending = new Map<string, { runtime: Running; kind: 'command' | 'capture'; expectedControlSequence?:number; expectedControls?:ControlValues; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private api: AuthoringApi;
  private codeDeclaredParameters:boolean;
  constructor(api: AuthoringApi, options:{codeDeclaredParameters?:boolean}={}) { this.api = api; this.codeDeclaredParameters=options.codeDeclaredParameters===true; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<StudioSnapshot>) { this.snapshot = { ...this.snapshot, ...patch, receivedAtMs: Date.now() }; for (const listener of this.listeners) listener(); }
  async submit(source: SourceBundle, options:{savedControls?:SavedControlSnapshot}={}): Promise<void> {
    if(source.sdkVersion==='0.2.0'&&!this.codeDeclaredParameters)throw Error('Code-declared parameters are not enabled in this Studio UI yet');
    if (this.busy) throw Error('A visual build is already running');
    this.cancelAutomaticRetry();
    this.busy = true;
    const jobId = crypto.randomUUID();
    this.publish({ jobs: [{ jobId, state: 'compiling', summary: 'Compiling visual…' }] });
    try {
      const submittedSource = structuredClone(source);
      const result = await this.api.compile(submittedSource);
      if (!result.ok) throw new SourceCompileError(result.diagnostics ?? []);
      let linked = structuredClone(result.linked) as LinkedEnvelope;
      const expectedLinkedVersion = submittedSource.sdkVersion === '0.2.0' ? 3 : ('sourceVersion' in submittedSource ? 2 : 1);
      if (('linkedVersion' in linked ? linked.linkedVersion : 1) !== expectedLinkedVersion) throw Error('Compiled source and linked payload versions do not match');
      let schema=LEGACY_CONTROL_SCHEMA, schemaHash=LEGACY_CONTROL_SCHEMA_HASH;
      if(submittedSource.sdkVersion==='0.2.0') {
        linked=await verifyLinked(linked,sha256);
        if(!('linkedVersion' in linked)||linked.linkedVersion!==3)throw Error('Code-declared parameters require linked version 3');
        const sourceHash=await sha256(new TextEncoder().encode(JSON.stringify(validateSource(submittedSource))));
        if(result.sourceHash!==sourceHash)throw Error('Compiled source identity mismatch');
        schema=normalizeControlSchema(linked.controls);schemaHash=linked.controlSchemaHash;
      }
      const saved=options.savedControls?await validateSavedControls(options.savedControls):undefined;
      const previous=this.snapshot.authoring?getRuntimeControlState(this.snapshot.authoring):undefined;
      const initial=initialControlValues(schema,saved??(previous?{schema:previous.controlSchema,values:previous.controls}:undefined));
      const state:RuntimeControlState={sdkVersion:submittedSource.sdkVersion,controlSchema:schema,controlSchemaHash:schemaHash,controls:initial.values,controlSequence:0};
      this.publish({ jobs: [{ jobId, state: 'initializing', summary: 'Preparing preview…' }] });
      await this.start(linked, result.sourceHash,state,initial.changes);
      this.source = submittedSource;
      this.accepted = { linked, revisionId: result.sourceHash,state };
      this.publish({ message:null,jobs: [{ jobId, state: 'succeeded', summary: 'Visual is ready in Lux.' }] });
    } catch (error) { this.publish({ jobs: [{ jobId, state: 'failed', summary: 'Build failed; previous preview retained.', fault: String(error) }] }); throw error; }
    finally { this.busy = false; this.scheduleAutomaticRetry(); }
  }
  private async start(linked: LinkedEnvelope, revisionId: string, state:RuntimeControlState, migration:readonly ControlMigration[]=[],retryPolicy:RetryPolicy={lastFaultAt:null}): Promise<void> {
    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
    canvas.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;object-fit:contain';
    const worker = new Worker(new URL('./visual-worker.js', import.meta.url), { type: 'module' });
    const candidate: Running = { worker, canvas, instanceId: this.running?.instanceId ?? crypto.randomUUID(), generation: ++this.generation,
      revisionId, lastHeartbeat: performance.now(), lastFrame: performance.now(), frameId: '0', terminal: false, watchdog: undefined as any, controls: 0,state,performance:undefined as any,retryPolicy,autoRetry:false };
    candidate.performance=new PerformanceReceiver({instanceId:candidate.instanceId,generation:candidate.generation,revisionId},performance.now());
    const previous = this.running;
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
          if(this.running===candidate&&candidate.performance.age(now))this.publish({performance:candidate.performance.snapshot});
          if (now - candidate.lastHeartbeat >= 1250) fail(ready ? 'Visual stopped making progress. Restart the runtime to retry.' : 'Visual initialization stopped making progress');
          else if (ready && this.snapshot.authoring?.playback === 'playing' && now - candidate.lastFrame >= 1250) fail('Visual stopped completing frames. Restart the runtime to retry.');
        }, 250);
        worker.onerror = event => fail(event.message);
        worker.onmessage = event => {
          const message = event.data;
          if (candidate.terminal || message?.instanceId !== candidate.instanceId || message.generation !== candidate.generation || message.revisionId !== candidate.revisionId) return;
          if(message.type==='performance') {
            if(this.running===candidate&&candidate.performance.receive(message.summary,performance.now()))this.publish({performance:candidate.performance.snapshot});
            return;
          }
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
              if(state.sdkVersion==='0.2.0') {
                try {validateControlSnapshot(state.controlSchema,message.metadata?.controls);
                  if(message.metadata.controlSchemaHash!==state.controlSchemaHash||!Number.isSafeInteger(message.metadata.controlSequence)||message.metadata.controlSequence<0||message.metadata.controlSequence>candidate.controls||!/^\d{1,20}$/.test(message.metadata.frameId))throw Error('Invalid capture parameter metadata');
                } catch(error) {fail(String(error));return;}
              }
              candidate.lastHeartbeat = performance.now();
              clearTimeout(wait.timer); this.pending.delete(message.requestId);
              wait.resolve({ bytes: message.bytes, metadata: { ...message.metadata, instanceId: candidate.instanceId, generation: candidate.generation, revisionId: candidate.revisionId } });
            }
            return;
          }
          if (!['ready', 'frame', 'status'].includes(message.type) || !/^\d{1,20}$/.test(message.frameId) ||
              !Number.isFinite(message.timeSeconds) || !Number.isSafeInteger(message.clockEpoch) ||
              !['playing', 'paused'].includes(message.playback) || !Number.isSafeInteger(message.controlSequence) || message.controlSequence < 0) return;
          let applied:ControlValues;
          try {
            applied=validateControlSnapshot(state.controlSchema,state.sdkVersion==='0.1.0'?{intensity:message.intensity}:message.controls);
            if(state.sdkVersion==='0.2.0'&&(message.controlSchemaHash!==state.controlSchemaHash||message.sdkVersion!=='0.2.0'||message.controlSequence>candidate.controls))throw Error('Invalid runtime schema identity');
            if(message.type==='ready'&&(message.controlSequence!==0||JSON.stringify(applied)!==JSON.stringify(state.controls)))throw Error('Initial control snapshot mismatch');
          } catch(error) {if(message.type==='ready')fail(String(error));return;}
          if(ready&&message.controlSequence<candidate.state.controlSequence)return;
          candidate.state={...state,controls:applied,controlSequence:message.controlSequence};
          candidate.lastHeartbeat = performance.now();
          if (BigInt(message.frameId) > BigInt(candidate.frameId)) { candidate.frameId = message.frameId; candidate.lastFrame = performance.now(); }
          if (message.type === 'ready' && !ready) {
            ready = true; clearTimeout(timer); this.running = candidate;
            if (previous) { this.stop(previous, 'Runtime changed before command completed'); previous.canvas.remove(); }
            this.target?.appendChild(canvas);
            this.publish({performance:candidate.performance.snapshot});
            resolve();
          }
          if (this.running !== candidate) return;
          this.publish({ authoring: { instanceId: candidate.instanceId, generation: candidate.generation, revisionId,
            sceneName: 'Untitled visual', authority: 'studio', playback: message.playback,
            ...candidate.state,controlMigration:migration,clockEpoch: message.clockEpoch, frameId: message.frameId,
            ...(state.sdkVersion==='0.1.0'?{intensity:applied.intensity}:{}),
            output: { width: 1920, height: 1080 }, fault: null } as RuntimeView });
          const wait = this.pending.get(message.requestId);
          if (wait?.runtime === candidate && wait.kind === 'command' &&
              (wait.expectedControlSequence === undefined ||
                (message.controlSequence === wait.expectedControlSequence && JSON.stringify(applied) === JSON.stringify(wait.expectedControls)))) {
            clearTimeout(wait.timer); this.pending.delete(message.requestId); wait.resolve(message);
          }
        };
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({ type: 'init', requestId: crypto.randomUUID(), instanceId: candidate.instanceId, generation: candidate.generation,
          revisionId, linked: structuredClone(linked), canvas: offscreen,...state,settings: DEFAULT_OUTPUT, playing }, [offscreen]);
      });
    } catch (error) { this.stop(candidate, String(error)); canvas.remove(); throw error; }
  }
  private stop(runtime: Running, message: string) {
    if(runtime===this.running){this.cancelAutomaticRetry();runtime.autoRetry=false;}
    if (runtime.terminal) return;
    runtime.terminal = true;
    clearInterval(runtime.watchdog); clearTimeout(runtime.activationTimer); runtime.worker.onmessage = null; runtime.worker.onerror = null;
    runtime.worker.terminate(); // Requests browser termination; not native/GPU stop acknowledgement.
    for (const [id, wait] of this.pending) if (wait.runtime === runtime) { clearTimeout(wait.timer); this.pending.delete(id); wait.reject(Error(message)); }
  }
  private fault(runtime: Running, message: string) {
    if (runtime !== this.running || runtime.terminal) return;
    const at=performance.now(),last=runtime.retryPolicy.lastFaultAt;
    const retry=last===null||at-last>=30000;runtime.retryPolicy.lastFaultAt=at;
    this.stop(runtime, message);
    runtime.autoRetry=retry;
    runtime.performance.fail();
    if (this.snapshot.authoring) this.publish({ message:runtime.autoRetry?'Preview failed. One automatic restart is queued.':'Preview failed twice within 30 seconds. Restart explicitly to retry.',performance:runtime.performance.snapshot,authoring: { ...this.snapshot.authoring, playback: 'failed', fault: { code: 'RUNTIME_FAILED', message } } });
    this.scheduleAutomaticRetry();
  }
  private cancelAutomaticRetry(){clearTimeout(this.automaticRetry);this.automaticRetry=undefined;}
  private scheduleAutomaticRetry(){
    const runtime=this.running,accepted=this.accepted;
    if(this.busy||this.automaticRetry!==undefined||!runtime?.terminal||!runtime.autoRetry||!accepted||accepted.revisionId!==runtime.revisionId)return;
    // Briefly yield to explicit source/restart actions; one timer and one candidate.
    this.automaticRetry=setTimeout(()=>{
      this.automaticRetry=undefined;
      if(this.busy||this.running!==runtime||!runtime.autoRetry)return;
      runtime.autoRetry=false;this.busy=true;this.publish({message:'Automatically restarting the accepted visual…'});
      void this.start(accepted.linked,accepted.revisionId,{...runtime.state,controls:runtime.desiredControls??runtime.state.controls,controlSequence:0},[],runtime.retryPolicy)
        .then(()=>{if(!this.running?.terminal)this.publish({message:null});})
        .catch(error=>{runtime.retryPolicy.lastFaultAt=performance.now();if(this.running===runtime)this.publish({message:`Automatic restart failed. Restart explicitly to retry. ${String(error).slice(0,500)}`});})
        .finally(()=>{this.busy=false;this.scheduleAutomaticRetry();});
    },250);
  }
  async invoke(operation: StudioOperation): Promise<unknown> {
    const raw=snapshotRecord(operation),inputRaw=snapshotRecord(raw.input);
    if(raw.name==='lux.parameters.set')inputRaw.values=snapshotRecord(inputRaw.values);
    operation={...raw,input:inputRaw} as StudioOperation;
    operation = studioOperationSchema.parse(operation);
    const runtime = this.running, input = operation.input;
    if (this.snapshot.authoring?.authority !== 'studio') throw Error('Authority conflict: Studio cannot control this instance');
    if (this.busy) throw Error('A visual build is already running');
    if (!runtime || input.instanceId !== runtime.instanceId || input.expectedGeneration !== runtime.generation) throw Error('Runtime changed; retry using its current state');
    if (operation.name === 'lux.runtime.restart') {
      if (!this.accepted) throw Error('No visual to restart');
      this.cancelAutomaticRetry();runtime.autoRetry=false;
      this.busy = true;
      try { await this.start(this.accepted.linked, this.accepted.revisionId, {...runtime.state,controls:runtime.desiredControls??runtime.state.controls,controlSequence:0},[],runtime.retryPolicy); this.publish({message:null});return this.snapshot.authoring; }
      catch(error){if(runtime.terminal)runtime.retryPolicy.lastFaultAt=performance.now();throw error;}
      finally { this.busy = false;this.scheduleAutomaticRetry(); }
    }
    if (this.snapshot.authoring?.playback === 'failed') throw Error('Restart the failed runtime first');
    if (this.pending.has(input.requestId)) throw Error('Request ID already pending');
    let message;
    if (operation.name === 'lux.parameters.set') {
      if (operation.input.expectedRevisionId !== runtime.revisionId) throw Error('Revision changed; read current runtime state');
      if((runtime.state.sdkVersion==='0.2.0'||operation.input.expectedControlSchemaHash!==undefined)&&operation.input.expectedControlSchemaHash!==runtime.state.controlSchemaHash)throw Error('Control schema changed; read current runtime state');
      const patch=validateControlPatch(runtime.state.controlSchema,operation.input.values);
      if(runtime.controls>=Number.MAX_SAFE_INTEGER)throw Error('Control sequence exhausted; restart runtime');
      // Retain admitted authority intent even if execution faults before acknowledgement.
      // It belongs to this runtime's restart closure, not the next submitted source.
      runtime.desiredControls = validateControlSnapshot(runtime.state.controlSchema,{...(runtime.desiredControls??runtime.state.controls),...patch});
      message = { type: 'controls', values: runtime.desiredControls, controlSchemaHash:runtime.state.controlSchemaHash,controlSequence: ++runtime.controls };
    } else message = { type: 'playback', action: operation.input.action };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fault(runtime, 'Runtime command timed out'), 5000);
      this.pending.set(input.requestId, { runtime, kind: 'command', resolve, reject, timer,
        ...(message.type === 'controls' ? { expectedControlSequence: message.controlSequence, expectedControls: message.values } : {}) });
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
