import type { NumberControlDefinition } from '../../runtime-contracts/src/parameters.mjs';

/** Canonical lower-case RFC UUIDs (versions 1–8, RFC variant); no nil/max sentinel. */
export type InputTarget = Readonly<{ sceneId: string; nodePath: readonly string[]; controlId: string }>;
export type ResolvedInputTarget = Readonly<{ target: InputTarget; definition: NumberControlDefinition }>;
export type InputValue = Readonly<{ target: InputTarget; value: number }>;
export type SourceRef = Readonly<{ sourceId: string; signalId: string }>;
export type SignalValue = Readonly<{ source: SourceRef; value: number }>;
export type NumericBinding = Readonly<{
  id: string; phase: 'macro' | 'modulation'; source: SourceRef; target: InputTarget;
  inputMin: number; inputMax: number; outputMin: number; outputMax: number;
  exponent: number; invert: boolean; mode: 'replace' | 'add' | 'multiply'; enabled: boolean;
}>;
export type NumericMappingPlan = Readonly<{ version: 1; targets: readonly ResolvedInputTarget[]; bindings: readonly NumericBinding[] }>;
export type MappingFrame = Readonly<{ authority: 'studio' | 'host'; base: readonly InputValue[]; signals: readonly SignalValue[]; hostValues: readonly InputValue[] }>;
export type BindingTrace = Readonly<{
  bindingId: string; phase: 'macro' | 'modulation'; status: 'applied' | 'disabled' | 'unresolved-source' | 'host-owned';
  before: number; mapped: number | null; after: number;
}>;
export type TargetTrace = Readonly<{
  target: InputTarget; authority: 'studio' | 'host'; base: number; afterMacros: number;
  beforeClamp: number; effective: number; clamped: boolean; bindings: readonly BindingTrace[];
}>;
export type MappingResult = Readonly<{ version: 1; values: readonly InputValue[]; traces: readonly TargetTrace[] }>;
/** Strict descriptor-safe admission; returns a detached recursively frozen plan. */
export function normalizeNumericMappingPlan(input: unknown): NumericMappingPlan;
/** Both arguments are revalidated as data; readonly types confer no trust. */
export function evaluateNumericMappings(plan: NumericMappingPlan, frame: MappingFrame): MappingResult;
export const inputMappingLimits: Readonly<{ targets: 256; bindings: 256; sources: 256; nodeDepth: 8; metadataBytes: 262144 }>;
