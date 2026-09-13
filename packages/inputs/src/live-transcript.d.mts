import type { TimelineDefinition, SourceAuthority, InputEnvelope, IngressDecision,
  DiscardedEvent, AdmittedInput, TimelineStep, TimelineCounters } from './timeline.mjs';
import type { TimedMappingPlan, TimedMappingFrame, InputValue } from './mapping.mjs';
import type { ReplaySourceConfig } from './replay-fixture.mjs';
export type LiveReceiptRef = Readonly<{ epoch: number; ingress: number }>;
export type LiveTranscriptOperation =
  Readonly<{ kind: 'admit'; observedAtMs: number | null; nowMs: number;
    envelopes: readonly InputEnvelope[]; decisions: readonly IngressDecision[] }> |
  Readonly<{ kind: 'sources'; observedAtMs: number | null;
    sources: readonly SourceAuthority[]; discarded: readonly DiscardedEvent[] }> |
  Readonly<{ kind: 'reset'; observedAtMs: number | null; definition: TimelineDefinition;
    epoch: number; startMs: number; discarded: readonly DiscardedEvent[] }> |
  Readonly<{ kind: 'step'; observedAtMs: number | null; step: TimelineStep;
    frame: TimedMappingFrame; events: readonly AdmittedInput[];
    discarded: readonly DiscardedEvent[]; values: readonly InputValue[];
    continuous: readonly LiveReceiptRef[] }>;
export type LiveTranscriptEnding =
  Readonly<{ status: 'complete'; reason: 'requested'; lostRecords: 0 }> |
  Readonly<{ status: 'incomplete'; reason: 'pending-events' | 'output-loss' |
    'owner-error' | 'quota' | 'cancelled' | 'unrecordable-input';
    lostRecords: number | null }>;
export type LivePolicyTranscript = Readonly<{
  version: 1; mode: 'live-policy-transcript'; profile: 'i02b-v1'; seed: number;
  mapping: TimedMappingPlan;
  initial: Readonly<{ epoch: number; startMs: number; definition: TimelineDefinition }>;
  clock: Readonly<{ inputDomainId: string; observationDomainId: string; unit: 'ms' }>;
  sourceConfigs: readonly ReplaySourceConfig[];
  operations: readonly LiveTranscriptOperation[]; ending: LiveTranscriptEnding;
}>;
export type LiveTranscriptSummary = Readonly<{
  operations: number; received: number; counters: TimelineCounters;
  pendingEvents: readonly LiveReceiptRef[]; heldContinuous: readonly LiveReceiptRef[];
  work: number;
}>;
export type NormalizedLiveTranscript = Readonly<{
  transcript: LivePolicyTranscript; summary: LiveTranscriptSummary;
}>;
export type EncodedLiveTranscript = NormalizedLiveTranscript &
  Readonly<{ json: string; sha256: string }>;
export function normalizeLivePolicyTranscript(input: unknown): NormalizedLiveTranscript;
export function encodeLivePolicyTranscript(input: unknown): Promise<EncodedLiveTranscript>;
export function decodeLivePolicyTranscript(json: string, expectedSha256: string): Promise<EncodedLiveTranscript>;
export const liveTranscriptLimits: Readonly<{
  bytes: 8388608; values: 250000; depth: 16; operations: 1024;
  envelopes: 8192; sourceConfigs: 256; work: 65536;
}>;
