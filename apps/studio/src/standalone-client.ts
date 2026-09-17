import type { StudioClient, StudioSnapshot, StudioOperation, RuntimeView,TriggerReceipt,StoryRuntimeStatus,StoryTransportReceipt,StoryTransportAction,SceneStoryV1,StoryCapabilityV1 } from './service-client.ts';
import { getRuntimeControlState } from './service-client.ts';
import type { PresentationPort } from './presentation.ts';
import type { SourceBundle, OutputSettings } from '../../../packages/runtime-contracts/src/index.ts';
import { studioOperationSchema } from './runtime-operations.ts';
import { DEFAULT_OUTPUT, outputSettingsSchema } from '../../../packages/runtime-contracts/src/index.ts';
import { createSceneDocument } from '../../../packages/core/src/scene-document.ts';
import { SourceCompileError } from './source/diagnostics.ts';
import type { LinkedEnvelope } from '../../build-worker/src/artifact-identity.mjs';
import { canonicalControlSchemaJson,isNumberControlDefinition, normalizeControlSchema, validateControlSnapshot, validateControlPatch } from '../../../packages/runtime-contracts/src/parameters.mjs';
import type { ControlValues, ControlMigration } from '../../../packages/runtime-contracts/src/parameters.mjs';
import { LEGACY_CONTROL_SCHEMA, LEGACY_CONTROL_SCHEMA_HASH, initialControlValues, validateSavedControls, sha256 } from './controls/control-state.ts';
import type { SavedControlSnapshot, RuntimeControlState } from './controls/control-state.ts';
import { validateSource, snapshotRecord } from '../../build-worker/src/source-policy.mjs';
import { verifyLinked } from '../../build-worker/src/artifact-identity.mjs';
import { PerformanceReceiver } from './performance/performance-state.ts';
import { collectionMode } from '../../../packages/performance/collection-mode.mjs';
import type { CollectionMode } from '../../../packages/performance/collection-mode.mjs';
import { compositionControlSchema,createCompositionControlState, prepareCompositionControlState,resolveCompositionControlTarget } from '../../../packages/runtime/src/components/composition-controls.ts';
import type { SavedNodeControlSnapshot } from '../../../packages/core/src/scene-document.ts';
import {validateControlAnimationBindings} from '../../../packages/runtime-contracts/src/control-animation.mjs';
import type {ControlAnimationBinding,ControlAnimationIssue} from '../../../packages/runtime-contracts/src/control-animation.mjs';
import {normalizeAudioBandSnapshot} from '../../../packages/runtime-contracts/src/audio-input.mjs';
import type {AudioBandSnapshot} from '../../../packages/runtime-contracts/src/audio-input.mjs';
import type {StudioAudioProvider} from './audio/studio-audio-provider.mjs';
import {normalizeTempoSettings} from '../../../packages/runtime-contracts/src/tempo.mjs';
import type {SceneTempoSettings} from '../../../packages/runtime-contracts/src/tempo.mjs';
import {canonicalSceneStoryJson,normalizeSceneStory,normalizeStoryCapability,validateStoryAgainstCapability} from '../../../packages/runtime-contracts/src/story.mjs';
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
function parseTriggerReceipt(value:any):TriggerReceipt{
  if(!value||value.result!=='applied'||typeof value.commandId!=='string'||value.commandId.length<1||value.commandId.length>100||typeof value.controlId!=='string'||value.controlId.length<1||value.controlId.length>64||!Array.isArray(value.nodePath)||value.nodePath.some((id:unknown)=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))||!Number.isSafeInteger(value.sequence)||value.sequence<1||typeof value.frameId!=='string'||!/^\d{1,20}$/.test(value.frameId)||!Number.isFinite(value.timeSeconds))throw Error('Invalid trigger receipt');
  return Object.freeze({result:'applied',commandId:value.commandId,controlId:value.controlId,nodePath:Object.freeze([...value.nodePath]),sequence:value.sequence,frameId:value.frameId,timeSeconds:value.timeSeconds});
}
const triggerTargetKey=(nodePath:readonly string[],controlId:string)=>`${JSON.stringify(nodePath)}:${controlId}`;
const sameTriggerReceipt=(left:TriggerReceipt|undefined,right:TriggerReceipt)=>!!left&&left.commandId===right.commandId&&left.controlId===right.controlId&&triggerTargetKey(left.nodePath,left.controlId)===triggerTargetKey(right.nodePath,right.controlId)&&left.sequence===right.sequence&&left.frameId===right.frameId&&left.timeSeconds===right.timeSeconds;
function parseStoryFrame(value:any){
  if(!value||!Number.isSafeInteger(value.storyEpoch)||value.storyEpoch<0)throw Error('Invalid Story frame');
  if(value.state==='normal'){if(Object.keys(value).length!==2)throw Error('Invalid Normal Story frame');return Object.freeze({state:'normal' as const,storyEpoch:value.storyEpoch});}
  if(value.state!=='active'||typeof value.beatId!=='string'||!Number.isSafeInteger(value.activationId)||value.activationId<1||(value.occurrenceId!==null&&typeof value.occurrenceId!=='string')||!Number.isFinite(value.elapsedSeconds)||value.elapsedSeconds<0||(value.localTimeSeconds!==null&&(!Number.isFinite(value.localTimeSeconds)||value.localTimeSeconds<0))||(value.progress!==null&&(!Number.isFinite(value.progress)||value.progress<0||value.progress>1)))throw Error('Invalid Story frame');
  if(Object.keys(value).length!==8)throw Error('Invalid active Story frame');
  return Object.freeze({state:'active' as const,storyEpoch:value.storyEpoch,beatId:value.beatId,activationId:value.activationId,occurrenceId:value.occurrenceId,elapsedSeconds:value.elapsedSeconds,localTimeSeconds:value.localTimeSeconds,progress:value.progress});
}
function validateStoryFrameDefinition(frame:ReturnType<typeof parseStoryFrame>,definition:SceneStoryV1){
  if(frame.state==='normal')return;
  const beat=definition.beats.find(row=>row.id===frame.beatId);if(!beat)throw Error('Story frame beat is unavailable');
  if(frame.occurrenceId!==null){const occurrence=definition.sequence.find(row=>row.id===frame.occurrenceId);if(!occurrence||occurrence.beatId!==beat.id)throw Error('Story frame occurrence does not match its beat');}
  if(beat.timing.kind==='sustained'){if(frame.localTimeSeconds!==null||frame.progress!==null)throw Error('Sustained Story frames have no local timeline');}
  else if(frame.localTimeSeconds===null||frame.progress===null||frame.localTimeSeconds>beat.timing.durationSeconds||frame.progress!==frame.localTimeSeconds/beat.timing.durationSeconds)throw Error('Timed Story frame progress is invalid');
}
function parseStoryStatus(value:any,definition:SceneStoryV1,capability:StoryCapabilityV1,storyHash:string):StoryRuntimeStatus{
  if(!value||value.storyHash!==storyHash||!Number.isSafeInteger(value.storyRevision)||value.storyRevision<0||!['running','paused'].includes(value.phase)||typeof value.autoAdvance!=='boolean'||typeof value.loop!=='boolean'||typeof value.effectiveAdvancing!=='boolean')throw Error('Invalid Story status');
  if(JSON.stringify(normalizeSceneStory(value.definition))!==JSON.stringify(definition)||JSON.stringify(normalizeStoryCapability(value.capability))!==JSON.stringify(capability))throw Error('Story status identity changed');
  const sequence=value.sequence;if(!sequence||!['detached','attached','ended'].includes(sequence.state)||(sequence.occurrenceId!==null&&typeof sequence.occurrenceId!=='string')||(sequence.index!==null&&(!Number.isSafeInteger(sequence.index)||sequence.index<0))||(sequence.nextOccurrenceId!==null&&typeof sequence.nextOccurrenceId!=='string')||!Number.isFinite(sequence.dwellElapsedSeconds)||sequence.dwellElapsedSeconds<0||(sequence.dwellRemainingSeconds!==null&&(!Number.isFinite(sequence.dwellRemainingSeconds)||sequence.dwellRemainingSeconds<0))||typeof sequence.awaitingCue!=='boolean'||!Array.isArray(value.resumeCandidates)||value.resumeCandidates.some((id:unknown)=>typeof id!=='string')||!value.disabledReasons||typeof value.disabledReasons!=='object')throw Error('Invalid Story sequence status');
  const frame=parseStoryFrame(value.frame);validateStoryFrameDefinition(frame,definition);
  return Object.freeze({...value,definition,capability,frame,sequence:Object.freeze({...sequence}),resumeCandidates:Object.freeze([...value.resumeCandidates]),disabledReasons:Object.freeze({...value.disabledReasons})}) as StoryRuntimeStatus;
}
function parseStoryReceipt(value:any):StoryTransportReceipt{
  if(!value||value.result!=='applied'||typeof value.commandId!=='string'||value.commandId.length<1||value.commandId.length>100||typeof value.action!=='string'||!Number.isSafeInteger(value.storyRevision)||value.storyRevision<1||typeof value.frameId!=='string'||!/^\d{1,20}$/.test(value.frameId)||!Number.isFinite(value.timeSeconds))throw Error('Invalid Story receipt');
  return Object.freeze({result:'applied',commandId:value.commandId,action:value.action,storyRevision:value.storyRevision,frameId:value.frameId,timeSeconds:value.timeSeconds,story:parseStoryFrame(value.story)}) as StoryTransportReceipt;
}
const sameStoryReceipt=(left:StoryTransportReceipt|undefined,right:StoryTransportReceipt)=>!!left&&JSON.stringify(left)===JSON.stringify(right);
function storyCommandKey(input:any){return JSON.stringify({expectedRevisionId:input.expectedRevisionId,expectedStoryHash:input.expectedStoryHash,expectedStoryRevision:input.expectedStoryRevision,action:input.action,
  ...(['launch','replay','loop'].includes(input.action)?{beatId:input.beatId}:{}),...(['start','resume'].includes(input.action)&&input.occurrenceId!==undefined?{occurrenceId:input.occurrenceId}:{}),
  ...(input.action==='set-auto-advance'?{enabled:input.enabled}:{}),...(input.action==='seek'?{localTimeSeconds:input.localTimeSeconds}:{})});}
