import { useState, useSyncExternalStore, useRef, useLayoutEffect } from 'react';
import { Alert, Button, Tab, Tabs, TextField, IconButton, Tooltip } from '@mui/material';
import type { SourceWorkspace } from './workspace.ts';
import { CodeEditor } from './CodeEditor.tsx';
import { editorCache } from './editor-state.ts';
import { ProblemsPanel } from './ProblemsPanel.tsx';
import type { SourceDiagnostic } from './diagnostics.ts';
import { AssetItem, AssetPreview } from './AssetPreview.tsx';
import { sourceAssets } from './source-equality.ts';
export function SourcePanel({ workspace, readOnly, onApply, onSave, onCompositionChange, diagnosticTarget, diagnostics = [] }: {
  workspace: SourceWorkspace; readOnly: boolean; onApply(): void; onSave(): void; onCompositionChange?(value: boolean): void;
  diagnosticTarget?: { path: string; offset: number; request: number } | null;
  diagnostics?: readonly SourceDiagnostic[];
}) {
  const snapshot = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const [adding, setAdding] = useState(false);
  const [assetSelection, setAssetSelection] = useState<{ path: string; documentKey: number } | null>(null);
  const assets = sourceAssets(snapshot.source);
  const assetPath = assetSelection?.documentKey === snapshot.documentKey && Object.hasOwn(assets, assetSelection.path) ? assetSelection.path : null;
  function openCode(path: string) { setAssetSelection(null); workspace.openFile(path); }
  useLayoutEffect(() => { if (!assetPath) setAssetSelection(null); }, [assetPath]);
  useLayoutEffect(() => { if (diagnosticTarget) setAssetSelection(null); }, [diagnosticTarget]);
  const tabs = useRef<HTMLDivElement>(null), focusAfterClose = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const [newPath, setNewPath] = useState(''), [error, setError] = useState('');
  const [navigation, setNavigation] = useState<{ path: string; offset: number; request: number; version: number } | null>(null);
  const composing = useRef(false), cache = editorCache(workspace);
  cache.reconcile(snapshot.documentKey, snapshot.source);
  useLayoutEffect(() => {
    if (!focusAfterClose.current) return; focusAfterClose.current = false;
    (tabs.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? addButton.current)?.focus();
  }, [snapshot.openFiles, snapshot.selectedFile]);
  function closeFile(path: string) { focusAfterClose.current = true; workspace.closeFile(path); }
  const locked = readOnly || snapshot.busy;
  function attempt(action: () => void) { try { action(); setError(''); return true; } catch (reason) { setError(String(reason)); return false; } }
  return <section className="source-workspace" aria-label="Source workspace" onKeyDownCapture={event => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
      event.preventDefault(); event.stopPropagation();
      if (locked || workspace.getSnapshot().busy || event.repeat || composing.current || event.nativeEvent.isComposing) return;
      if (event.shiftKey) onSave(); else onApply();
    }
  }}>
    <div className="source-columns"><div className="source-files">
      <div className="source-files-heading"><span>Files</span><Tooltip title="New file"><IconButton ref={addButton} aria-label="New file" disabled={locked} onClick={() => setAdding(true)}>+</IconButton></Tooltip></div>
      <nav aria-label="Source files">{Object.keys(snapshot.source.files).map(path => <Button key={path} title={path} aria-label={`Open ${path}`} aria-current={!assetPath && snapshot.selectedFile === path ? 'page' : undefined}
        onClick={() => openCode(path)}><span className="file-path">{path}</span>{path === snapshot.source.entry && <span className="file-marker">Entry</span>}{snapshot.dirtyFiles.includes(path) && <span aria-label="Unsaved">*</span>}</Button>)}</nav>
      <div className="source-files-heading"><span>Assets</span></div>
      <nav aria-label="Image assets">{Object.keys(assets).map(path => <AssetItem key={path} path={path} asset={assets[path]!}
        selected={assetPath === path} dirty={snapshot.dirtyAssets.includes(path)}
        onSelect={() => setAssetSelection({ path, documentKey: snapshot.documentKey })} />)}</nav>
      {!Object.keys(assets).length && <p className="asset-empty">No image assets.</p>}
      {adding && <form onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setAdding(false); setNewPath(''); setError(''); addButton.current?.focus(); } }}
        onSubmit={event => { event.preventDefault(); if (!locked) {
          if (attempt(() => workspace.addFile(newPath, ''))) { setAssetSelection(null); setNewPath(''); setAdding(false); }
        } }}>
        <TextField autoFocus label="New TypeScript file" value={newPath} disabled={locked} size="small" onChange={event => setNewPath(event.target.value)} placeholder="lib/helper.ts"
          onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); } }} />
        <Button type="submit" disabled={locked}>Add file</Button>
      </form>}
      {snapshot.canUndoReplacement && <Button disabled={locked} onClick={() => workspace.undoReplacement()}>Undo source replacement</Button>}
      </div>
      <div className="source-editing"><Tabs ref={tabs} value={assetPath ? false : snapshot.selectedFile || false} onChange={(_, path: string) => openCode(path)} variant="scrollable" scrollButtons="auto" aria-label="Open source files">
        {snapshot.openFiles.map(path => <Tab key={path} value={path} title={path} label={<span className="file-tab-label"><span className="file-path">{path}{snapshot.dirtyFiles.includes(path) ? ' *' : ''}</span><span role="button" tabIndex={0} aria-label={`Close ${path}`} className="file-tab-close"
          onClick={event => { event.stopPropagation(); closeFile(path); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); closeFile(path); } }}>×</span></span>} />)}
      </Tabs>
      <div className="source-code-content" hidden={!!assetPath}>
      {snapshot.selectedFile && <>
        <CodeEditor documentKey={snapshot.documentKey} path={snapshot.selectedFile} text={snapshot.source.files[snapshot.selectedFile]!} readOnly={locked} cache={cache}
          onChange={text => attempt(() => workspace.edit(snapshot.selectedFile, text))} diagnosticTarget={diagnosticTarget ?? (navigation?.version === snapshot.version ? navigation : null)}
          onCompositionChange={value => { composing.current = value; onCompositionChange?.(value); }} /></>}
      {!snapshot.selectedFile && <p>Choose a file to edit. Closed tabs retain their drafts.</p>}
      </div>
      {assetPath && <AssetPreview path={assetPath} asset={assets[assetPath]!} />}
      </div></div>{error && <Alert severity="error">{error}</Alert>}
      <ProblemsPanel diagnostics={diagnostics} snapshot={snapshot} onNavigate={target => {
        openCode(target.path); setNavigation(previous => ({ ...target, version: snapshot.version, request: (previous?.request ?? 0) + 1 }));
      }} />
    </section>;
}
