import type { SourceSnapshot } from './workspace.ts';
import type { SourceBundle } from '../../../../packages/runtime-contracts/src/index.ts';
import { equalSource } from './source-equality.ts';
export type CompilerDiagnostic = { file?: string; line?: number; column?: number; message: string };
export type SourceDiagnostic = CompilerDiagnostic & { draftVersion: number; candidateOnly?: boolean };
export function diagnosticsForSource(diagnostics: readonly CompilerDiagnostic[], submitted: SourceBundle, draftVersion: number, snapshot: SourceSnapshot): SourceDiagnostic[] {
  const current = snapshot.source;
  const candidateOnly = !equalSource(submitted, current);
  return diagnostics.map(diagnostic => ({ ...diagnostic, draftVersion, candidateOnly }));
}
export class SourceCompileError extends Error {
  readonly diagnostics: readonly CompilerDiagnostic[];
  constructor(diagnostics: CompilerDiagnostic[]) {
    super(diagnostics.map(d => `${d.file ? `${d.file}:${d.line ?? ''}:${d.column ?? ''} ` : ''}${d.message}`).join('\n') || 'Compilation failed');
    this.name = 'SourceCompileError';
    this.diagnostics = Object.freeze(diagnostics.map(d => Object.freeze({ ...d })));
  }
}
export function diagnosticTarget(diagnostic: SourceDiagnostic, snapshot: SourceSnapshot): { path: string; offset: number } | null {
  const path = diagnostic.file;
  if (diagnostic.candidateOnly || diagnostic.draftVersion !== snapshot.version || !path || !Object.hasOwn(snapshot.source.files, path)) return null;
  const text = snapshot.source.files[path]!, lines = text.split('\n');
  const position = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? Math.max(0, Math.floor(value) - 1) : 0;
  const line = Math.min(position(diagnostic.line), lines.length - 1);
  const lineText = lines[line]!.replace(/\r$/, '');
  let offset = Math.min(position(diagnostic.column), lineText.length);
  for (let index = 0; index < line; index++) offset += lines[index]!.length + 1;
  return { path, offset };
}
