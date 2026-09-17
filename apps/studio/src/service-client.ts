import type { RuntimeKey, OutputSettings } from '../../../packages/runtime-contracts/src/index.ts';
import type { ControlValues, ControlMigration } from '../../../packages/runtime-contracts/src/parameters.mjs';
import { isNumberControlDefinition, normalizeControlSchema, validateControlSnapshot, validateControlPatch } from '../../../packages/runtime-contracts/src/parameters.mjs';
import { LEGACY_CONTROL_SCHEMA, LEGACY_CONTROL_SCHEMA_HASH } from './controls/control-state.ts';
import type { RuntimeControlState } from './controls/control-state.ts';
import type { PerformanceSnapshot } from './performance/performance-state.ts';
import type { ImageCompositionProfile } from '../../../packages/runtime-contracts/src/composition-profile.mjs';
import type { NodePath } from '../../../packages/runtime-contracts/src/graph.ts';
import type {ControlAnimationBinding} from '../../../packages/runtime-contracts/src/control-animation.mjs';
import type {TempoSnapshot} from './controls/tempo-clock.mjs';
export type { RuntimeKey } from '../../../packages/runtime-contracts/src/index.ts';
/** Provisional Studio view port over canonical runtime identity/output/control
 * DTOs. This is not a competing application service or frozen core API. */
/** sampledAtMs is a UI-normalized Unix-millisecond observation timestamp from
 * the status adapter, never uncalibrated GPU/process monotonic ticks. */
export type Metric = Readonly<{ value: number; sampledAtMs: number; coverage: number }>;
export type RuntimeView = RuntimeKey & Readonly<{
  revisionId: string; sceneName: string; authority: 'studio' | 'host';
  playback: 'playing' | 'paused' | 'starting' | 'failed';
  clockEpoch: number; timeSeconds?:number; frameId: string | null; controlMigration?: readonly ControlMigration[];
  tempo?:TempoSnapshot;tempoSequence?:number;
  output: Readonly<Pick<OutputSettings, 'width' | 'height'>>;
  fault: Readonly<{ code: string; message: string }> | null;
  composition?: ImageCompositionProfile;
}> & (RuntimeControlState & Readonly<{sdkVersion:'0.2.0'|'0.4.0';intensity?:never}> |
  Partial<RuntimeControlState> & Readonly<{sdkVersion?:'0.1.0';intensity:number}>);
export function getRuntimeControlState(runtime:RuntimeView):RuntimeControlState {
  const schema=normalizeControlSchema(runtime.controlSchema??LEGACY_CONTROL_SCHEMA);
  const controls=validateControlSnapshot(schema,runtime.controls??{intensity:runtime.intensity});
  return Object.freeze({sdkVersion:runtime.sdkVersion??'0.1.0',controlSchema:schema,
    controlSchemaHash:runtime.controlSchemaHash??LEGACY_CONTROL_SCHEMA_HASH,
    controls,...(runtime.effectiveControls?{effectiveControls:validateControlSnapshot(schema,runtime.effectiveControls)}:{}),controlSequence:runtime.controlSequence??0,
    controlAnimations:runtime.controlAnimations??Object.freeze([]),controlAnimationIssues:runtime.controlAnimationIssues??Object.freeze([]),animationSequence:runtime.animationSequence??0,
    ...(runtime.sdkVersion==='0.4.0'&&runtime.nodeControls?{nodeControls:runtime.nodeControls,
      ...(runtime.effectiveNodeControls?{effectiveNodeControls:runtime.effectiveNodeControls}:{})}:{} )});
}
/** Saved visual edits exclude playback and sampled animation values. */
export function runtimeEditSignature(runtime: RuntimeView | null): string | null {
  if (!runtime) return null;
  const state = getRuntimeControlState(runtime);
  return JSON.stringify({controls: state.controls, nodes: state.nodeControls?.nodes,
    animations: state.controlAnimations ?? [],tempo:{bpm:runtime.tempo?.bpm??120}, output: runtime.output});
}
export type StudioSnapshot = Readonly<{
  connection: 'disconnected' | 'connecting' | 'connected'; message: string | null;
  receivedAtMs: number | null; authoring: RuntimeView | null;
  host: Readonly<{ instanceId: string; revisionId: string }> | null;
  jobs: readonly Readonly<{ jobId: string; state: string; summary: string; fault?: string }>[];
  visualFps: Metric | null; uiFps: Metric | null;
  performance?:PerformanceSnapshot;
}>;
// These payloads match docs/design/ai-authoring.md. Acknowledgement is admission,
// never a local change to applied controls, playback state, generation, or pixels.
export type StudioOperation =
  | { name: 'lux.node.parameters.set'; input: { requestId: string; instanceId: string; expectedGeneration: number;
      expectedRevisionId: string; expectedControlSchemaHash:string; nodePath:NodePath; values:ControlValues; mode:'live' } }
  | { name: 'lux.parameters.set'; input: { requestId: string; instanceId: string; expectedGeneration: number;
      expectedRevisionId: string; expectedControlSchemaHash?:string; values: ControlValues; mode: 'live' } }
  | { name: 'lux.node.animation.set'; input: { requestId:string;instanceId:string;expectedGeneration:number;expectedRevisionId:string;
      expectedControlSchemaHash:string;nodePath:NodePath;controlId:string;animation:ControlAnimationBinding|null;restart?:boolean } }
  | { name: 'lux.node.variation.set'; input: { requestId:string;instanceId:string;expectedGeneration:number;expectedRevisionId:string;
      expectedControlSchemaHash:string;nodePath:NodePath;controlId:string;variation:Readonly<{distribution:'random'|'centered'|'spread';amount:number;enabled:boolean}>|null } }
  | { name: 'lux.playback'; input: { requestId: string; instanceId: string; expectedGeneration: number; action: 'play' | 'pause' | 'reset' } }
  | { name: 'lux.runtime.restart'; input: { requestId: string; instanceId: string; expectedGeneration: number } }
  | { name: 'lux.preview.resize'; input: { requestId: string; instanceId: string; expectedGeneration: number; width: number; height: number } }
  | { name:'lux.tempo.set';input:{requestId:string;instanceId:string;expectedGeneration:number;expectedRevisionId:string;bpm:number} }
  | { name:'lux.tempo.tap';input:{requestId:string;instanceId:string;expectedGeneration:number;expectedRevisionId:string} };