export function validateStoryReceiptTarget(receipt:StoryTransportReceipt,target:StoryCommandTarget,definition:SceneStoryV1){
  validateStoryFrameDefinition(receipt.story,definition);const frame=receipt.story,action=target.action,active=frame.state==='active'?frame:null,occurrence=(id:string|null|undefined)=>definition.sequence.find(row=>row.id===id);
  const before=target.before.frame,beforeActive=before.state==='active'?before:null;
  const requireNewActivation=()=>{if(beforeActive&&active!.activationId!==beforeActive.activationId+1)throw Error('Story receipt did not create the next activation');if(active!.storyEpoch!==before.storyEpoch+1||active!.elapsedSeconds!==0)throw Error('Story receipt did not begin a fresh epoch');const beat=definition.beats.find(row=>row.id===active!.beatId)!;if(beat.timing.kind==='timed'&&active!.localTimeSeconds!==0)throw Error('New timed Story activation did not start at local zero');};
  if(action.action==='return-normal'){if(frame.state!=='normal'||frame.storyEpoch!==before.storyEpoch+1)throw Error('Story receipt did not return to Normal');return;}
  if(!active)throw Error('Story receipt is missing its active beat');
  if(action.action==='launch'||action.action==='replay'||action.action==='loop'){
    if(active.beatId!==action.beatId||active.occurrenceId!==null)throw Error('Story receipt identifies the wrong detached beat');
    if(action.action==='launch'&&beforeActive?.beatId===action.beatId){if(active.activationId!==beforeActive.activationId||active.storyEpoch!==before.storyEpoch+(target.before.sequence.state==='detached'?0:1))throw Error('Same-beat launch replaced its activation');}else requireNewActivation();return;
  }
  if(action.action==='start'||action.action==='resume'){
    const occurrenceId=action.action==='start'?(action.occurrenceId??definition.sequence[0]?.id):action.occurrenceId,row=occurrence(occurrenceId);
    if(!row||active.occurrenceId!==row.id||active.beatId!==row.beatId)throw Error('Story receipt identifies the wrong occurrence');
    if(action.action==='resume'&&beforeActive?.beatId===row.beatId){if(active.activationId!==beforeActive.activationId||active.storyEpoch!==before.storyEpoch+1)throw Error('Same-beat resume replaced its activation');}else requireNewActivation();return;
  }
  if(action.action==='advance'){
    const row=occurrence(target.before.sequence.nextOccurrenceId);
    if(!row||active.occurrenceId!==row.id||active.beatId!==row.beatId)throw Error('Story receipt identifies the wrong advanced occurrence');requireNewActivation();return;
  }
  if(action.action==='seek'){
    if(!beforeActive||active.beatId!==beforeActive.beatId||active.activationId!==beforeActive.activationId||active.occurrenceId!==beforeActive.occurrenceId||active.localTimeSeconds!==action.localTimeSeconds||active.storyEpoch!==before.storyEpoch+1)throw Error('Story receipt identifies the wrong seek target');return;
  }
  if(!beforeActive||active.beatId!==beforeActive.beatId||active.activationId!==beforeActive.activationId||active.occurrenceId!==beforeActive.occurrenceId||active.storyEpoch!==before.storyEpoch)throw Error('Story receipt changed the active Story identity');
}
export function validateFreshStoryIntent(status:StoryRuntimeStatus,target:StoryCommandTarget){
  const action=target.action,before=target.before,frame=status.frame,beforeFrame=before.frame,definition=status.definition;
  const active=()=>{if(frame.state!=='active')throw Error('Story completion is not active');return frame;};
  const detached=()=>{if(status.sequence.state!=='detached'||status.sequence.occurrenceId!==null||status.sequence.index!==null||status.sequence.nextOccurrenceId!==null||status.sequence.dwellElapsedSeconds!==0||status.sequence.dwellRemainingSeconds!==null||status.sequence.awaitingCue)throw Error('Story completion is not detached');};
  const attached=(occurrenceId:string)=>{const index=definition.sequence.findIndex(row=>row.id===occurrenceId),row=definition.sequence[index];if(!row||status.sequence.state!=='attached'||status.sequence.occurrenceId!==occurrenceId||status.sequence.index!==index||status.sequence.nextOccurrenceId!==(definition.sequence[index+1]?.id??null)||status.sequence.dwellElapsedSeconds!==0||status.sequence.dwellRemainingSeconds!==(row.follow.kind==='after'?row.follow.seconds:null)||status.sequence.awaitingCue!==(row.follow.kind==='manual'))throw Error('Story completion has the wrong attached occurrence');};
  const sequenceIdentity=()=>{for(const key of ['state','occurrenceId','index','nextOccurrenceId'] as const)if(status.sequence[key]!==before.sequence[key])throw Error('Story completion changed sequence identity');};
  const newActivation=()=>{const current=active();if(beforeFrame.state==='active'&&current.activationId!==beforeFrame.activationId+1)throw Error('Story completion did not create the next activation');if(current.storyEpoch!==beforeFrame.storyEpoch+1||current.elapsedSeconds!==0)throw Error('Story completion did not begin a fresh epoch');};
  if(action.action==='launch'){
    const current=active();detached();if(status.autoAdvance||status.loop)throw Error('Launch retained sequence intent');
    if(beforeFrame.state==='active'&&beforeFrame.beatId===action.beatId){if(current.activationId!==beforeFrame.activationId||current.storyEpoch!==beforeFrame.storyEpoch+(before.sequence.state==='detached'?0:1))throw Error('Same-beat launch changed activation identity');const beat=definition.beats.find(row=>row.id===action.beatId)!;const canRun=beat.timing.kind==='sustained'||beforeFrame.localTimeSeconds!<beat.timing.durationSeconds;if(status.phase!==(canRun?'running':before.phase))throw Error('Same-beat launch has the wrong phase');}
    else{newActivation();if(status.phase!=='running')throw Error('Launch did not run its new activation');}return;
  }
  if(action.action==='start'||action.action==='resume'){
    const occurrenceId=action.action==='start'?(action.occurrenceId??definition.sequence[0]?.id):action.occurrenceId;attached(occurrenceId!);if(!status.autoAdvance||status.loop||status.phase!=='running')throw Error('Story occurrence did not start with sequence intent');
    const row=definition.sequence.find(item=>item.id===occurrenceId)!;
    if(action.action==='resume'&&beforeFrame.state==='active'&&beforeFrame.beatId===row.beatId){const current=active();if(current.activationId!==beforeFrame.activationId||current.storyEpoch!==beforeFrame.storyEpoch+1)throw Error('Same-beat resume changed activation identity');}else newActivation();return;
  }
  if(action.action==='advance'){attached(before.sequence.nextOccurrenceId!);newActivation();if(status.phase!=='running'||status.autoAdvance!==before.autoAdvance||status.loop)throw Error('Advance has the wrong transport intent');return;}
  if(action.action==='replay'||action.action==='loop'){detached();newActivation();if(status.phase!=='running'||status.autoAdvance||status.loop!==(action.action==='loop'))throw Error('Replay or loop has the wrong transport intent');return;}
  if(action.action==='seek'){sequenceIdentity();if(status.phase!=='paused'||status.loop||status.autoAdvance!==before.autoAdvance||active().storyEpoch!==beforeFrame.storyEpoch+1)throw Error('Seek has the wrong transport intent');return;}
  if(action.action==='pause'||action.action==='play'){sequenceIdentity();if(status.phase!==(action.action==='pause'?'paused':'running')||status.autoAdvance!==before.autoAdvance||status.loop!==before.loop||active().storyEpoch!==beforeFrame.storyEpoch)throw Error('Play or pause has the wrong transport intent');return;}
  if(action.action==='set-auto-advance'){sequenceIdentity();if(status.autoAdvance!==action.enabled||status.phase!==before.phase||status.loop!==before.loop||active().storyEpoch!==beforeFrame.storyEpoch)throw Error('Story auto-advance receipt has the wrong intent');return;}
  if(frame.state!=='normal'||frame.storyEpoch!==beforeFrame.storyEpoch+1||status.phase!=='paused'||status.autoAdvance||status.loop||status.sequence.state!=='detached'||status.sequence.occurrenceId!==null||status.sequence.index!==null||status.sequence.nextOccurrenceId!==null||status.sequence.dwellElapsedSeconds!==0||status.sequence.dwellRemainingSeconds!==null||status.sequence.awaitingCue||status.resumeCandidates.length)throw Error('Return Normal receipt has the wrong state');
}
declare global { interface Window { luxAuthoring: AuthoringApi } }
type RetryPolicy={lastFaultAt:number|null};
type ReplacementPlaybackIntent={playing:boolean;settling:number;pending:Set<string>;synchronize?:()=>void};
type TriggerTarget=Readonly<{nodePath:readonly string[];controlId:string;key:string;sequence:number}>;
export type StoryCommandTarget=Readonly<{payloadKey:string;action:StoryTransportAction;expectedRevision:number;before:StoryRuntimeStatus}>;
type Running = { worker: Worker; canvas: HTMLCanvasElement; instanceId: string; generation: number; revisionId: string; performance:PerformanceReceiver;retryPolicy:RetryPolicy;autoRetry:boolean;playback:'playing'|'paused';
  lastHeartbeat: number; lastFrame: number; frameId: string; terminal: boolean; watchdog: ReturnType<typeof setInterval>; activationTimer?: ReturnType<typeof setTimeout>; controls: number; animations:number; tempoCommands:number;tempoSequence:number;tempo:SceneTempoSettings;triggerSequence:number;latestTriggerReceipt?:TriggerReceipt;triggerCommands:Map<string,TriggerTarget>;triggerReceipts:Map<string,TriggerReceipt>;triggerSequences:Map<number,string>;storyDefinition?:SceneStoryV1;storyCapability?:StoryCapabilityV1;storyHash?:string;storyStatus?:StoryRuntimeStatus;storyCommands:Map<string,StoryCommandTarget>;storyReceipts:Map<string,StoryTransportReceipt>; state:RuntimeControlState; output:Readonly<Pick<OutputSettings,'width'|'height'>>; desiredControls?:ControlValues; desiredNodeControls?:SavedNodeControlSnapshot;desiredControlAnimations?:readonly ControlAnimationBinding[];audioInFlight?:AudioBandSnapshot;audioLatest?:AudioBandSnapshot; };
