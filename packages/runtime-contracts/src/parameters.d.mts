export interface NumberDeclaration {
  readonly type: 'number'; readonly label: string; readonly default: number;
  readonly min: number; readonly max: number; readonly step?: number; readonly unit?: string;
}
export type ControlDeclarations = Readonly<Record<string, NumberDeclaration>>;
export interface NumberControlDefinition extends NumberDeclaration { readonly id: string; readonly changeCost: 'live' }
export type ControlSchema = readonly NumberControlDefinition[];
export type ControlValues = Readonly<Record<string, number>>;
export type ControlsOf<C extends ControlDeclarations> = { readonly [K in keyof C]: number };
export type ControlMigration = Readonly<
  | { id: string; reason: 'added'; value: number }
  | { id: string; reason: 'removed'; previousValue: number }
  | { id: string; reason: 'unit-changed' | 'out-of-range'; previousValue: number; value: number }
>;
export const parameterLimits: Readonly<{ count: 32; metadataBytes: 32768; id: 64; label: 80; unit: 24 }>;
export function normalizeControlDeclarations(input: unknown): ControlSchema;
export function normalizeControlSchema(input: unknown): ControlSchema;
/** Canonical UTF-8 JSON input for SHA-256; hashing is owned by the caller. */
export function canonicalControlSchemaJson(schema: unknown): string;
export function defaultControlValues(schema: unknown): ControlValues;
/** Validates a nonempty partial patch. Does not merge, mutate or quantize. */
export function validateControlPatch(schema: unknown, input: unknown): ControlValues;
export function validateControlSnapshot(schema: unknown, input: unknown): ControlValues;
export function reconcileControlValues(previousSchema: unknown, previousValues: unknown, nextSchema: unknown): Readonly<{
  values: ControlValues; changes: readonly ControlMigration[];
}>;
