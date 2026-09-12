import type { RuntimeKey, OutputSettings } from '../../../packages/runtime-contracts/src/index.ts';
import type { ControlValues, ControlMigration } from '../../../packages/runtime-contracts/src/parameters.mjs';
import { normalizeControlSchema, validateControlSnapshot, validateControlPatch } from '../../../packages/runtime-contracts/src/parameters.mjs';
import { LEGACY_CONTROL_SCHEMA, LEGACY_CONTROL_SCHEMA_HASH } from './controls/control-state.ts';
import type { RuntimeControlState } from './controls/control-state.ts';
export type { RuntimeKey } from '../../../packages/runtime-contracts/src/index.ts';
/** Provisional Studio view port over canonical runtime identity/output/control
 * DTOs. This is not a competing application service or frozen core API. */
/** sampledAtMs is a UI-normalized Unix-millisecond observation timestamp from
 * the status adapter, never uncalibrated GPU/process monotonic ticks. */
export type Metric = Readonly<{ value: number; sampledAtMs: number; coverage: number }>;
export type RuntimeView = RuntimeKey & Readonly<{
  revisionId: string; sceneName: string; authority: 'studio' | 'host';
  playback: 'playing' | 'paused' | 'starting' | 'failed';
  clockEpoch: number; frameId: string | null; controlMigration?: readonly ControlMigration[];
  output: Readonly<Pick<OutputSettings, 'width' | 'height'>>;
  fault: Readonly<{ code: string; message: string }> | null;
}> & (RuntimeControlState & Readonly<{sdkVersion:'0.2.0';intensity?:never}> |
  Partial<RuntimeControlState> & Readonly<{sdkVersion?:'0.1.0';intensity:number}>);
export function getRuntimeControlState(runtime:RuntimeView):RuntimeControlState {
  const schema=normalizeControlSchema(runtime.controlSchema??LEGACY_CONTROL_SCHEMA);
  return Object.freeze({sdkVersion:runtime.sdkVersion??'0.1.0',controlSchema:schema,
    controlSchemaHash:runtime.controlSchemaHash??LEGACY_CONTROL_SCHEMA_HASH,
    controls:validateControlSnapshot(schema,runtime.controls??{intensity:runtime.intensity}),controlSequence:runtime.controlSequence??0});
}
export type StudioSnapshot = Readonly<{
  connection: 'disconnected' | 'connecting' | 'connected'; message: string | null;
  receivedAtMs: number | null; authoring: RuntimeView | null;
  host: Readonly<{ instanceId: string; revisionId: string }> | null;
  jobs: readonly Readonly<{ jobId: string; state: string; summary: string; fault?: string }>[];
  visualFps: Metric | null; uiFps: Metric | null;
}>;
// These payloads match docs/design/ai-authoring.md. Acknowledgement is admission,
// never a local change to applied controls, playback state, generation, or pixels.
export type StudioOperation =
  | { name: 'lux.parameters.set'; input: { requestId: string; instanceId: string; expectedGeneration: number;
      expectedRevisionId: string; expectedControlSchemaHash?:string; values: ControlValues; mode: 'live' } }
  | { name: 'lux.playback'; input: { requestId: string; instanceId: string; expectedGeneration: number; action: 'play' | 'pause' | 'reset' } }
  | { name: 'lux.runtime.restart'; input: { requestId: string; instanceId: string; expectedGeneration: number } };
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
  async setParameters(values:ControlValues):Promise<unknown> {
    const target = this.target();
    const state=getRuntimeControlState(target), patch=validateControlPatch(state.controlSchema,values);
    const pending=this.latestParameters?.input;
    if(pending && (pending.instanceId!==target.instanceId || pending.expectedGeneration!==target.generation || pending.expectedRevisionId!==target.revisionId || pending.expectedControlSchemaHash!==(target.sdkVersion==='0.2.0'?state.controlSchemaHash:undefined))) throw Error('Runtime target changed while parameters were queued');
    this.latestParameters = { name: 'lux.parameters.set', input: {
      requestId: this.requestId(), instanceId: target.instanceId, expectedGeneration: target.generation,
      expectedRevisionId: target.revisionId,...(target.sdkVersion==='0.2.0'?{expectedControlSchemaHash:state.controlSchemaHash}:{}),
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
  async restart(): Promise<unknown> {
    const target = this.target();
    return this.client.invoke({ name: 'lux.runtime.restart', input: {
      requestId: this.requestId(), instanceId: target.instanceId, expectedGeneration: target.generation,
    } });
  }
}
