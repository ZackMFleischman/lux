import type { StudioClient, StudioSnapshot, StudioOperation, RuntimeView } from './service-client.ts';
import { getRuntimeControlState } from './service-client.ts';
import type { PresentationPort } from './presentation.ts';
import type { SourceBundle, OutputSettings } from '../../../packages/runtime-contracts/src/index.ts';
import { studioOperationSchema } from './runtime-operations.ts';
import { DEFAULT_OUTPUT, outputSettingsSchema } from '../../../packages/runtime-contracts/src/index.ts';
import { createSceneDocument } from '../../../packages/core/src/scene-document.ts';
import { SourceCompileError } from './source/diagnostics.ts';
import type { LinkedEnvelope } from '../../build-worker/src/artifact-identity.mjs';
import { normalizeControlSchema, validateControlSnapshot, validateControlPatch } from '../../../packages/runtime-contracts/src/parameters.mjs';
import type { ControlValues, ControlMigration } from '../../../packages/runtime-contracts/src/parameters.mjs';
import { LEGACY_CONTROL_SCHEMA, LEGACY_CONTROL_SCHEMA_HASH, initialControlValues, validateSavedControls, sha256 } from './controls/control-state.ts';
import type { SavedControlSnapshot, RuntimeControlState } from './controls/control-state.ts';
import { validateSource, snapshotRecord } from '../../build-worker/src/source-policy.mjs';
import { verifyLinked } from '../../build-worker/src/artifact-identity.mjs';
import { PerformanceReceiver } from './performance/performance-state.ts';
import { collectionMode } from '../../../packages/performance/collection-mode.mjs';
import type { CollectionMode } from '../../../packages/performance/collection-mode.mjs';
import { createCompositionControlState } from '../../../packages/runtime/src/components/composition-controls.ts';
import type { SavedNodeControlSnapshot } from '../../../packages/core/src/scene-document.ts';
import {validateControlAnimationBindings} from '../../../packages/runtime-contracts/src/control-animation.mjs';
import type {ControlAnimationBinding,ControlAnimationIssue} from '../../../packages/runtime-contracts/src/control-animation.mjs';
export interface AuthoringApi {
  example(): Promise<SourceBundle>;
  compile(source: SourceBundle): Promise<any>;
  smokeResult?(result: unknown): Promise<void>;
  smokeEnabled?(): Promise<boolean>;
  open(): Promise<any>;
  save(request: unknown): Promise<any>;
  savePath?(request: unknown): Promise<any>;
  openPath?(path: string): Promise<any>;
  dirty(value: boolean): Promise<void>;
  smokeSave(document: unknown): Promise<any>;
  onAgentCommand(listener: (command: any) => Promise<unknown>): () => void;
}
declare global { interface Window { luxAuthoring: AuthoringApi } }
type RetryPolicy={lastFaultAt:number|null};
type ReplacementPlaybackIntent={playing:boolean;settling:boolean;synchronize?:()=>void};
type Running = { worker: Worker; canvas: HTMLCanvasElement; instanceId: string; generation: number; revisionId: string; performance:PerformanceReceiver;retryPolicy:RetryPolicy;autoRetry:boolean;playback:'playing'|'paused';
  lastHeartbeat: number; lastFrame: number; frameId: string; terminal: boolean; watchdog: ReturnType<typeof setInterval>; activationTimer?: ReturnType<typeof setTimeout>; controls: number; animations:number; state:RuntimeControlState; output:Readonly<Pick<OutputSettings,'width'|'height'>>; desiredControls?:ControlValues; desiredNodeControls?:SavedNodeControlSnapshot;desiredControlAnimations?:readonly ControlAnimationBinding[]; };
