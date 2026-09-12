import { useEffect, useState, useMemo, useRef, useSyncExternalStore } from 'react';
import { Button, ThemeProvider } from '@mui/material';
import { StudioApp } from './renderer.tsx';
import { studioTheme } from './theme.ts';
import { StandaloneClient } from './standalone-client.ts';
import { DEFAULT_OUTPUT } from '../../../packages/runtime-contracts/src/index.ts';
import { createSceneDocument } from '../../../packages/core/src/scene-document.ts';
import type { SourceBundle } from '../../../packages/runtime-contracts/src/index.ts';
import { dispatchRuntimeCommand } from './runtime-operations.ts';
import { createSourceWorkspace } from './source/workspace.ts';
import { createAuthoringSession } from './source/authoring-session.ts';
import { SourcePanel } from './source/SourcePanel.tsx';
import { SourceCompileError, diagnosticsForSource } from './source/diagnostics.ts';
import type { SourceDiagnostic } from './source/diagnostics.ts';
import { ExportDialog } from './ExportDialog.tsx';
import './export-client.ts';
const client = new StandaloneClient(window.luxAuthoring);
export function AuthoringApp() {
  const windows = useMemo(() => window.luxStudioWindows ? { ...window.luxStudioWindows,
    popout: undefined } : undefined, []);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<SourceDiagnostic[]>([]);
  const composing = useRef(false);
  const workspace = useMemo(() => createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': '' } }), []);
  const session = useMemo(() => createAuthoringSession(workspace, {
    submit: source => client.submit(source), save: request => window.luxAuthoring.save(request), open: () => window.luxAuthoring.open(),
    export: request => window.luxExport.create(request),
    getControls: () => ({ intensity: client.getSnapshot().authoring?.intensity ?? 0.5 }),
    applyControls: async controls => { const runtime = client.getSnapshot().authoring!;
      await client.invoke({ name: 'lux.parameters.set', input: { requestId: crypto.randomUUID(), instanceId: runtime.instanceId,
        expectedGeneration: runtime.generation, expectedRevisionId: runtime.revisionId, values: controls, mode: 'live' } }); },
  }), [workspace]);
  const draft = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const io = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const busy = io.busy || draft.busy, dirty = draft.dirty || io.controlsDirty;
  function reportError(reason: unknown, draftVersion: number, submittedSource: SourceBundle) {
    setError(String(reason));
    if (reason instanceof SourceCompileError) setDiagnostics(diagnosticsForSource(reason.diagnostics, submittedSource, draftVersion, workspace.getSnapshot()));
  }
  useEffect(() => window.luxAuthoring.onAgentCommand(async command => {
    if (['parameters', 'playback', 'restart'].includes(command.method)) return dispatchRuntimeCommand(client, command.method, command.params);
    if (command.method === 'status') return client.getSnapshot();
    if (command.method === 'read') return { ...session.read(), status: client.getSnapshot() };
    if (command.method === 'capture') {
      const capture = await client.capture(), bytes = new Uint8Array(capture.bytes);
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { base64: btoa(binary), metadata: capture.metadata };
    }
    if (command.method !== 'build' || session.getSnapshot().busy || composing.current) throw Error('Studio is busy or command is unsupported');
    const source = command.params.source as SourceBundle;
    setError('');
    try {
      await session.build(source, command.params?.expectedDraftVersion);
      return { draftVersion: workspace.getSnapshot().version, status: client.getSnapshot() };
    } catch (reason) { reportError(reason, command.params?.expectedDraftVersion, source); throw reason; }
  }), [session, workspace]);
  useEffect(() => { void window.luxAuthoring.dirty(dirty); }, [dirty]);
  useEffect(() => {
    let value = client.getSnapshot().authoring?.intensity;
    return client.subscribe(() => { const next = client.getSnapshot().authoring?.intensity; if (value !== undefined && next !== undefined && next !== value) session.controlsChanged(); value = next; });
  }, [session]);
  useEffect(() => { void window.luxAuthoring.example().then(async source => {
    // Do not overwrite a draft edited while the initial example was loading.
    if (workspace.getSnapshot().version !== 0 || session.getSnapshot().busy) return;
    workspace.replaceDocument(source);
    if (await window.luxAuthoring.smokeEnabled?.()) {
      try {
        await session.build(source, workspace.getSnapshot().version);
        const initial = client.getSnapshot().authoring!;
        await client.invoke({ name: 'lux.parameters.set', input: { requestId: crypto.randomUUID(), instanceId: initial.instanceId,
          expectedGeneration: initial.generation, expectedRevisionId: initial.revisionId, values: { intensity: 0.8 }, mode: 'live' } });
        await client.invoke({ name: 'lux.playback', input: { requestId: crypto.randomUUID(), instanceId: initial.instanceId, expectedGeneration: initial.generation, action: 'pause' } });
        await client.invoke({ name: 'lux.playback', input: { requestId: crypto.randomUUID(), instanceId: initial.instanceId, expectedGeneration: initial.generation, action: 'reset' } });
        const applied = client.getSnapshot().authoring!;
        if (applied.intensity !== 0.8 || applied.playback !== 'paused' || applied.clockEpoch !== 1) throw Error('Applied control/playback/reset mismatch');
        let invalidRejected = false;
        try { await client.submit({ ...source, files: { [source.entry]: 'this is not valid TypeScript !!' } }); } catch { invalidRejected = true; }
        if (!invalidRejected || client.getSnapshot().authoring?.revisionId !== initial.revisionId) throw Error('Failed source changed active visual');
        const capture = await client.capture();
        const roundtrip = await window.luxAuthoring.smokeSave(createSceneDocument(source, DEFAULT_OUTPUT, { intensity: applied.intensity }));
        if (roundtrip.document.source.entry !== source.entry || roundtrip.document.source.sdkVersion !== source.sdkVersion ||
            roundtrip.document.source.files[source.entry] !== source.files[source.entry] || roundtrip.document.controls.intensity !== 0.8) throw Error('Save/reopen did not preserve the visual');
        await new Promise(resolve => setTimeout(resolve, 500));
        await window.luxAuthoring.smokeResult?.({ ok: true, initial, applied, invalidRejected, capture, savedAndReopened: true });
      } catch (error) { setError(String(error)); await window.luxAuthoring.smokeResult?.({ ok: false, error: String(error), snapshot: client.getSnapshot() }); }
    }
  }).catch(reason => setError(String(reason))); }, [session, workspace]);
  async function build() { if (composing.current) return; setError(''); const current = session.read();
    try { await session.build(current.source, current.draftVersion); setDiagnostics([]); } catch (reason) { reportError(reason, current.draftVersion, current.source); } }
  async function save(saveAs = false) {
    if (composing.current) return;
    setError('');
    try { await session.save(saveAs); } catch (reason) { setError(String(reason)); }
  }
  async function open() {
    if (dirty && !window.confirm('Discard unsaved changes and open another visual?')) return;
    setError('');
    try { await session.open(); setDiagnostics([]); } catch (reason) { const current = workspace.getSnapshot(); reportError(reason, current.version, current.source); }
  }
  const fileMenu = <details className="file-tools" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary>File</summary><div className="file-tools-content" onClick={event => { if ((event.target as Element).closest('button')) event.currentTarget.closest('details')!.open = false; }}>
      <Button disabled={busy} onClick={() => void open()}>Open</Button><Button disabled={busy} onClick={() => void save()}>Save</Button><Button disabled={busy} onClick={() => void save(true)}>Save as</Button>
      <ExportDialog disabled={busy || composing.current} defaultName={io.name} create={name => session.exportSource(name)} />
    </div></details>;
  const commands = <>
    <span className="document-name" title={io.name}>{io.name}{dirty ? ' *' : ''}</span>
    <Button variant="contained" disabled={busy} onClick={() => void build()}>Build</Button>
    <span className="build-status" role="status">{draft.runningMatchesDraft ? 'Preview current' : draft.hasRunningSource ? 'Preview shows previous source' : 'Not built'}</span>
  </>;
  return <ThemeProvider theme={studioTheme}><div className="authoring-shell">
    <StudioApp client={client} presentation={client} windows={windows} fileMenu={fileMenu} appCommands={commands} appError={error}
      sourcePanel={<SourcePanel workspace={workspace} readOnly={busy} onSave={() => void save()} onCompositionChange={value => { composing.current = value; }} diagnostics={diagnostics} />} />
  </div></ThemeProvider>;
}
