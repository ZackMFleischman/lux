export const limits: Readonly<{
  sourceBytes: number; files: number; diagnosticBytes: number;
  compileMs: number; outputBytes: number; sourceJsonBytes: number; requestBytes: number;
}>;
export function violation(message: string, code?: string): Error & { code: string };
export function validateSource(source: unknown): import('../../../packages/runtime-contracts/src/index.ts').SourceBundle;
export function snapshotRecord(value: unknown, fields?: string[]): Record<string, unknown>;