export class StandaloneClient implements StudioClient, PresentationPort {
  private snapshot: StudioSnapshot = { connection: 'connected', message: 'Open an example or write a visual, then Build & preview.', receivedAtMs: Date.now(), authoring: null, host: null, jobs: [], visualFps: null, uiFps: null };
  private listeners = new Set<() => void>();
  private running: Running | null = null;
  private target: HTMLElement | null = null;
  private generation = 0;
  private source: SourceBundle | null = null;
  private accepted: { linked: LinkedEnvelope; revisionId: string; state:RuntimeControlState; output:Readonly<Pick<OutputSettings,'width'|'height'>> } | null = null;
  private previewOutput: Readonly<Pick<OutputSettings,'width'|'height'>> = DEFAULT_OUTPUT;
  private busy = false;
  private replacementPlayback:ReplacementPlaybackIntent|null=null;
  private automaticRetry:ReturnType<typeof setTimeout>|undefined;
  private pending = new Map<string, { runtime: Running; kind: 'command' | 'capture'; playback?:boolean; expectedControlSequence?:number; expectedControls?:ControlValues; expectedNodeControls?:SavedNodeControlSnapshot;expectedAnimationSequence?:number;expectedControlAnimations?:readonly ControlAnimationBinding[]; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private api: AuthoringApi;
  private codeDeclaredParameters:boolean;
  private readonly performanceMode:CollectionMode;
  constructor(api: AuthoringApi, options:{codeDeclaredParameters?:boolean;performanceMode?:CollectionMode}={}) { this.api = api; this.codeDeclaredParameters=options.codeDeclaredParameters===true; this.performanceMode=collectionMode(options.performanceMode); }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<StudioSnapshot>) { this.snapshot = { ...this.snapshot, ...patch, receivedAtMs: Date.now() }; for (const listener of this.listeners) listener(); }
  acceptedDocument() {
    const runtime = this.snapshot.authoring;
    if (this.busy || !this.source || !runtime || runtime.playback === 'failed' || this.pending.size) {
      throw Error('Wait for a working preview before saving a look.');
    }
    if (runtime.output.width > 1920 || runtime.output.height > 1080) {
      throw Error('Set Preview to 1920 × 1080 or smaller before saving a look.');
    }
    const state = getRuntimeControlState(runtime);
    const controls = state.sdkVersion === '0.4.0'
      ? {sourceHash: runtime.revisionId, nodes: state.nodeControls!.nodes}
      : state.sdkVersion === '0.1.0' ? {intensity: runtime.intensity ?? 0.5}
      : {sourceHash: runtime.revisionId, schema: state.controlSchema, schemaHash: state.controlSchemaHash, values: state.controls};
    return createSceneDocument(structuredClone(this.source), {...DEFAULT_OUTPUT, ...runtime.output}, controls, [], state.controlAnimations ?? []);
  }
  async submit(source: SourceBundle, options:{savedControls?:SavedControlSnapshot;savedControlAnimations?:readonly ControlAnimationBinding[];output?:OutputSettings}={}): Promise<void> {
    if(source.sdkVersion!=='0.1.0'&&source.sdkVersion!=='0.2.0'&&source.sdkVersion!=='0.4.0')throw Error('Unsupported Studio SDK');
    const supportedSdkVersion=source.sdkVersion;
    if(source.sdkVersion==='0.2.0'&&!this.codeDeclaredParameters)throw Error('Code-declared parameters are not enabled in this Studio UI yet');
    if (this.busy) throw Error('A visual build is already running');
    const requestedOutput = options.output ? outputSettingsSchema.parse(options.output) : this.previewOutput;
    if (options.output && (options.output.fps !== 60 || options.output.seed !== 0)) throw Error('Looks currently support 60 fps and seed 0.');
    // A replacement must not snapshot playback before an admitted command settles.
    if ([...this.pending.values()].some(wait => wait.runtime === this.running && wait.playback)) {
      throw Error('Wait for the playback command to complete, then build again.');
    }
    this.cancelAutomaticRetry();
    this.busy = true;
    const playbackIntent:ReplacementPlaybackIntent={playing:true,settling:false};
    this.replacementPlayback=playbackIntent;
    const jobId = crypto.randomUUID();
    this.publish({ jobs: [{ jobId, state: 'compiling', summary: 'Compiling visual…' }] });
    try {
      const submittedSource = structuredClone(source);
      const result = await this.api.compile(submittedSource);
      if (!result.ok) throw new SourceCompileError(result.diagnostics ?? []);
      let linked = structuredClone(result.linked) as LinkedEnvelope;
      const expectedLinkedVersion = submittedSource.sdkVersion === '0.4.0' ? 5 : submittedSource.sdkVersion === '0.2.0' ? 3 : ('sourceVersion' in submittedSource ? 2 : 1);
      if (('linkedVersion' in linked ? linked.linkedVersion : 1) !== expectedLinkedVersion) throw Error('Compiled source and linked payload versions do not match');
      let schema=LEGACY_CONTROL_SCHEMA, schemaHash=LEGACY_CONTROL_SCHEMA_HASH;
      if(submittedSource.sdkVersion==='0.2.0'||submittedSource.sdkVersion==='0.4.0') {
        linked=await verifyLinked(linked,sha256);
        if(!('linkedVersion' in linked)||linked.linkedVersion!==expectedLinkedVersion)throw Error('Code-declared parameters require the matching sealed linked version');
        const sourceHash=await sha256(new TextEncoder().encode(JSON.stringify(validateSource(submittedSource))));
        if(result.sourceHash!==sourceHash)throw Error('Compiled source identity mismatch');
        if(linked.linkedVersion!==3&&linked.linkedVersion!==5)throw Error('Missing parameter schema in linked payload');
        schema=normalizeControlSchema(linked.controls);schemaHash=linked.controlSchemaHash;
      }
      const saved=options.savedControls?await validateSavedControls(options.savedControls):undefined;
      const previous=this.snapshot.authoring?getRuntimeControlState(this.snapshot.authoring):undefined;
      let state:RuntimeControlState,migration:readonly ControlMigration[]=[];
      if(submittedSource.sdkVersion==='0.4.0'){
        if(!('linkedVersion' in linked)||linked.linkedVersion!==5)throw Error('Image composition requires linked version 5');
        const nodeSaved=saved&&'nodes' in saved?saved:previous?.nodeControls;
        const composition=createCompositionControlState(linked.composition,nodeSaved);
        migration=composition.changes();
        state={sdkVersion:'0.4.0',controlSchema:schema,controlSchemaHash:schemaHash,controls:composition.values(),controlSequence:0,
          nodeControls:Object.freeze({sourceHash:result.sourceHash,nodes:composition.snapshot().nodes}),
          controlAnimations:validateControlAnimationBindings(options.savedControlAnimations??previous?.controlAnimations),controlAnimationIssues:Object.freeze([]),animationSequence:0};
      }else{
        const flatSaved=saved&&'schema' in saved?saved:undefined;
        const initial=initialControlValues(schema,flatSaved??(previous?{schema:previous.controlSchema,values:previous.controls}:undefined));
        migration=initial.changes;state={sdkVersion:supportedSdkVersion,controlSchema:schema,controlSchemaHash:schemaHash,controls:initial.values,controlSequence:0,
          controlAnimations:validateControlAnimationBindings(options.savedControlAnimations??previous?.controlAnimations),controlAnimationIssues:Object.freeze([]),animationSequence:0};
      }
      this.publish({ jobs: [{ jobId, state: 'initializing', summary: 'Preparing preview…' }] });
      await this.start(linked, result.sourceHash,state,migration, {lastFaultAt:null}, playbackIntent.playing, requestedOutput,playbackIntent);
      this.previewOutput = requestedOutput;
      this.source = submittedSource;
      this.accepted = { linked, revisionId: result.sourceHash,state,output:this.previewOutput };
      this.publish({ message:null,jobs: [{ jobId, state: 'succeeded', summary: 'Visual is ready in Lux.' }] });
    } catch (error) { this.publish({ jobs: [{ jobId, state: 'failed', summary: 'Build failed; previous preview retained.', fault: String(error) }] }); throw error; }
    finally { if(this.replacementPlayback===playbackIntent)this.replacementPlayback=null;this.busy = false; this.scheduleAutomaticRetry(); }
  }
  private async start(linked: LinkedEnvelope, revisionId: string, state:RuntimeControlState, migration:readonly ControlMigration[]=[],retryPolicy:RetryPolicy={lastFaultAt:null},playingOverride?:boolean, output:Readonly<Pick<OutputSettings,'width'|'height'>>=this.previewOutput,playbackIntent?:ReplacementPlaybackIntent): Promise<void> {
    const playing = playingOverride ?? this.snapshot.authoring?.playback === 'playing';
    const canvas = document.createElement('canvas'); canvas.width = output.width; canvas.height = output.height;
    canvas.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;object-fit:contain';
    const worker = new Worker(new URL('./visual-worker.js', import.meta.url), { type: 'module' });
    const candidate: Running = { worker, canvas, instanceId: this.running?.instanceId ?? crypto.randomUUID(), generation: ++this.generation,
      revisionId, lastHeartbeat: performance.now(), lastFrame: performance.now(), frameId: '0', terminal: false, watchdog: undefined as any, controls: 0,animations:0,state,output,performance:undefined as any,retryPolicy,autoRetry:false,playback:playing?'playing':'paused' };
    candidate.performance=new PerformanceReceiver({instanceId:candidate.instanceId,generation:candidate.generation,revisionId},performance.now());
    const previous = this.running;
    let ready = false,initialized=false,synchronizationRequestId:string|undefined,latestStatus:any;
    let synchronizePlayback:()=>void=()=>{};
    try {
      await new Promise<void>((resolve, reject) => {
        const abort = (error: Error) => { clearTimeout(timer); this.stop(candidate, error.message); reject(error); };
        const timer = setTimeout(() => abort(Error('Visual initialization exceeded five seconds')), 5000);
        candidate.activationTimer = timer;
        const fail = (message: string) => { if (!ready) abort(Error(message)); else this.fault(candidate, message); };
        const publishRuntime=(message:any)=>this.publish({ authoring: { instanceId: candidate.instanceId, generation: candidate.generation, revisionId,
          ...('linkedVersion' in linked&&linked.linkedVersion===5?{composition:linked.composition}:{}),
          sceneName: 'Untitled visual', authority: 'studio', playback: message.playback,
          ...candidate.state,controlMigration:migration,clockEpoch: message.clockEpoch,timeSeconds:message.timeSeconds, frameId: message.frameId,
          ...(state.sdkVersion==='0.1.0'?{intensity:candidate.state.controls.intensity}:{}),
          output: candidate.output, fault: null } as RuntimeView });
        const promote=()=>{
          if(ready||!initialized||!latestStatus)return;
          if(playbackIntent?.settling)return;
          if(playbackIntent&&candidate.playback!==(playbackIntent.playing?'playing':'paused'))return;
          ready=true;clearTimeout(timer);this.running=candidate;
          if(previous){this.stop(previous,'Runtime changed before command completed');previous.canvas.remove();}
          this.target?.appendChild(canvas);this.publish({performance:candidate.performance.snapshot});publishRuntime(latestStatus);resolve();
        };
        synchronizePlayback=()=>{
          if(!initialized||ready||candidate.terminal)return;
          if(!playbackIntent){promote();return;}
          const desired=playbackIntent.playing?'playing':'paused';
          if(candidate.playback===desired){promote();return;}
          if(synchronizationRequestId)return;
          synchronizationRequestId=crypto.randomUUID();
          try{worker.postMessage({type:'playback',action:playbackIntent.playing?'play':'pause',requestId:synchronizationRequestId,instanceId:candidate.instanceId,generation:candidate.generation});}
          catch(error){fail(String(error));}
        };
        if(playbackIntent)playbackIntent.synchronize=synchronizePlayback;
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
            if (wait?.runtime === candidate && wait.kind === 'capture' && message.bytes instanceof ArrayBuffer && message.bytes.byteLength <= 40 * 1024 * 1024) {
              if(state.sdkVersion!=='0.1.0') {
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
          const animationSequence=message.animationSequence??0;
          if(!Number.isSafeInteger(animationSequence)||animationSequence<0||animationSequence>candidate.animations)return;
          let applied:ControlValues,effectiveControls:ControlValues,compositionNodeControls:SavedNodeControlSnapshot|undefined,effectiveNodeControls:SavedNodeControlSnapshot|undefined,controlAnimations:readonly ControlAnimationBinding[]=Object.freeze([]),controlAnimationIssues:readonly ControlAnimationIssue[]=Object.freeze([]);
          try {
            applied=validateControlSnapshot(state.controlSchema,state.sdkVersion==='0.1.0'?{intensity:message.intensity}:message.controls);
            effectiveControls=validateControlSnapshot(state.controlSchema,message.effectiveControls??applied);
            if(state.sdkVersion!=='0.1.0'&&(message.controlSchemaHash!==state.controlSchemaHash||message.sdkVersion!==state.sdkVersion||message.controlSequence>candidate.controls))throw Error('Invalid runtime schema identity');
            const parsedAnimations=validateControlAnimationBindings(message.controlAnimations);
            controlAnimations=JSON.stringify(parsedAnimations)===JSON.stringify(candidate.state.controlAnimations??[])
              ? candidate.state.controlAnimations??Object.freeze([]):parsedAnimations;
            const animationIssues=message.controlAnimationIssues??[];
            if(!Array.isArray(animationIssues))throw Error('Invalid animation issues');
            const parsedIssues=Object.freeze(animationIssues.map((issue:any)=>{
              if(!issue||!Number.isSafeInteger(issue.index)||issue.index<0||!Array.isArray(issue.nodePath)||issue.nodePath.some((id:unknown)=>typeof id!=='string')||typeof issue.controlId!=='string'||typeof issue.message!=='string')throw Error('Invalid animation issue');
              return Object.freeze({index:issue.index,nodePath:Object.freeze([...issue.nodePath]),controlId:issue.controlId,message:issue.message});
            }));
            controlAnimationIssues=JSON.stringify(parsedIssues)===JSON.stringify(candidate.state.controlAnimationIssues??[])
              ? candidate.state.controlAnimationIssues??Object.freeze([]):parsedIssues;
            if(state.sdkVersion==='0.4.0'){
              if(!('linkedVersion' in linked)||linked.linkedVersion!==5)throw Error('Invalid composition linked payload');
              const nodeControls=message.nodeControls as SavedNodeControlSnapshot;
              const composition=createCompositionControlState(linked.composition,nodeControls);
              if(JSON.stringify(composition.values())!==JSON.stringify(applied))throw Error('Composition public controls do not match canonical node values');
              compositionNodeControls=Object.freeze({sourceHash:revisionId,nodes:composition.snapshot().nodes});
              if(!message.effectiveNodeControls)throw Error('Missing effective animation values');
              const effective=createCompositionControlState(linked.composition,message.effectiveNodeControls);
              effectiveNodeControls=Object.freeze({sourceHash:revisionId,nodes:effective.snapshot().nodes});
            }
            if(message.type==='ready'&&(message.controlSequence!==0||animationSequence!==0||JSON.stringify(applied)!==JSON.stringify(state.controls)||JSON.stringify(controlAnimations)!==JSON.stringify(state.controlAnimations??[])))throw Error('Initial control snapshot mismatch');
          } catch(error) {if(message.type==='ready')fail(String(error));return;}
          const currentAnimationSequence=candidate.state.animationSequence??0;
          if(animationSequence<currentAnimationSequence)return;
          const receivedAnimations=JSON.stringify(controlAnimations);
          if(animationSequence===currentAnimationSequence){
            if(receivedAnimations!==JSON.stringify(candidate.state.controlAnimations??[]))return;
          }else{
            const animationWait=this.pending.get(message.requestId);
            if(animationWait?.runtime!==candidate||animationWait.kind!=='command'||animationWait.expectedAnimationSequence!==animationSequence||receivedAnimations!==JSON.stringify(animationWait.expectedControlAnimations))return;
          }
          if(ready&&message.controlSequence<candidate.state.controlSequence)return;
          candidate.state={...state,controls:applied,effectiveControls,controlSequence:message.controlSequence,controlAnimations,controlAnimationIssues,animationSequence,
            ...(compositionNodeControls?{nodeControls:compositionNodeControls,effectiveNodeControls}:{} )};
          candidate.playback=message.playback;
          candidate.lastHeartbeat = performance.now();
          if (BigInt(message.frameId) > BigInt(candidate.frameId)) { candidate.frameId = message.frameId; candidate.lastFrame = performance.now(); }
          latestStatus=message;
          if(message.type==='ready'&&!initialized)initialized=true;
          if(message.requestId===synchronizationRequestId)synchronizationRequestId=undefined;
          if(initialized&&!ready){synchronizePlayback();if(!ready)return;}
          if (this.running !== candidate) return;
          publishRuntime(message);
          const wait = this.pending.get(message.requestId);
          if (wait?.runtime === candidate && wait.kind === 'command' &&
              (wait.expectedControlSequence === undefined ||
                (message.controlSequence === wait.expectedControlSequence && JSON.stringify(applied) === JSON.stringify(wait.expectedControls) && (!wait.expectedNodeControls || JSON.stringify(compositionNodeControls)===JSON.stringify(wait.expectedNodeControls)))) &&
              (wait.expectedAnimationSequence===undefined || (animationSequence===wait.expectedAnimationSequence&&JSON.stringify(controlAnimations)===JSON.stringify(wait.expectedControlAnimations)))) {
            clearTimeout(wait.timer); this.pending.delete(message.requestId); wait.resolve(message);
          }
        };
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({ type: 'init', requestId: crypto.randomUUID(), instanceId: candidate.instanceId, generation: candidate.generation,
          revisionId, linked: structuredClone(linked), canvas: offscreen,...state,settings: {...DEFAULT_OUTPUT,...output}, playing, performanceMode:this.performanceMode }, [offscreen]);
      });
    } catch (error) { this.stop(candidate, String(error)); canvas.remove(); throw error; }
    finally{if(playbackIntent?.synchronize===synchronizePlayback)playbackIntent.synchronize=undefined;}
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
      void this.start(accepted.linked,accepted.revisionId,{...runtime.state,controls:runtime.desiredControls??runtime.state.controls,nodeControls:runtime.desiredNodeControls??runtime.state.nodeControls,controlAnimations:runtime.desiredControlAnimations??runtime.state.controlAnimations,controlSequence:0,animationSequence:0},[],runtime.retryPolicy,runtime.playback==='playing',accepted.output)
        .then(()=>{if(!this.running?.terminal)this.publish({message:null});})
        .catch(error=>{runtime.retryPolicy.lastFaultAt=performance.now();if(this.running===runtime)this.publish({message:`Automatic restart failed. Restart explicitly to retry. ${String(error).slice(0,500)}`});})
        .finally(()=>{this.busy=false;this.scheduleAutomaticRetry();});
    },250);
  }
  async invoke(operation: StudioOperation): Promise<unknown> {
    const raw=snapshotRecord(operation),inputRaw=snapshotRecord(raw.input);
    if(raw.name==='lux.parameters.set'||raw.name==='lux.node.parameters.set')inputRaw.values=snapshotRecord(inputRaw.values);
    operation={...raw,input:inputRaw} as StudioOperation;
    const parsed = studioOperationSchema.safeParse(operation);
    if (!parsed.success) {
      if (raw.name === 'lux.preview.resize') throw Error('Preview resolution must use whole-pixel dimensions up to 3840 × 2160.');
      throw parsed.error;
    }
    operation = parsed.data;
    const runtime = this.running, input = operation.input;
    if (this.snapshot.authoring?.authority !== 'studio') throw Error('Authority conflict: Studio cannot control this instance');
    const replacementPlayback=this.busy&&this.replacementPlayback&&operation.name==='lux.playback'&&operation.input.action!=='reset'?this.replacementPlayback:null;
    if (this.busy&&!replacementPlayback) throw Error('A visual build is already running');
    if (!runtime || input.instanceId !== runtime.instanceId || input.expectedGeneration !== runtime.generation) throw Error('Runtime changed; retry using its current state');
    if (operation.name === 'lux.runtime.restart') {
      if (!this.accepted) throw Error('No visual to restart');
      this.cancelAutomaticRetry();runtime.autoRetry=false;
      this.busy = true;
      try { await this.start(this.accepted.linked, this.accepted.revisionId, {...runtime.state,controls:runtime.desiredControls??runtime.state.controls,nodeControls:runtime.desiredNodeControls??runtime.state.nodeControls,controlAnimations:runtime.desiredControlAnimations??runtime.state.controlAnimations,controlSequence:0,animationSequence:0},[],runtime.retryPolicy,undefined,this.accepted.output); this.publish({message:null});return this.snapshot.authoring; }
      catch(error){if(runtime.terminal)runtime.retryPolicy.lastFaultAt=performance.now();throw error;}
      finally { this.busy = false;this.scheduleAutomaticRetry(); }
    }
    if (operation.name === 'lux.preview.resize') {
      if (!this.accepted) throw Error('No visual to resize');
      const output = { width: operation.input.width, height: operation.input.height };
      this.busy = true;
      try { await this.start(this.accepted.linked, this.accepted.revisionId, {...runtime.state,controls:runtime.desiredControls??runtime.state.controls,nodeControls:runtime.desiredNodeControls??runtime.state.nodeControls,controlAnimations:runtime.desiredControlAnimations??runtime.state.controlAnimations,controlSequence:0,animationSequence:0},[],runtime.retryPolicy,undefined,output);
        this.previewOutput = output; this.accepted = {...this.accepted,output}; this.publish({message:null}); return this.snapshot.authoring; }
      finally { this.busy = false; this.scheduleAutomaticRetry(); }
    }
    if (this.snapshot.authoring?.playback === 'failed') throw Error('Restart the failed runtime first');
    if (this.pending.has(input.requestId)) throw Error('Request ID already pending');
    if(replacementPlayback&&[...this.pending.values()].some(wait=>wait.runtime===runtime&&wait.playback))throw Error('Wait for the playback command to complete, then try again.');
    let message;
    let replacementPlaybackPrevious:boolean|undefined;
    if (operation.name === 'lux.parameters.set') {
      if (operation.input.expectedRevisionId !== runtime.revisionId) throw Error('Revision changed; read current runtime state');
      if((runtime.state.sdkVersion!=='0.1.0'||operation.input.expectedControlSchemaHash!==undefined)&&operation.input.expectedControlSchemaHash!==runtime.state.controlSchemaHash)throw Error('Control schema changed; read current runtime state');
      const patch=validateControlPatch(runtime.state.controlSchema,operation.input.values);
      if(runtime.controls>=Number.MAX_SAFE_INTEGER)throw Error('Control sequence exhausted; restart runtime');
      // Retain admitted authority intent even if execution faults before acknowledgement.
      // It belongs to this runtime's restart closure, not the next submitted source.
      runtime.desiredControls = validateControlSnapshot(runtime.state.controlSchema,{...(runtime.desiredControls??runtime.state.controls),...patch});
      if(this.accepted && 'linkedVersion' in this.accepted.linked && this.accepted.linked.linkedVersion===5){
        const state=createCompositionControlState(this.accepted.linked.composition,runtime.desiredNodeControls??runtime.state.nodeControls);
        state.apply(runtime.desiredControls);runtime.desiredNodeControls={sourceHash:runtime.revisionId,nodes:state.snapshot().nodes};
      }
      message = { type: 'controls', values: runtime.desiredControls, controlSchemaHash:runtime.state.controlSchemaHash,controlSequence: ++runtime.controls };
    } else if(operation.name==='lux.node.parameters.set') {
      const linked=this.accepted?.linked;
      if(!linked||!('linkedVersion' in linked)||linked.linkedVersion!==5)throw Error('This visual has no composition nodes');
      if(operation.input.expectedRevisionId!==runtime.revisionId)throw Error('Revision changed; read current runtime state');
      if(runtime.controls>=Number.MAX_SAFE_INTEGER)throw Error('Control sequence exhausted; restart runtime');
      const state=createCompositionControlState(linked.composition,runtime.desiredNodeControls??runtime.state.nodeControls);
      state.applyNode(operation.input.nodePath,operation.input.values,operation.input.expectedControlSchemaHash);
      runtime.desiredNodeControls={sourceHash:runtime.revisionId,nodes:state.snapshot().nodes};
      runtime.desiredControls=state.values();
      message={type:'node-controls',nodePath:operation.input.nodePath,values:operation.input.values,
        controlSchemaHash:operation.input.expectedControlSchemaHash,controlSequence:++runtime.controls};
    } else if(operation.name==='lux.node.animation.set'){
      const linked=this.accepted?.linked,node=runtime.state.nodeControls?.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(operation.input.nodePath));
      const flat=operation.input.nodePath.length===0&&runtime.state.sdkVersion!=='0.4.0';
      if(!flat&&(!linked||!('linkedVersion' in linked)||linked.linkedVersion!==5||!node))throw Error('This visual has no matching composition node');
      if(operation.input.expectedRevisionId!==runtime.revisionId)throw Error('Revision changed; read current runtime state');
      const definitionHash=flat?runtime.state.controlSchemaHash:node!.definitionHash,schemaHash=flat?runtime.state.controlSchemaHash:node!.schemaHash,schema=flat?runtime.state.controlSchema:node!.schema;
      if(operation.input.expectedControlSchemaHash!==schemaHash)throw Error(flat?'Scene control schema changed':'Composition node control schema changed');
      if(!schema.some(row=>row.id===operation.input.controlId))throw Error(flat?'Scene control is unavailable':'Composition node control is unavailable');
      if(runtime.animations>=Number.MAX_SAFE_INTEGER)throw Error('Animation sequence exhausted; restart runtime');
      if(operation.input.animation){const animation=validateControlAnimationBindings([operation.input.animation])[0]!;
        if(JSON.stringify(animation.nodePath)!==JSON.stringify(operation.input.nodePath)||animation.controlId!==operation.input.controlId||animation.definitionHash!==definitionHash||animation.schemaHash!==schemaHash)throw Error('Animation target identity changed');}
      const current=[...(runtime.desiredControlAnimations??runtime.state.controlAnimations??[])],index=current.findIndex(row=>JSON.stringify(row.nodePath)===JSON.stringify(operation.input.nodePath)&&row.controlId===operation.input.controlId);
      if(index>=0)current.splice(index,1,...(operation.input.animation?[operation.input.animation]:[]));else if(operation.input.animation)current.push(operation.input.animation);
      runtime.desiredControlAnimations=validateControlAnimationBindings(current);
      message={type:'animations',animationSequence:++runtime.animations,controlAnimations:runtime.desiredControlAnimations,...(operation.input.restart?{restart:{nodePath:operation.input.nodePath,controlId:operation.input.controlId}}:{})};
    } else {
      message = { type: 'playback', action: operation.input.action };
      if(replacementPlayback){replacementPlaybackPrevious=replacementPlayback.playing;replacementPlayback.playing=operation.input.action==='play';replacementPlayback.settling=true;replacementPlayback.synchronize?.();}
    }
    const result=new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fault(runtime, 'Runtime command timed out'), 5000);
      this.pending.set(input.requestId, { runtime, kind: 'command', playback: message.type === 'playback', resolve, reject, timer,
        ...('controlSequence' in message ? { expectedControlSequence: message.controlSequence, expectedControls: runtime.desiredControls,expectedNodeControls:runtime.desiredNodeControls } : {}),
        ...('animationSequence' in message?{expectedAnimationSequence:message.animationSequence,expectedControlAnimations:runtime.desiredControlAnimations}:{}) });
      try { runtime.worker.postMessage({ ...message, requestId: input.requestId, instanceId: runtime.instanceId, generation: runtime.generation }); }
      catch (error) { this.fault(runtime, String(error)); }
    });
    if(!replacementPlayback)return result;
    return result.then(value=>{replacementPlayback.settling=false;replacementPlayback.synchronize?.();return value;},error=>{
      replacementPlayback.playing=replacementPlaybackPrevious!;replacementPlayback.settling=false;replacementPlayback.synchronize?.();throw error;
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
