import type { SourceRef, InputValue, TimedMappingFrame } from './mapping.mjs';
export type InputKind = 'continuous' | 'event';
export type SourceAuthority = Readonly<{
  sourceId: string; generation: number; connected: boolean; calibrationId: string;
}>;
export type SignalDeclaration = Readonly<{ source: SourceRef; kind: InputKind }>;
export type TimelineDefinition = Readonly<{
  version: 1; sources: readonly SourceAuthority[]; signals: readonly SignalDeclaration[];
}>;
export type EventPayload = Readonly<{ type: string; values: readonly number[] }>;
export type EnvelopeBase = Readonly<{
  version: 1; epoch: number; source: SourceRef; generation: number;
  calibrationId: string; sequence: number; timestampMs: number;
}>;
export type InputEnvelope = EnvelopeBase & (
  Readonly<{ kind: 'continuous'; value: number }> |
  Readonly<{ kind: 'event'; payload: EventPayload }>
);
export type AdmittedInput = Readonly<{
  envelope: InputEnvelope; ingress: number; receivedAtMs: number;
}>;
export type SourceCursor = Readonly<{
  authority: SourceAuthority; sequence: number | null; timestampMs: number | null;
}>;
export type RejectionReason = 'epoch' | 'unknown-source' | 'unknown-signal' |
  'kind' | 'generation' | 'disconnected' | 'calibration' | 'sequence' |
  'timestamp' | 'future' | 'late' | 'overflow';
export type DiscardReason = 'late' | 'source-reset' | 'reset';
export type RejectedInput = Readonly<{ envelope: InputEnvelope; reason: RejectionReason }>;
export type DiscardedEvent = Readonly<{ admitted: AdmittedInput; reason: DiscardReason }>;
export type TimelineCounters = Readonly<{
  received: number; acceptedContinuous: number; acceptedEvents: number;
  rejected: Readonly<Record<RejectionReason, number>>;
  consumedEvents: number; discarded: Readonly<Record<DiscardReason, number>>;
  coalescedContinuous: number; expiredContinuous: number; clearedContinuous: number;
}>;
export type LiveInputState = Readonly<{
  version: 1; epoch: number; startMs: number; lastStepMs: number; stepped: boolean;
  ingressNowMs: number; nextIngress: number;
  sources: readonly SourceCursor[]; signals: readonly SignalDeclaration[];
  continuous: readonly AdmittedInput[]; events: readonly AdmittedInput[];
  counters: TimelineCounters;
}>;
export type IngressDecision =
  Readonly<{ status: 'accepted'; admitted: AdmittedInput }> |
  Readonly<{ status: 'rejected'; rejected: RejectedInput }>;
export type IngressResult = Readonly<{ state: LiveInputState; decisions: readonly IngressDecision[] }>;
export type SourceChangeResult = Readonly<{ state: LiveInputState; discarded: readonly DiscardedEvent[] }>;
export type TimelineStep = Readonly<{
  timeMs: number; authority: 'studio' | 'host';
  base: readonly InputValue[]; hostValues: readonly InputValue[];
}>;
export type TimelineStepResult = Readonly<{
  state: LiveInputState; frame: TimedMappingFrame;
  events: readonly AdmittedInput[]; discarded: readonly DiscardedEvent[];
}>;
export function createLiveInputState(definition: TimelineDefinition, epoch: number, startMs: number): LiveInputState;
/** Revalidates descriptor-safe data and returns a detached, deeply frozen state. */
export function normalizeLiveInputState(input: unknown): LiveInputState;
export function admitLiveInputs(state: LiveInputState, nowMs: number, envelopes: readonly InputEnvelope[]): IngressResult;
export function changeLiveInputSources(state: LiveInputState, sources: readonly SourceAuthority[]): SourceChangeResult;
/** Candidate only: commit both timeline and mapping states after evaluator success. */
export function stepLiveInputs(state: LiveInputState, step: TimelineStep): TimelineStepResult;
export function resetLiveInputs(state: LiveInputState, definition: TimelineDefinition, epoch: number, startMs: number): SourceChangeResult;
export const inputTimelineLimits: Readonly<{
  sources: 64; signals: 256; batch: 256; queuedEvents: 256; consumedPerStep: 32;
  liveLatenessMs: 100; freshnessMs: 500; payloadValues: 16;
  inputBytes: 262144; stateBytes: 1048576; resultBytes: 2097152; maxStepDeltaMs: 60000;
}>;
