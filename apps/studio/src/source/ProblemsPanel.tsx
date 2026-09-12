import { Button } from '@mui/material';
import { diagnosticTarget } from './diagnostics.ts';
import type { SourceDiagnostic } from './diagnostics.ts';
import type { SourceSnapshot } from './workspace.ts';
export function ProblemsPanel({ diagnostics, snapshot, onNavigate }: {
  diagnostics: readonly SourceDiagnostic[]; snapshot: SourceSnapshot; onNavigate(target: { path: string; offset: number }): void;
}) {
  if (!diagnostics.length) return null;
  return <section aria-label="Source problems"><h3>Problems</h3><ul>{diagnostics.map((diagnostic, index) => {
    const target = diagnosticTarget(diagnostic, snapshot), stale = diagnostic.draftVersion !== snapshot.version;
    return <li key={index}><Button disabled={!target} onClick={() => target && onNavigate(target)}>
      {diagnostic.file ? `${diagnostic.file}:${diagnostic.line ?? ''}:${diagnostic.column ?? ''} ` : ''}{diagnostic.message}
    </Button>{diagnostic.candidateOnly ? <span>Diagnostic belongs to a rejected candidate; the displayed source is unchanged.</span> : stale ? <span>Stale diagnostic: source has changed. Build again to refresh.</span> : !target && <span>Location unavailable in this source bundle.</span>}</li>;
  })}</ul></section>;
}