export interface StudioClient {
  getSnapshot(): StudioSnapshot;
  subscribe(listener: () => void): () => void;
  invoke(operation: StudioOperation): Promise<unknown>;
}
const disconnected: StudioSnapshot = Object.freeze({
  connection: 'disconnected', message: 'The authoring service is not connected.', receivedAtMs: null,
  authoring: null, host: null, jobs: Object.freeze([]), visualFps: null, uiFps: null,
});
export function createDisconnectedClient(): StudioClient {
  return { getSnapshot: () => disconnected, subscribe: () => () => {},
    invoke: async () => { throw Error('Authoring service unavailable'); } };
}
export class StudioController {
  private readonly client: StudioClient;
  private readonly requestId: () => string;
  private latestParameters: Extract<StudioOperation, { name: 'lux.parameters.set' }> | null = null;
  private parameterDrain: Promise<void> | null = null;
  constructor(client: StudioClient, requestId: () => string = () => crypto.randomUUID()) {
    this.client = client; this.requestId = requestId;
  }
  private target(): RuntimeView {
    const snapshot = this.client.getSnapshot();
    if (snapshot.connection !== 'connected' || !snapshot.authoring) throw Error('Authoring service unavailable');
    if (snapshot.authoring.authority !== 'studio') throw Error('Authority conflict: Studio cannot control a host instance');
    return snapshot.authoring;
  }
  async setIntensity(value: number): Promise<unknown> {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw Error('Intensity must be a finite number from 0 to 1');
    return this.setParameters({intensity:value});
  }
  async setNodeParameters(nodePath:NodePath,values:ControlValues):Promise<unknown> {
    const target=this.target();
    const node=target.nodeControls?.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(nodePath));
    if(target.sdkVersion!=='0.4.0'||!node)throw Error('Composition node is unavailable');
    const patch=validateControlPatch(node.schema,values);
    return this.client.invoke({name:'lux.node.parameters.set',input:{requestId:this.requestId(),instanceId:target.instanceId,
      expectedGeneration:target.generation,expectedRevisionId:target.revisionId,expectedControlSchemaHash:node.schemaHash,
      nodePath:[...node.nodePath],values:patch,mode:'live'}});
  }
  async setNodeAnimation(nodePath:NodePath,controlId:string,animation:ControlAnimationBinding|null,restart=false):Promise<unknown>{
    const target=this.target(),state=getRuntimeControlState(target),node=target.nodeControls?.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(nodePath));
    const flat=nodePath.length===0&&state.sdkVersion!=='0.4.0';
    const definition=(flat?state.controlSchema:node?.schema)?.find(row=>row.id===controlId);
    if(!flat&&(target.sdkVersion!=='0.4.0'||!node||!definition))throw Error('Composition node control is unavailable');
    if(flat&&!definition)throw Error('Scene control is unavailable');
    if(animation&&!isNumberControlDefinition(definition!))throw Error('Only number controls can be animated');
    const definitionHash=flat?state.controlSchemaHash:node!.definitionHash,schemaHash=flat?state.controlSchemaHash:node!.schemaHash;
    if(animation&&(JSON.stringify(animation.nodePath)!==JSON.stringify(nodePath)||animation.controlId!==controlId||animation.definitionHash!==definitionHash||animation.schemaHash!==schemaHash))throw Error('Animation target identity changed');
    return this.client.invoke({name:'lux.node.animation.set',input:{requestId:this.requestId(),instanceId:target.instanceId,expectedGeneration:target.generation,
      expectedRevisionId:target.revisionId,expectedControlSchemaHash:schemaHash,nodePath:[...nodePath],controlId,animation,...(restart?{restart:true}:{})}});
  }
  async setNodeVariation(nodePath:NodePath,controlId:string,variation:Readonly<{distribution:'random'|'centered'|'spread';amount:number;enabled:boolean}>|null):Promise<unknown>{
    const target=this.target(),state=getRuntimeControlState(target),node=target.nodeControls?.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(nodePath));
    const flat=nodePath.length===0&&state.sdkVersion!=='0.4.0';
    const definition=(flat?state.controlSchema:node?.schema)?.find(row=>row.id===controlId);
    if(!flat&&(target.sdkVersion!=='0.4.0'||!node||!definition))throw Error('Composition node control is unavailable');
    if(flat&&!definition)throw Error('Scene control is unavailable');
    if(variation&&!isNumberControlDefinition(definition!))throw Error('Only number controls support per-instance variation');
    const schemaHash=flat?state.controlSchemaHash:node!.schemaHash;
    return this.client.invoke({name:'lux.node.variation.set',input:{requestId:this.requestId(),instanceId:target.instanceId,expectedGeneration:target.generation,
      expectedRevisionId:target.revisionId,expectedControlSchemaHash:schemaHash,nodePath:[...nodePath],controlId,variation}});
  }
  async setParameters(values:ControlValues):Promise<unknown> {
    const target = this.target();
    const state=getRuntimeControlState(target), patch=validateControlPatch(state.controlSchema,values);
    const pending=this.latestParameters?.input;
    if(pending && (pending.instanceId!==target.instanceId || pending.expectedGeneration!==target.generation || pending.expectedRevisionId!==target.revisionId || pending.expectedControlSchemaHash!==(state.sdkVersion!=='0.1.0'?state.controlSchemaHash:undefined))) throw Error('Runtime target changed while parameters were queued');
    this.latestParameters = { name: 'lux.parameters.set', input: {
      requestId: this.requestId(), instanceId: target.instanceId, expectedGeneration: target.generation,
      expectedRevisionId: target.revisionId,...(state.sdkVersion!=='0.1.0'?{expectedControlSchemaHash:state.controlSchemaHash}:{}),
      values: {...pending?.values,...patch}, mode: 'live',
    } };
    return this.startParameterDrain();
  }
  private startParameterDrain(): Promise<void> {
    if (!this.parameterDrain) this.parameterDrain = this.drainParameters().then(() => {
      this.parameterDrain = null;
      if (this.latestParameters) return this.startParameterDrain();
    }, error => {
      this.parameterDrain = null; this.latestParameters = null; throw error;
    });
    return this.parameterDrain;
  }
  private async drainParameters(): Promise<void> {
    while (this.latestParameters) {
      const operation = this.latestParameters;
      this.latestParameters = null;
      // Guards belong to the input's original target, even if it waits behind a
      // write. Core must reject a replaced generation instead of retargeting it.
      await this.client.invoke(operation);
    }
  }
  async playback(action: 'play' | 'pause' | 'reset'): Promise<unknown> {
    const target = this.target();
    return this.client.invoke({ name: 'lux.playback', input: {
      requestId: this.requestId(), instanceId: target.instanceId, expectedGeneration: target.generation, action,
    } });
  }
  async setTempoBpm(bpm:number):Promise<unknown>{
    if(!Number.isFinite(bpm)||bpm<20||bpm>300)throw Error('Tempo BPM must be from 20 through 300');
    const target=this.target();
    return this.client.invoke({name:'lux.tempo.set',input:{requestId:this.requestId(),instanceId:target.instanceId,expectedGeneration:target.generation,expectedRevisionId:target.revisionId,bpm}});
  }
  async tapTempo():Promise<unknown>{
    const target=this.target();
    return this.client.invoke({name:'lux.tempo.tap',input:{requestId:this.requestId(),instanceId:target.instanceId,expectedGeneration:target.generation,expectedRevisionId:target.revisionId}});
  }
  async restart(): Promise<unknown> {
    const target = this.target();
    return this.client.invoke({ name: 'lux.runtime.restart', input: {
      requestId: this.requestId(), instanceId: target.instanceId, expectedGeneration: target.generation,
    } });
  }
  async resize(width: number, height: number): Promise<unknown> {
    const target = this.target();
    return this.client.invoke({ name: 'lux.preview.resize', input: { requestId: this.requestId(), instanceId: target.instanceId,
      expectedGeneration: target.generation, width, height } });
  }
}
