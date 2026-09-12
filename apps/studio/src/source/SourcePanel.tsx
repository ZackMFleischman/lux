import { useState, useSyncExternalStore, useRef } from 'react';
import { Alert, Button, Tab, Tabs, TextField } from '@mui/material';
import type { SourceWorkspace } from './workspace.ts';
import { CodeEditor } from './CodeEditor.tsx';
import { editorCache } from './editor-state.ts';
import { ProblemsPanel } from './ProblemsPanel.tsx';
import type { SourceDiagnostic } from './diagnostics.ts';
export function SourcePanel({ workspace, readOnly, onSave, onCompositionChange, diagnosticTarget, diagnostics = [] }: {
  workspace: SourceWorkspace; readOnly: boolean; onSave(): void; onCompositionChange?(value: boolean): void;
  diagnosticTarget?: { path: string; offset: number; request: number } | null;
  diagnostics?: readonly SourceDiagnostic[];
}) {
  const snapshot = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const [newPath, setNewPath] = useState(''), [error, setError] = useState('');
  const [navigation, setNavigation] = useState<{ path: string; offset: number; request: number; version: number } | null>(null);
  const composing = useRef(false), cache = editorCache(workspace);
  cache.reconcile(snapshot.documentKey, snapshot.source);
  const locked = readOnly || snapshot.busy;
  function attempt(action: () => void) { try { action(); setError(''); } catch (reason) { setError(String(reason)); } }
  return <section className="source-workspace" aria-label="Source workspace" onKeyDownCapture={event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault(); if (!locked && !composing.current && !event.nativeEvent.isComposing) onSave();
    }
  }}>
    <div className="source-header"><span>Source / {snapshot.selectedFile || snapshot.source.entry}</span>
      <Button disabled={locked || !snapshot.canUndoReplacement} onClick={() => workspace.undoReplacement()}>Undo source replacement</Button></div>
    <div className="source-columns"><details className="source-files" open><summary>Files ({Object.keys(snapshot.source.files).length})</summary>
      <nav aria-label="Source files">{Object.keys(snapshot.source.files).map(path => <Button key={path} aria-label={`Open ${path}`} aria-current={snapshot.selectedFile === path ? 'page' : undefined}
        onClick={() => workspace.openFile(path)}>{path}{path === snapshot.source.entry ? ' · Entry' : ''}{snapshot.dirtyFiles.includes(path) ? ' *' : ''}</Button>)}</nav>
      <form onSubmit={event => { event.preventDefault(); if (!locked) attempt(() => { workspace.addFile(newPath, ''); setNewPath(''); }); }}>
        <TextField label="New TypeScript file" value={newPath} disabled={locked} size="small" onChange={event => setNewPath(event.target.value)} placeholder="lib/helper.ts" />
        <Button type="submit" disabled={locked}>Add file</Button>
      </form></details>
      <div className="source-editing"><Tabs value={snapshot.selectedFile || false} onChange={(_, path: string) => workspace.openFile(path)} variant="scrollable" scrollButtons="auto" aria-label="Open source files">
        {snapshot.openFiles.map(path => <Tab key={path} value={path} label={`${path}${snapshot.dirtyFiles.includes(path) ? ' *' : ''}`} />)}
      </Tabs>
      {snapshot.selectedFile && <><Button aria-label={`Close ${snapshot.selectedFile}`} onClick={() => workspace.closeFile(snapshot.selectedFile)}>Close tab</Button>
        <CodeEditor documentKey={snapshot.documentKey} path={snapshot.selectedFile} text={snapshot.source.files[snapshot.selectedFile]!} readOnly={locked} cache={cache}
          onChange={text => attempt(() => workspace.edit(snapshot.selectedFile, text))} diagnosticTarget={diagnosticTarget ?? (navigation?.version === snapshot.version ? navigation : null)}
          onCompositionChange={value => { composing.current = value; onCompositionChange?.(value); }} /></>}
      {!snapshot.selectedFile && <p>Choose a file to edit. Closed tabs retain their drafts.</p>}
      <p id="source-keyboard-help" className="source-keyboard-help">Tab moves focus out of the editor. Ctrl+F searches; Ctrl+S saves all files.</p>
      </div></div>{error && <Alert severity="error">{error}</Alert>}
      <ProblemsPanel diagnostics={diagnostics} snapshot={snapshot} onNavigate={target => {
        workspace.openFile(target.path); setNavigation(previous => ({ ...target, version: snapshot.version, request: (previous?.request ?? 0) + 1 }));
      }} />
    </section>;
}
