export interface NumberDeclaration {
  readonly type: 'number'; readonly label: string; readonly default: number;
  readonly min: number; readonly max: number; readonly step?: number; readonly unit?: string; readonly description?: string; readonly group?: string;
}
export interface BooleanDeclaration {
  readonly type: 'boolean'; readonly label: string; readonly default: boolean;
  readonly description?: string; readonly group?: string;
}
export interface EnumOption { readonly id: string; readonly label: string; readonly description?: string }
export type EnumPresentation = 'segmented' | 'radio' | 'dropdown';
export interface EnumDeclaration<Options extends readonly EnumOption[] = readonly EnumOption[]> {
  readonly type: 'enum'; readonly label: string; readonly default: Options[number]['id']; readonly options: Options;
  readonly presentation?: EnumPresentation; readonly description?: string; readonly group?: string;
}
export interface TriggerDeclaration {
  readonly type: 'trigger'; readonly label: string; readonly description?: string; readonly group?: string;
}
export type ControlDeclaration = NumberDeclaration | BooleanDeclaration | EnumDeclaration | TriggerDeclaration;
export type ControlDeclarations = Readonly<Record<string, ControlDeclaration>>;
export type ValidControlDeclarations<C extends ControlDeclarations> = Readonly<{
  [K in keyof C]: C[K] extends { readonly type: 'enum'; readonly options: infer O extends readonly EnumOption[] }
    ? C[K] & { readonly default: O[number]['id'] }
    : C[K]
}>;
export interface NumberControlDefinition extends NumberDeclaration { readonly id: string; readonly changeCost: 'live' }
export interface BooleanControlDefinition extends BooleanDeclaration { readonly id: string; readonly changeCost: 'live' }
export interface EnumControlDefinition extends Omit<EnumDeclaration, 'presentation'> { readonly id: string; readonly presentation: EnumPresentation; readonly changeCost: 'live' }
export interface TriggerControlDefinition extends TriggerDeclaration { readonly id: string; readonly changeCost: 'live' }
export type ControlDefinition = NumberControlDefinition | BooleanControlDefinition | EnumControlDefinition | TriggerControlDefinition;
export type ControlSchema = readonly ControlDefinition[];
export type ControlDefinitionOf<D> = D extends NumberDeclaration ? NumberControlDefinition
  : D extends BooleanDeclaration ? BooleanControlDefinition
    : D extends EnumDeclaration<infer O> ? Omit<EnumControlDefinition, 'default' | 'options'> & { readonly default: O[number]['id']; readonly options: O }
      : D extends TriggerDeclaration ? TriggerControlDefinition
      : never;
export type ControlSchemaOf<C extends ControlDeclarations> = [keyof C] extends [never]
  ? readonly NumberControlDefinition[]
  : readonly ControlDefinitionOf<C[keyof C]>[];
export type ControlValue = number | boolean | string;
export type ControlValues = Readonly<Record<string, ControlValue>>;
type ControlValueOf<D> = D extends NumberDeclaration ? number
  : D extends BooleanDeclaration ? boolean
    : D extends { readonly type: 'enum'; readonly options: infer O extends readonly EnumOption[] } ? O[number]['id']
      : never;
export type ControlsOf<C extends ControlDeclarations> = Readonly<{ [K in keyof C as C[K] extends TriggerDeclaration ? never : K]: ControlValueOf<C[K]> }>;
export type NumberControlIdsOf<C extends ControlDeclarations> = { [K in keyof C]: Extract<C[K], NumberDeclaration> extends never ? never : K }[keyof C] & string;
export type TriggerIdsOf<C extends ControlDeclarations> = { [K in keyof C]: Extract<C[K], TriggerDeclaration> extends never ? never : K }[keyof C] & string;
export type ControlTriggerEvent<C extends ControlDeclarations = ControlDeclarations> = Readonly<{
  type: 'trigger'; controlId: TriggerIdsOf<C>; commandId: string; sequence: number;
}>;
export type ControlMigration = Readonly<
  | { id: string; reason: 'added'; value: ControlValue }
  | { id: string; reason: 'removed'; previousValue: ControlValue }
  | { id: string; reason: 'unit-changed' | 'out-of-range' | 'option-removed' | 'type-changed'; previousValue: ControlValue; value: ControlValue }
>;
export const parameterLimits: Readonly<{ metadataBytes: 32768; id: 64; label: 80; unit: 24; description: 512; group: 80 }>;
export function normalizeControlDeclarations(input: unknown): ControlSchema;
export function normalizeControlSchema(input: unknown): ControlSchema;
/** Canonical UTF-8 JSON input for SHA-256; hashing is owned by the caller. */
export function canonicalControlSchemaJson(schema: unknown): string;
export function defaultControlValues(schema: unknown): ControlValues;
export function isNumberControlDefinition(value: ControlDefinition): value is NumberControlDefinition;
/** Validates a nonempty partial patch. Does not merge, mutate or quantize. */
export function validateControlPatch(schema: unknown, input: unknown): ControlValues;
export function validateControlSnapshot(schema: unknown, input: unknown): ControlValues;
export function reconcileControlValues(previousSchema: unknown, previousValues: unknown, nextSchema: unknown): Readonly<{
  values: ControlValues; changes: readonly ControlMigration[];
}>;