export class StandaloneClient implements StudioClient, PresentationPort {
  private snapshot: StudioSnapshot = { connection: 'connected', message: 'Open an example or write a visual, then Build & preview.', receivedAtMs: Date.now(), authoring: null, host: null, jobs: [], visualFps: null, uiFps: null };
  private listeners = new Set<() => void>();
  private running: Running | null = null;
  private target: HTMLElement | null = null;
  private generation = 0;
  private source: SourceBundle | null = null;
  private accepted: { linked: LinkedEnvelope; revisionId: string; state:RuntimeControlState; output:Readonly<Pick<OutputSettings,'width'|'height'>>;story:SceneStoryV1|null;storyHash:string|null;retainStoryVersion:boolean } | null = null;
  private previewOutput: Readonly<Pick<OutputSettings,'width'|'height'>> = DEFAULT_OUTPUT;
  private busy = false;
  private replacementPlayback:ReplacementPlaybackIntent|null=null;
  private automaticRetry:ReturnType<typeof setTimeout>|undefined;
  private pending = new Map<string, { runtime: Running; kind: 'command' | 'capture'; playback?:boolean; expectedControlSequence?:number; expectedControls?:ControlValues; expectedNodeControls?:SavedNodeControlSnapshot;expectedAnimationSequence?:number;expectedControlAnimations?:readonly ControlAnimationBinding[];expectedTempoSequence?:number;expectedTriggerCommandId?:string;expectedTriggerTarget?:TriggerTarget;expectedStoryCommandId?:string;expectedStoryTarget?:StoryCommandTarget;expectedStoryRetry?:boolean; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private api: AuthoringApi;
  private codeDeclaredParameters:boolean;
  private readonly performanceMode:CollectionMode;
  private readonly audioRuntimes=new Set<Running>();
  private audioSnapshot:AudioBandSnapshot;
  constructor(api: AuthoringApi, options:{codeDeclaredParameters?:boolean;performanceMode?:CollectionMode;audioProvider?:Pick<StudioAudioProvider,'getSnapshot'|'subscribe'>}={}) {
    this.api = api; this.codeDeclaredParameters=options.codeDeclaredParameters===true; this.performanceMode=collectionMode(options.performanceMode);
    this.audioSnapshot=normalizeAudioBandSnapshot(options.audioProvider?.getSnapshot()??{generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0});
    options.audioProvider?.subscribe(()=>{
      this.audioSnapshot=normalizeAudioBandSnapshot(options.audioProvider!.getSnapshot());
      for(const runtime of this.audioRuntimes)this.queueAudio(runtime,this.audioSnapshot);
    });
  }
  getSnapshot = () => this.snapshot;
  readStory(view:'status'|'definition'|'capabilities'){
    const runtime=this.running,accepted=this.accepted;
    if(!runtime||runtime.terminal||!accepted||runtime!==this.running)throw Error('No working Story runtime');
    const capability=runtime.storyCapability;
    if(!capability)throw Error('The accepted visual does not declare Story capabilities');
    const guards={instanceId:runtime.instanceId,generation:runtime.generation,revisionId:runtime.revisionId,storyHash:runtime.storyHash??null,storyRevision:runtime.storyStatus?.storyRevision??null};
    if(view==='capabilities')return Object.freeze({...guards,capabilities:capability});
    if(!runtime.storyDefinition||!runtime.storyStatus||!runtime.storyHash)throw Error('The accepted visual has no Story definition');
    if(view==='definition')return Object.freeze({...guards,definition:runtime.storyDefinition});
    return Object.freeze({...guards,status:runtime.storyStatus});
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<StudioSnapshot>) { this.snapshot = { ...this.snapshot, ...patch, receivedAtMs: Date.now() }; for (const listener of this.listeners) listener(); }
  private queueAudio(runtime:Running,snapshot:AudioBandSnapshot){
    if(runtime.terminal)return;
    if(runtime.audioInFlight){runtime.audioLatest=snapshot;return;}
    runtime.audioInFlight=snapshot;
    try{runtime.worker.postMessage({type:'audio',instanceId:runtime.instanceId,generation:runtime.generation,audioSnapshot:snapshot});}
    catch(error){runtime.audioInFlight=undefined;runtime.audioLatest=undefined;if(runtime===this.running)this.fault(runtime,String(error));else this.stop(runtime,String(error));}
  }
  private settleReplacementCommand(requestId:string) {
    const replacement=this.replacementPlayback;
    if(!replacement?.pending.delete(requestId))return;
    replacement.settling--;replacement.synchronize?.();
  }
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
    return createSceneDocument(structuredClone(this.source), {...DEFAULT_OUTPUT, ...runtime.output}, controls, [], state.controlAnimations ?? [],normalizeTempoSettings({bpm:runtime.tempo?.bpm??120}),this.accepted?.story??null,this.accepted?.retainStoryVersion??false);
  }
  async submit(source: SourceBundle, options:{savedControls?:SavedControlSnapshot;savedControlAnimations?:readonly ControlAnimationBinding[];savedTempo?:SceneTempoSettings;output?:OutputSettings;story?:SceneStoryV1|null}={}): Promise<void> {
    if(source.sdkVersion!=='0.1.0'&&source.sdkVersion!=='0.2.0'&&source.sdkVersion!=='0.4.0')throw Error('Unsupported Studio SDK');
    const supportedSdkVersion=source.sdkVersion;
    if(source.sdkVersion==='0.2.0'&&!this.codeDeclaredParameters)throw Error('Code-declared parameters are not enabled in this Studio UI yet');
    if (this.busy) throw Error('A visual build is already running');
    const requestedOutput = options.output ? outputSettingsSchema.parse(options.output) : this.previewOutput;
    if (options.output && (options.output.fps !== 60 || options.output.seed !== 0)) throw Error('Looks currently support 60 fps and seed 0.');
    // A replacement must not snapshot playback before an admitted command settles.
    const currentPending=[...this.pending].filter(([,wait])=>wait.runtime===this.running&&wait.kind==='command');
    if (currentPending.some(([,wait])=>wait.playback)) {
      throw Error('Wait for the playback command to complete, then build again.');
    }
    this.cancelAutomaticRetry();
    this.busy = true;
    const pending=new Set(currentPending.map(([requestId])=>requestId));
    const playbackIntent:ReplacementPlaybackIntent={playing:true,settling:pending.size,pending};
    this.replacementPlayback=playbackIntent;
    const jobId = crypto.randomUUID();
    this.publish({ jobs: [{ jobId, state: 'compiling', summary: 'Compiling visual…' }] });
    try {
      const submittedSource = structuredClone(source);
      const result = await this.api.compile(submittedSource);
      if (!result.ok) throw new SourceCompileError(result.diagnostics ?? []);
      let linked = structuredClone(result.linked) as LinkedEnvelope;
      const actualLinkedVersion='linkedVersion' in linked?linked.linkedVersion:1;
      const expectedLinkedVersion = submittedSource.sdkVersion === '0.4.0' ? 5 : submittedSource.sdkVersion === '0.2.0' ? actualLinkedVersion : ('sourceVersion' in submittedSource ? 2 : 1);
      if ((submittedSource.sdkVersion==='0.2.0'?![3,6].includes(actualLinkedVersion):actualLinkedVersion!==expectedLinkedVersion)) throw Error('Compiled source and linked payload versions do not match');
      let schema=LEGACY_CONTROL_SCHEMA, schemaHash=LEGACY_CONTROL_SCHEMA_HASH;
      if(submittedSource.sdkVersion==='0.2.0'||submittedSource.sdkVersion==='0.4.0') {
        linked=await verifyLinked(linked,sha256);
        if(!('linkedVersion' in linked)||linked.linkedVersion!==expectedLinkedVersion)throw Error('Code-declared parameters require the matching sealed linked version');
        const sourceHash=await sha256(new TextEncoder().encode(JSON.stringify(validateSource(submittedSource))));
        if(result.sourceHash!==sourceHash)throw Error('Compiled source identity mismatch');
        if(linked.linkedVersion!==3&&linked.linkedVersion!==5&&linked.linkedVersion!==6)throw Error('Missing parameter schema in linked payload');
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
      const tempo=normalizeTempoSettings(options.savedTempo??{bpm:this.snapshot.authoring?.tempo?.bpm??120});
      const tempoSequence=options.savedTempo?0:this.snapshot.authoring?.tempoSequence??0;
      const requestedStory=options.story===undefined?(this.accepted?.story??null):options.story;
      const retainStoryVersion=options.story===undefined?(this.accepted?.retainStoryVersion??false):options.story!==null||(this.accepted?.retainStoryVersion??false);
      let story:SceneStoryV1|null=null,storyHash:string|null=null;
      if(requestedStory!==null){
        if(!('linkedVersion' in linked)||linked.linkedVersion!==6)throw Error('The compiled visual does not declare a matching Story capability');
        story=validateStoryAgainstCapability(requestedStory,linked.storyCapability);storyHash=await sha256(new TextEncoder().encode(canonicalSceneStoryJson(story)));
      }
      await this.start(linked, result.sourceHash,state,migration, {lastFaultAt:null}, playbackIntent.playing, requestedOutput,playbackIntent,
        options.savedControls===undefined&&options.savedControlAnimations===undefined,tempo,tempoSequence,story,storyHash);
      this.previewOutput = requestedOutput;
      this.source = submittedSource;
      let acceptedState=state;const running=this.running;
      if(running&&running.revisionId===result.sourceHash)acceptedState=running.state;
      this.accepted = { linked, revisionId: result.sourceHash,state:acceptedState,output:this.previewOutput,story,storyHash,retainStoryVersion };
      this.publish({ message:null,jobs: [{ jobId, state: 'succeeded', summary: 'Visual is ready in Lux.' }] });
    } catch (error) { this.publish({ jobs: [{ jobId, state: 'failed', summary: 'Build failed; previous preview retained.', fault: String(error) }] }); throw error; }
    finally { if(this.replacementPlayback===playbackIntent)this.replacementPlayback=null;this.busy = false; this.scheduleAutomaticRetry(); }
  }
  private async start(linked: LinkedEnvelope, revisionId: string, state:RuntimeControlState, migration:readonly ControlMigration[]=[],retryPolicy:RetryPolicy={lastFaultAt:null},playingOverride?:boolean, output:Readonly<Pick<OutputSettings,'width'|'height'>>=this.previewOutput,playbackIntent?:ReplacementPlaybackIntent,reconcileRuntime=false,tempo:SceneTempoSettings=normalizeTempoSettings({bpm:this.snapshot.authoring?.tempo?.bpm??120}),tempoSequence=this.snapshot.authoring?.tempoSequence??0,story:SceneStoryV1|null=this.accepted?.story??null,storyHash:string|null=this.accepted?.storyHash??null): Promise<void> {
    const compositionState='linkedVersion' in linked&&linked.linkedVersion===5?prepareCompositionControlState(linked.composition):undefined;
    const playing = playingOverride ?? this.snapshot.authoring?.playback === 'playing';
    const canvas = document.createElement('canvas'); canvas.width = output.width; canvas.height = output.height;
    canvas.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;object-fit:contain';
    const worker = new Worker(new URL('./visual-worker.js', import.meta.url), { type: 'module' });
    const storyCapability='linkedVersion' in linked&&linked.linkedVersion===6?normalizeStoryCapability(linked.storyCapability):undefined;
    if(story&&!storyCapability)throw Error('Story definition requires a compiled Story capability');
    const candidate: Running = { worker, canvas, instanceId: this.running?.instanceId ?? crypto.randomUUID(), generation: ++this.generation,
      revisionId, lastHeartbeat: performance.now(), lastFrame: performance.now(), frameId: '0', terminal: false, watchdog: undefined as any, controls: 0,animations:0,tempoCommands:tempoSequence,tempoSequence,tempo,triggerSequence:0,triggerCommands:new Map(),triggerReceipts:new Map(),triggerSequences:new Map(),storyCommands:new Map(),storyReceipts:new Map(),...(story&&storyCapability&&storyHash?{storyDefinition:story,storyCapability,storyHash}:{}),state,output,performance:undefined as any,retryPolicy,autoRetry:false,playback:playing?'playing':'paused' };
    candidate.performance=new PerformanceReceiver({instanceId:candidate.instanceId,generation:candidate.generation,revisionId},performance.now());
    this.audioRuntimes.add(candidate);
    const previous = this.running;
    let ready = false,initialized=false,latestStatus:any;
    let synchronization:Readonly<{requestId:string;kind:'controls'|'animations'|'playback'|'tempo';animationSourceSequence?:number;animationSequence?:number;expectedControlAnimations?:readonly ControlAnimationBinding[];tempoSequence?:number}>|undefined;
    let reconciledAnimationSequence=previous?.state.animationSequence??0;
    let reconciledTempoSequence=tempoSequence;
    let synchronizeCandidate:()=>void=()=>{};
    try {
      await new Promise<void>((resolve, reject) => {
        const abort = (error: Error) => { clearTimeout(timer); this.stop(candidate, error.message); reject(error); };
        const timer = setTimeout(() => abort(Error('Visual initialization exceeded five seconds')), 5000);
        candidate.activationTimer = timer;
        const fail = (message: string) => { if (!ready) abort(Error(message)); else this.fault(candidate, message); };
        const publishRuntime=(message:any)=>this.publish({ authoring: { instanceId: candidate.instanceId, generation: candidate.generation, revisionId,
          ...('linkedVersion' in linked&&linked.linkedVersion===5?{composition:linked.composition}:{}),
          sceneName: 'Untitled visual', authority: 'studio', playback: message.playback,
          ...candidate.state,controlMigration:migration,clockEpoch: message.clockEpoch,timeSeconds:message.timeSeconds,tempo:message.tempo,tempoSequence:message.tempoSequence, frameId: message.frameId,
          triggerSequence:candidate.triggerSequence,...(candidate.latestTriggerReceipt?{latestTriggerReceipt:candidate.latestTriggerReceipt}:{}),
          ...(candidate.storyStatus?{story:candidate.storyStatus}:{}),...(state.sdkVersion==='0.1.0'?{intensity:candidate.state.controls.intensity}:{}),
          output: candidate.output, fault: null } as RuntimeView });
        const promote=()=>{
          if(ready||!initialized||!latestStatus)return;
          if(playbackIntent?.settling||synchronization)return;
          if(playbackIntent&&candidate.playback!==(playbackIntent.playing?'playing':'paused'))return;
          ready=true;clearTimeout(timer);this.running=candidate;
          if(previous){this.stop(previous,'Runtime changed before command completed');previous.canvas.remove();}
          this.target?.appendChild(canvas);this.publish({performance:candidate.performance.snapshot});publishRuntime(latestStatus);resolve();
        };
        const postSynchronization=(kind:'controls'|'animations'|'playback'|'tempo',message:Record<string,unknown>,animationSourceSequence?:number)=>{
          const requestId=crypto.randomUUID();synchronization={requestId,kind,...(animationSourceSequence===undefined?{}:{animationSourceSequence}),
            ...(kind==='animations'?{animationSequence:message.animationSequence as number,expectedControlAnimations:message.controlAnimations as readonly ControlAnimationBinding[]}:{}),
            ...(kind==='tempo'?{tempoSequence:message.tempoSequence as number}:{})};
          try{worker.postMessage({...message,requestId,instanceId:candidate.instanceId,generation:candidate.generation});}
          catch(error){fail(String(error));}
        };
        synchronizeCandidate=()=>{
          if(!initialized||ready||candidate.terminal||synchronization)return;
          if(reconcileRuntime&&previous){
            if(state.sdkVersion==='0.4.0'){
              if(!('linkedVersion' in linked)||linked.linkedVersion!==5)throw Error('Invalid composition linked payload');
              const desired=createCompositionControlState(linked.composition,previous.state.nodeControls);
              const desiredNodeControls=Object.freeze({sourceHash:revisionId,nodes:desired.snapshot().nodes});
              candidate.desiredControls=desired.values();candidate.desiredNodeControls=desiredNodeControls;
              for(const node of desiredNodeControls.nodes){
                const current=candidate.state.nodeControls?.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(node.nodePath));
                if(!current||JSON.stringify(current.values)!==JSON.stringify(node.values)){
                  postSynchronization('controls',{type:'node-controls',nodePath:node.nodePath,values:node.values,controlSchemaHash:node.schemaHash,controlSequence:++candidate.controls});return;
                }
              }
            }else{
              const desired=initialControlValues(state.controlSchema,{schema:previous.state.controlSchema,values:previous.state.controls}).values;
              candidate.desiredControls=desired;
              if(JSON.stringify(candidate.state.controls)!==JSON.stringify(desired)){
                postSynchronization('controls',{type:'controls',values:desired,controlSchemaHash:state.controlSchemaHash,controlSequence:++candidate.controls});return;
              }
            }
            const sourceAnimationSequence=previous.state.animationSequence??0;
            if(sourceAnimationSequence!==reconciledAnimationSequence){
              candidate.desiredControlAnimations=validateControlAnimationBindings(previous.state.controlAnimations??[]);
              postSynchronization('animations',{type:'animations',animationSequence:++candidate.animations,controlAnimations:candidate.desiredControlAnimations},sourceAnimationSequence);return;
            }
            const sourceTempoSequence=previous.tempoSequence;
            if(sourceTempoSequence!==reconciledTempoSequence){
              candidate.tempo=previous.tempo;candidate.tempoCommands=sourceTempoSequence;
              postSynchronization('tempo',{type:'tempo',action:'synchronize',bpm:previous.tempo.bpm,tempoSequence:sourceTempoSequence});return;
            }
          }
          if(!playbackIntent){promote();return;}
          const desired=playbackIntent.playing?'playing':'paused';
          if(candidate.playback===desired){promote();return;}
          postSynchronization('playback',{type:'playback',action:playbackIntent.playing?'play':'pause'});
        };
        if(playbackIntent)playbackIntent.synchronize=synchronizeCandidate;
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
          if(message.type==='audio-ack'){
            const current=candidate.audioInFlight;
            if(!current||message.providerGeneration!==current.generation||message.sampleSequence!==current.sequence)return;
            candidate.audioInFlight=undefined;
            const latest=candidate.audioLatest;candidate.audioLatest=undefined;
            if(latest)this.queueAudio(candidate,latest);
            return;
          }
          if (message.type === 'failure') {
            const wait=this.pending.get(message.requestId);
            if(wait?.runtime===candidate){clearTimeout(wait.timer);this.pending.delete(message.requestId);this.settleReplacementCommand(message.requestId);wait.reject(Object.assign(Error(String(message.message).slice(0,500)),{code:typeof message.code==='string'?message.code:'RUNTIME_FAILED'}));}
            fail(String(message.message)); return;
          }
          if (message.type === 'heartbeat') { if (/^\d{1,20}$/.test(message.frameId)) candidate.lastHeartbeat = performance.now(); return; }
          if (message.type === 'capture-error') {
            const wait = this.pending.get(message.requestId);
            if (wait?.runtime === candidate && wait.kind === 'capture') { candidate.lastHeartbeat = performance.now(); clearTimeout(wait.timer); this.pending.delete(message.requestId); wait.reject(Error(message.message)); }
            return;
          }
          if(message.type==='command-error'){
            const wait=this.pending.get(message.requestId);if(wait?.runtime===candidate&&wait.kind==='command'){candidate.lastHeartbeat=performance.now();clearTimeout(wait.timer);this.pending.delete(message.requestId);this.settleReplacementCommand(message.requestId);let candidates:readonly string[]|undefined;if(wait.expectedStoryCommandId!==undefined&&Array.isArray(message.candidates)&&message.candidates.length<=1024){const known=new Set(candidate.storyDefinition?.sequence.map(row=>row.id)??[]),seen=new Set<string>();if(message.candidates.every((id:unknown)=>typeof id==='string'&&known.has(id)&&!seen.has(id)&&!!seen.add(id)))candidates=Object.freeze([...message.candidates]);}const error=Object.assign(Error(String(message.message).slice(0,500)),{code:typeof message.code==='string'?message.code:'COMMAND_REJECTED',...(candidates?{candidates}:{})});wait.reject(error);if(wait.expectedTriggerCommandId!==undefined)this.fault(candidate,`Trigger command was rejected after host admission: ${error.message}`);}return;
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
          let receivedTempo:SceneTempoSettings;
          try{receivedTempo=normalizeTempoSettings({bpm:message.tempo?.bpm});if(!Number.isFinite(message.tempo?.beatPosition)||!Number.isFinite(message.tempo?.beatPhase)||message.tempo.beatPhase<0||message.tempo.beatPhase>=1||message.tempo.tempoSequence!==message.tempoSequence||!Number.isSafeInteger(message.tempoSequence)||message.tempoSequence<0||message.tempoSequence>candidate.tempoCommands)throw Error('Invalid tempo state');}
          catch(error){if(message.type==='ready')fail(String(error));return;}
          const animationSequence=message.animationSequence??0;
          if(!Number.isSafeInteger(animationSequence)||animationSequence<0||animationSequence>candidate.animations)return;
          const receivedTriggerSequence=message.triggerSequence??0;
          if(!Number.isSafeInteger(receivedTriggerSequence)||receivedTriggerSequence<0||receivedTriggerSequence<candidate.triggerSequence||receivedTriggerSequence>candidate.triggerSequence+1||receivedTriggerSequence>candidate.triggerCommands.size)return;
          let receivedLatestTriggerReceipt:TriggerReceipt|undefined,requestTriggerReceipt:TriggerReceipt|undefined;
          const triggerBindings:TriggerReceipt[]=[];
          try{
            const checkReceipt=(receipt:TriggerReceipt)=>{
              const target=candidate.triggerCommands.get(receipt.commandId);if(!target||target.key!==triggerTargetKey(receipt.nodePath,receipt.controlId)||receipt.sequence!==target.sequence)throw Error('Unexpected trigger receipt target or sequence');
              const previous=candidate.triggerReceipts.get(receipt.commandId);if(previous&&!sameTriggerReceipt(previous,receipt))throw Error('Trigger receipt identity changed');
              const owner=candidate.triggerSequences.get(receipt.sequence);if(owner&&owner!==receipt.commandId)throw Error('Trigger receipt sequence changed owner');
              const pendingBinding=triggerBindings.find(row=>row.sequence===receipt.sequence||row.commandId===receipt.commandId);if(pendingBinding&&!sameTriggerReceipt(pendingBinding,receipt))throw Error('Trigger receipt identity differs within one status');
              if(!pendingBinding)triggerBindings.push(receipt);
            };
            if(receivedTriggerSequence>0){receivedLatestTriggerReceipt=parseTriggerReceipt(message.latestTriggerReceipt);if(receivedLatestTriggerReceipt.sequence!==receivedTriggerSequence)throw Error('Invalid latest trigger receipt');if(receivedTriggerSequence===candidate.triggerSequence+1&&(receivedLatestTriggerReceipt.frameId!==message.frameId||receivedLatestTriggerReceipt.timeSeconds!==message.timeSeconds))throw Error('Trigger receipt does not identify the completed frame');checkReceipt(receivedLatestTriggerReceipt);}
            else if(message.latestTriggerReceipt)throw Error('Unexpected latest trigger receipt');
            if(message.triggerReceipt){requestTriggerReceipt=parseTriggerReceipt(message.triggerReceipt);if(requestTriggerReceipt.sequence>receivedTriggerSequence)throw Error('Trigger request receipt exceeds latest sequence');checkReceipt(requestTriggerReceipt);}
            if(receivedTriggerSequence===candidate.triggerSequence&&candidate.latestTriggerReceipt&&(!receivedLatestTriggerReceipt||!sameTriggerReceipt(candidate.latestTriggerReceipt,receivedLatestTriggerReceipt)))throw Error('Latest trigger receipt regressed');
          }
          catch{return;}
          let receivedStoryStatus:StoryRuntimeStatus|undefined,requestStoryReceipt:StoryTransportReceipt|undefined;
          try{
            if(candidate.storyDefinition&&candidate.storyCapability&&candidate.storyHash){
              receivedStoryStatus=parseStoryStatus(message.story,candidate.storyDefinition,candidate.storyCapability,candidate.storyHash);
              const previousRevision=candidate.storyStatus?.storyRevision??0;
              if(message.type==='ready'){
                if(receivedStoryStatus.storyRevision!==0||receivedStoryStatus.frame.state!=='normal')throw Error('Story runtime did not initialize in Normal');
              }else if(receivedStoryStatus.storyRevision<previousRevision||receivedStoryStatus.storyRevision>previousRevision+1)throw Error('Story revision changed unexpectedly');
              if(message.storyReceipt){
                requestStoryReceipt=parseStoryReceipt(message.storyReceipt);
                const target=candidate.storyCommands.get(requestStoryReceipt.commandId);
                if(!target||target.action.action!==requestStoryReceipt.action||message.storyCommandKey!==target.payloadKey)throw Error('Unexpected Story receipt');
                validateStoryReceiptTarget(requestStoryReceipt,target,candidate.storyDefinition);
                const prior=candidate.storyReceipts.get(requestStoryReceipt.commandId);if(prior&&!sameStoryReceipt(prior,requestStoryReceipt))throw Error('Story receipt identity changed');
                if(requestStoryReceipt.storyRevision>receivedStoryStatus.storyRevision)throw Error('Story receipt exceeds current revision');
                const requestWait=this.pending.get(message.requestId),duplicate=message.storyCommandDuplicate===true;
                if(duplicate&&requestWait?.expectedStoryRetry!==true)throw Error('Unexpected Story duplicate response');
                if(!prior&&!duplicate&&(requestStoryReceipt.storyRevision!==receivedStoryStatus.storyRevision||requestStoryReceipt.frameId!==message.frameId||requestStoryReceipt.timeSeconds!==message.timeSeconds||JSON.stringify(requestStoryReceipt.story)!==JSON.stringify(receivedStoryStatus.frame)))throw Error('Story receipt does not identify the completed frame');
                if(!duplicate)validateFreshStoryIntent(receivedStoryStatus,target);
              }
            }else if(message.story||message.storyReceipt)throw Error('Unexpected Story runtime state');
          }catch(error){if(message.type==='ready')fail(String(error));return;}
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
              const composition=compositionState!(nodeControls);
              if(JSON.stringify(composition.values())!==JSON.stringify(applied))throw Error('Composition public controls do not match canonical node values');
              compositionNodeControls=Object.freeze({sourceHash:revisionId,nodes:composition.snapshot().nodes});
              if(!message.effectiveNodeControls)throw Error('Missing effective animation values');
              const effective=compositionState!(message.effectiveNodeControls);
              effectiveNodeControls=Object.freeze({sourceHash:revisionId,nodes:effective.snapshot().nodes});
            }
            if(message.type==='ready'&&(message.controlSequence!==0||animationSequence!==0||receivedTriggerSequence!==0||JSON.stringify(applied)!==JSON.stringify(state.controls)||JSON.stringify(controlAnimations)!==JSON.stringify(state.controlAnimations??[])))throw Error('Initial control snapshot mismatch');
          } catch(error) {if(message.type==='ready')fail(String(error));return;}
          const currentAnimationSequence=candidate.state.animationSequence??0;
          if(animationSequence<currentAnimationSequence)return;
          const receivedAnimations=JSON.stringify(controlAnimations);
          if(animationSequence===currentAnimationSequence){
            if(receivedAnimations!==JSON.stringify(candidate.state.controlAnimations??[]))return;
          }else{
            const animationWait=this.pending.get(message.requestId);
            const replacementSynchronization=synchronization?.kind==='animations'&&synchronization.requestId===message.requestId&&
              animationSequence===synchronization.animationSequence&&receivedAnimations===JSON.stringify(synchronization.expectedControlAnimations);
            if(!replacementSynchronization&&(animationWait?.runtime!==candidate||animationWait.kind!=='command'||animationWait.expectedAnimationSequence!==animationSequence||receivedAnimations!==JSON.stringify(animationWait.expectedControlAnimations)))return;
          }
          if(ready&&message.controlSequence<candidate.state.controlSequence)return;
          candidate.state={...state,controls:applied,effectiveControls,controlSequence:message.controlSequence,controlAnimations,controlAnimationIssues,animationSequence,
            ...(compositionNodeControls?{nodeControls:compositionNodeControls,effectiveNodeControls}:{} )};
          candidate.playback=message.playback;
          for(const receipt of triggerBindings){candidate.triggerReceipts.set(receipt.commandId,receipt);candidate.triggerSequences.set(receipt.sequence,receipt.commandId);}
          candidate.triggerSequence=receivedTriggerSequence;candidate.latestTriggerReceipt=receivedLatestTriggerReceipt;
          if(requestStoryReceipt)candidate.storyReceipts.set(requestStoryReceipt.commandId,requestStoryReceipt);
          candidate.storyStatus=receivedStoryStatus;
          candidate.tempo=receivedTempo;candidate.tempoSequence=message.tempoSequence;
          candidate.lastHeartbeat = performance.now();
          if (BigInt(message.frameId) > BigInt(candidate.frameId)) { candidate.frameId = message.frameId; candidate.lastFrame = performance.now(); }
          latestStatus=message;
          if(message.type==='ready'&&!initialized)initialized=true;
          const acknowledgedSynchronization=synchronization;
          if(acknowledgedSynchronization&&message.requestId===acknowledgedSynchronization.requestId){
            if(acknowledgedSynchronization.kind==='animations')reconciledAnimationSequence=acknowledgedSynchronization.animationSourceSequence??reconciledAnimationSequence;
            if(acknowledgedSynchronization.kind==='tempo')reconciledTempoSequence=acknowledgedSynchronization.tempoSequence??reconciledTempoSequence;
            synchronization=undefined;
          }
          if(initialized&&!ready){synchronizeCandidate();if(!ready)return;}
          if (this.running !== candidate) return;
          publishRuntime(message);
          const wait = this.pending.get(message.requestId);
          if (wait?.runtime === candidate && wait.kind === 'command' &&
              (wait.expectedControlSequence === undefined ||
                (message.controlSequence === wait.expectedControlSequence && JSON.stringify(applied) === JSON.stringify(wait.expectedControls) && (!wait.expectedNodeControls || JSON.stringify(compositionNodeControls)===JSON.stringify(wait.expectedNodeControls)))) &&
              (wait.expectedAnimationSequence===undefined || (animationSequence===wait.expectedAnimationSequence&&JSON.stringify(controlAnimations)===JSON.stringify(wait.expectedControlAnimations)))) {
            if(wait.expectedTempoSequence!==undefined&&message.tempoSequence!==wait.expectedTempoSequence)return;
            if(wait.expectedTriggerCommandId!==undefined&&(!requestTriggerReceipt||requestTriggerReceipt.commandId!==wait.expectedTriggerCommandId||wait.expectedTriggerTarget?.key!==triggerTargetKey(requestTriggerReceipt.nodePath,requestTriggerReceipt.controlId)))return;
            if(wait.expectedStoryCommandId!==undefined&&(!requestStoryReceipt||requestStoryReceipt.commandId!==wait.expectedStoryCommandId||wait.expectedStoryTarget?.action.action!==requestStoryReceipt.action||message.storyCommandKey!==wait.expectedStoryTarget.payloadKey||!receivedStoryStatus))return;
            clearTimeout(wait.timer); this.pending.delete(message.requestId);this.settleReplacementCommand(message.requestId);wait.resolve(requestStoryReceipt&&receivedStoryStatus?Object.freeze({receipt:requestStoryReceipt,currentStatus:receivedStoryStatus}):requestTriggerReceipt??message);
          }
        };
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({ type: 'init', requestId: crypto.randomUUID(), instanceId: candidate.instanceId, generation: candidate.generation,
          revisionId, linked: structuredClone(linked),story,storyHash,canvas: offscreen,...state,tempo:{bpm:tempo.bpm,beatPosition:0,beatPhase:0,tempoSequence},tempoSequence,audioSnapshot:this.audioSnapshot,settings: {...DEFAULT_OUTPUT,...output}, playing, performanceMode:this.performanceMode }, [offscreen]);
      });
    } catch (error) { this.stop(candidate, String(error)); canvas.remove(); throw error; }
    finally{if(playbackIntent?.synchronize===synchronizeCandidate)playbackIntent.synchronize=undefined;}
  }
  private stop(runtime: Running, message: string) {
    if(runtime===this.running){this.cancelAutomaticRetry();runtime.autoRetry=false;}
    if (runtime.terminal) return;
    runtime.terminal = true;
    this.audioRuntimes.delete(runtime);runtime.audioInFlight=undefined;runtime.audioLatest=undefined;
    clearInterval(runtime.watchdog); clearTimeout(runtime.activationTimer); runtime.worker.onmessage = null; runtime.worker.onerror = null;
    runtime.worker.terminate(); // Requests browser termination; not native/GPU stop acknowledgement.
    for (const [id, wait] of this.pending) if (wait.runtime === runtime) { clearTimeout(wait.timer); this.pending.delete(id);this.settleReplacementCommand(id);wait.reject(Error(message)); }
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
    const replacementWrite=this.busy&&this.replacementPlayback&&(
      operation.name==='lux.parameters.set'||operation.name==='lux.node.parameters.set'||operation.name==='lux.node.animation.set'||operation.name==='lux.node.variation.set'||operation.name==='lux.tempo.set'||operation.name==='lux.tempo.tap'||operation.name==='lux.trigger.fire'||operation.name==='lux.node.trigger.fire'||
      (operation.name==='lux.playback'&&operation.input.action!=='reset'))?this.replacementPlayback:null;
    if (this.busy&&!replacementWrite) throw Error('A visual build is already running');
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
    if(replacementWrite&&operation.name==='lux.playback'&&[...this.pending.values()].some(wait=>wait.runtime===runtime&&wait.playback))throw Error('Wait for the playback command to complete, then try again.');
    let message:any,expectedStoryTarget:StoryCommandTarget|undefined,storyRetry=false;
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
    } else if(operation.name==='lux.node.animation.set'||operation.name==='lux.node.variation.set'){
      const linked=this.accepted?.linked,node=runtime.state.nodeControls?.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(operation.input.nodePath));
      const flat=operation.input.nodePath.length===0&&runtime.state.sdkVersion!=='0.4.0';
      if(!flat&&(!linked||!('linkedVersion' in linked)||linked.linkedVersion!==5||!node))throw Error('This visual has no matching composition node');
      if(operation.input.expectedRevisionId!==runtime.revisionId)throw Error('Revision changed; read current runtime state');
      const definitionHash=flat?runtime.state.controlSchemaHash:node!.definitionHash,schemaHash=flat?runtime.state.controlSchemaHash:node!.schemaHash,schema=flat?runtime.state.controlSchema:node!.schema;
      if(operation.input.expectedControlSchemaHash!==schemaHash)throw Error(flat?'Scene control schema changed':'Composition node control schema changed');
      const definition=schema.find(row=>row.id===operation.input.controlId);
      if(!definition)throw Error(flat?'Scene control is unavailable':'Composition node control is unavailable');
      if(runtime.animations>=Number.MAX_SAFE_INTEGER)throw Error('Animation sequence exhausted; restart runtime');
      const requested=operation.name==='lux.node.animation.set'?operation.input.animation:operation.input.variation?{kind:'variation' as const,nodePath:[...operation.input.nodePath],definitionHash,schemaHash,controlId:operation.input.controlId,...operation.input.variation}:null;
      if(requested&&!isNumberControlDefinition(definition))throw Error('Only number controls can be animated');
      if(requested){const animation=validateControlAnimationBindings([requested])[0]!;
        if(JSON.stringify(animation.nodePath)!==JSON.stringify(operation.input.nodePath)||animation.controlId!==operation.input.controlId||animation.definitionHash!==definitionHash||animation.schemaHash!==schemaHash)throw Error('Animation target identity changed');}
      const current=[...(runtime.desiredControlAnimations??runtime.state.controlAnimations??[])],index=current.findIndex(row=>JSON.stringify(row.nodePath)===JSON.stringify(operation.input.nodePath)&&row.controlId===operation.input.controlId);
      if(index>=0)current.splice(index,1,...(requested?[requested]:[]));else if(requested)current.push(requested);
      runtime.desiredControlAnimations=validateControlAnimationBindings(current);
      message={type:'animations',animationSequence:++runtime.animations,controlAnimations:runtime.desiredControlAnimations,...(operation.name==='lux.node.animation.set'&&operation.input.restart?{restart:{nodePath:operation.input.nodePath,controlId:operation.input.controlId}}:{})};
    } else if(operation.name==='lux.trigger.fire'||operation.name==='lux.node.trigger.fire'){
      if(operation.input.expectedRevisionId!==runtime.revisionId)throw Error('Revision changed; read current runtime state');
      let nodePath:readonly string[],canonicalControlId=operation.input.controlId,definition:any;
      if(operation.name==='lux.trigger.fire'){
        if(operation.input.expectedControlSchemaHash!==runtime.state.controlSchemaHash)throw Error('Control schema changed; read current runtime state');
        if(runtime.state.sdkVersion==='0.4.0'){
          const linked=this.accepted?.linked;if(!linked||!('linkedVersion' in linked)||linked.linkedVersion!==5)throw Error('This visual has no composition triggers');
          const resolved=resolveCompositionControlTarget(linked.composition,[],operation.input.controlId);nodePath=resolved.nodePath;canonicalControlId=resolved.controlId;definition={type:resolved.type};
        }else{nodePath=[];definition=runtime.state.controlSchema.find(row=>row.id===operation.input.controlId);}
      }else{
        const linked=this.accepted?.linked;if(!linked||!('linkedVersion' in linked)||linked.linkedVersion!==5)throw Error('This visual has no matching composition node');
        const selectedSchema=compositionControlSchema(linked.composition,operation.input.nodePath),selectedHash=await sha256(new TextEncoder().encode(canonicalControlSchemaJson(selectedSchema)));
        if(this.running!==runtime||runtime.terminal||operation.input.instanceId!==runtime.instanceId||operation.input.expectedGeneration!==runtime.generation||operation.input.expectedRevisionId!==runtime.revisionId)throw Error('Runtime changed; retry using its current state');
        if(operation.input.expectedControlSchemaHash!==selectedHash)throw Error('Composition node control schema changed');
        const resolved=resolveCompositionControlTarget(linked.composition,operation.input.nodePath,operation.input.controlId);nodePath=resolved.nodePath;canonicalControlId=resolved.controlId;definition={type:resolved.type};
      }
      if(definition?.type!=='trigger')throw Error('Trigger control is unavailable');
      message={type:'trigger',commandId:operation.input.commandId,nodePath,controlId:canonicalControlId};
    } else if(operation.name==='lux.story.transport'){
      const story=runtime.storyStatus;
      if(!story||!runtime.storyHash)throw Error('This visual has no active Story definition');
      if(operation.input.expectedRevisionId!==runtime.revisionId)throw Error('Revision changed; read current runtime state');
      if(operation.input.expectedStoryHash!==runtime.storyHash)throw Error('Story definition changed; read current Story status');
      const {requestId:_requestId,instanceId:_instanceId,expectedGeneration:_generation,expectedRevisionId:_revision,expectedStoryHash:_storyHash,expectedStoryRevision:_expectedStoryRevision,commandId:_commandId,...actionFields}=operation.input;
      const payloadKey=storyCommandKey(operation.input),existing=runtime.storyCommands.get(operation.input.commandId);
      if(existing&&existing.payloadKey!==payloadKey)throw Error('Story command ID was already used for another action');
      if(!existing&&operation.input.expectedStoryRevision!==story.storyRevision)throw Object.assign(Error('Story transport changed; read current status'),{code:'STORY_CHANGED'});
      const target=existing??Object.freeze({payloadKey,action:actionFields as StoryTransportAction,expectedRevision:operation.input.expectedStoryRevision,before:story});storyRetry=!!existing;expectedStoryTarget=target;
      if(!existing){if(runtime.storyCommands.size>=16384)throw Error('Story command ledger is full; restart runtime');runtime.storyCommands.set(operation.input.commandId,target);}
      message={type:'story-transport',commandId:operation.input.commandId,expectedRevisionId:operation.input.expectedRevisionId,expectedStoryHash:operation.input.expectedStoryHash,expectedStoryRevision:operation.input.expectedStoryRevision,...actionFields};
    } else if(operation.name==='lux.tempo.set'||operation.name==='lux.tempo.tap'){
      if(operation.input.expectedRevisionId!==runtime.revisionId)throw Error('Revision changed; read current runtime state');
      if(runtime.tempoCommands>=Number.MAX_SAFE_INTEGER)throw Error('Tempo sequence exhausted; restart runtime');
      runtime.tempoCommands++;
      message={type:'tempo',action:operation.name==='lux.tempo.set'?'set':'tap',...(operation.name==='lux.tempo.set'?{bpm:operation.input.bpm}:{})};
    } else {
      message = { type: 'playback', action: operation.input.action };
      if(replacementWrite){replacementPlaybackPrevious=replacementWrite.playing;replacementWrite.playing=operation.input.action==='play';}
    }
    let expectedTriggerTarget:TriggerTarget|undefined;
    if(message.type==='trigger'){
      const triggerMessage=message as {type:'trigger';commandId:string;nodePath:readonly string[];controlId:string};
      const key=triggerTargetKey(triggerMessage.nodePath,triggerMessage.controlId),existing=runtime.triggerCommands.get(triggerMessage.commandId);
      if(existing&&existing.key!==key)throw Error('Trigger command ID was already used for another target');
      if(!existing){if(runtime.triggerCommands.size>=16384)throw Error('Trigger command ledger is full; restart runtime');expectedTriggerTarget=Object.freeze({nodePath:Object.freeze([...triggerMessage.nodePath]),controlId:triggerMessage.controlId,key,sequence:runtime.triggerCommands.size+1});runtime.triggerCommands.set(triggerMessage.commandId,expectedTriggerTarget);}
      else expectedTriggerTarget=existing;
    }
    if(replacementWrite){replacementWrite.settling++;replacementWrite.synchronize?.();}
    const result=new Promise((resolve, reject) => {
      const triggerMessage=message.type==='trigger',storyMessage=message.type==='story-transport';
      const timer = setTimeout(() => {if(triggerMessage||storyMessage){const wait=this.pending.get(input.requestId);if(wait?.runtime===runtime){this.pending.delete(input.requestId);this.settleReplacementCommand(input.requestId);wait.reject(Object.assign(Error(`${storyMessage?'Story':'Trigger'} result is uncertain; retry the same command ID while this runtime generation remains active.`),{code:storyMessage?'STORY_TIMEOUT':'TRIGGER_TIMEOUT'}));}}else this.fault(runtime, 'Runtime command timed out');}, 5000);
      this.pending.set(input.requestId, { runtime, kind: 'command', playback: message.type === 'playback', resolve, reject, timer,
        ...('controlSequence' in message ? { expectedControlSequence: message.controlSequence, expectedControls: runtime.desiredControls,expectedNodeControls:runtime.desiredNodeControls } : {}),
        ...('animationSequence' in message?{expectedAnimationSequence:message.animationSequence,expectedControlAnimations:runtime.desiredControlAnimations}:{}) });
      const wait=this.pending.get(input.requestId);if(wait&&message.type==='tempo')wait.expectedTempoSequence=runtime.tempoCommands;
      if(wait&&message.type==='trigger'&&'commandId' in message){wait.expectedTriggerCommandId=(message as {commandId:string}).commandId;wait.expectedTriggerTarget=expectedTriggerTarget;}
      if(wait&&message.type==='story-transport'&&'commandId' in message){wait.expectedStoryCommandId=(message as {commandId:string}).commandId;wait.expectedStoryTarget=expectedStoryTarget;wait.expectedStoryRetry=storyRetry;}
      try { runtime.worker.postMessage({ ...message, requestId: input.requestId, instanceId: runtime.instanceId, generation: runtime.generation }); }
      catch (error) { this.fault(runtime, String(error)); }
    });
    if(!replacementWrite)return result;
    return result.then(value=>{replacementWrite.settling--;replacementWrite.synchronize?.();return value;},error=>{
      if(replacementPlaybackPrevious!==undefined)replacementWrite.playing=replacementPlaybackPrevious;
      replacementWrite.settling--;replacementWrite.synchronize?.();throw error;
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
