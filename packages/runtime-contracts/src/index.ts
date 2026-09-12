import { z } from 'zod';

export const SDK_VERSION = '0.1.0' as const;
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const runtimeKeySchema = z.object({ instanceId: z.string().uuid(), generation: z.number().int().nonnegative().safe() }).strict();
export type RuntimeKey = z.infer<typeof runtimeKeySchema>;
export const outputSettingsSchema = z.object({
  width: z.number().int().min(1).max(1920), height: z.number().int().min(1).max(1080),
  fps: z.number().finite().positive().max(240), seed: z.number().int().min(0).max(0xffffffff),
}).strict();
export type OutputSettings = z.infer<typeof outputSettingsSchema>;
export const DEFAULT_OUTPUT: Readonly<OutputSettings> = Object.freeze({ width: 1920, height: 1080, fps: 60, seed: 0 });

export const controlDefinitionSchema = z.object({
  id: z.literal('intensity'), type: z.literal('number'), label: z.literal('Intensity'),
  default: z.literal(0.5), min: z.literal(0), max: z.literal(1), changeCost: z.literal('live'),
}).strict();
export type ControlDefinition = z.infer<typeof controlDefinitionSchema>;
export const INTENSITY_CONTROL: Readonly<ControlDefinition> = Object.freeze({
  id: 'intensity', type: 'number', label: 'Intensity', default: 0.5, min: 0, max: 1, changeCost: 'live',
});
export const controlValuesSchema = z.object({ intensity: z.number().finite().min(0).max(1) }).strict();
export type ControlValues = z.infer<typeof controlValuesSchema>;

// Canonical paths, UTF-8 validity and aggregate byte quotas are checked by the
// compiler admission policy, before files are materialized. These DTOs never
// authorize filesystem operations or execution of submitted code.
export const sourceBundleSchema = z.object({ entry: z.string().min(1), files: z.record(z.string()), sdkVersion: z.literal(SDK_VERSION) }).strict();
export type SourceBundle = z.infer<typeof sourceBundleSchema>;
export const compileRequestSchema = z.object({ source: sourceBundleSchema }).strict();
export type CompileRequest = z.infer<typeof compileRequestSchema>;
export const compileDiagnosticSchema = z.object({
  code: z.string(), message: z.string(), file: z.string().optional(),
  line: z.number().int().positive().optional(), column: z.number().int().positive().optional(),
}).strict();
export type CompileDiagnostic = z.infer<typeof compileDiagnosticSchema>;
export const compiledArtifactSchema = z.object({
  sourceHash: hashSchema, bundleHash: hashSchema, entry: z.string().min(1),
  modules: z.record(z.string()), sourceMaps: z.record(z.string()),
  dependencyHashes: z.record(hashSchema), sdkVersion: z.literal(SDK_VERSION), compilerVersion: z.string().min(1),
}).strict();
export type CompiledArtifact = z.infer<typeof compiledArtifactSchema>;
// A compiled artifact has not run a candidate smoke test and is not a ValidatedBundle.
export const compileFailureCodeSchema = z.enum(['SOURCE_BOUNDARY_VIOLATION', 'COMPILE_FAILED', 'QUOTA_EXCEEDED', 'TIMEOUT', 'SERVICE_UNAVAILABLE']);
export type CompileFailureCode = z.infer<typeof compileFailureCodeSchema>;
export const compileResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), artifact: compiledArtifactSchema, diagnostics: z.array(compileDiagnosticSchema) }).strict(),
  z.object({ ok: z.literal(false), code: compileFailureCodeSchema, diagnostics: z.array(compileDiagnosticSchema) }).strict(),
]);
export type CompileResult = z.infer<typeof compileResultSchema>;
