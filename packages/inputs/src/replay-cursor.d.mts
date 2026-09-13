import type { InputEnvelope } from './timeline.mjs';
import type { InputValue } from './mapping.mjs';

declare const cursorBrand: unique symbol;
/** Only a verified construction creates a runtime-authenticated handle. */
export type ScriptedReplayCursor = Readonly<{ readonly [cursorBrand]: true }>;
export type ReplayBudget = Readonly<{ evaluations: number; events: number; work: number }>;
export type ReplayCursorView = Readonly<{
  version: 1; fixtureHash: string; runtimeEpoch: number; seed: number;
  durationMs: number; positionMs: number; zeroConsumed: boolean;
  values: readonly InputValue[];
}>;
export type ReplayEvent = Readonly<{
  fixtureHash: string; operationIndex: number;
  original: InputEnvelope & Readonly<{ kind: 'event' }>;
  runtime: InputEnvelope & Readonly<{ kind: 'event' }>;
}>;
export type ReplayEvaluation = Readonly<{
  fromMs: number; toMs: number;
  reason: 'initial' | 'advance' | 'continuous' | 'sources' | 'projection';
  operationIndex: number | null;
}>;
export type ReplayCursorResult = Readonly<{
  view: ReplayCursorView; previousMs: number; nextMs: number;
  events: readonly ReplayEvent[]; evaluations: readonly ReplayEvaluation[]; work: number;
}>;
/** Captures primitive arguments before awaiting the real fixture SHA verifier. */
export function createScriptedReplayCursor(json: string, expectedSha256: string, runtimeEpoch: number): Promise<ScriptedReplayCursor>;
export function inspectScriptedReplayCursor(cursor: ScriptedReplayCursor): ReplayCursorView;
/** Atomic forward query; transient presentation projections never become checkpoints. */
export function advanceScriptedReplayCursor(cursor: ScriptedReplayCursor,
  request: Readonly<{ runtimeEpoch: number; previousMs: number; nextMs: number; budget: ReplayBudget }>): ReplayCursorResult;
export function resetScriptedReplayCursor(cursor: ScriptedReplayCursor,
  request: Readonly<{ runtimeEpoch: number; nextEpoch: number }>): ReplayCursorView;
/** Replays from zero in a strictly newer epoch; returns every historical event through nextMs. */
export function seekScriptedReplayCursor(cursor: ScriptedReplayCursor,
  request: Readonly<{ runtimeEpoch: number; nextEpoch: number; nextMs: number; budget: ReplayBudget }>): ReplayCursorResult;
export const replayCursorLimits: Readonly<{
  evaluations: 32768; events: 8192; work: 1048576; resultBytes: 16777216;
}>;
