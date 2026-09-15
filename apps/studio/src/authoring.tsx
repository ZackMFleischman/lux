import { StudioMenu, StudioMenuProvider } from './StudioMenu.tsx';
import { MenuItem } from '@mui/material';
import { useEffect, useState, useMemo, useRef, useSyncExternalStore } from 'react';
import { Button, ThemeProvider } from '@mui/material';
import { StudioApp } from './renderer.tsx';
import { studioTheme } from './theme.ts';
import { getRuntimeControlState, runtimeEditSignature } from './service-client.ts';
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
import { studioCapabilities } from './capabilities.ts';
import { useDiscardConfirmation } from './Confirmation.tsx';
import { LibraryPanel } from './library/LibraryPanel.tsx';
import { completeLibraryMutation } from './library/library-mutation.ts';
import './library-client.ts';
import './look-client.ts';
import { LooksDialog } from './LooksDialog.tsx';
const client = new StandaloneClient(window.luxAuthoring, { codeDeclaredParameters: true });
const agentStatus = () => ({ ...client.getSnapshot(), capabilities: studioCapabilities });
export function AuthoringApp() {
  const confirmation = useDiscardConfirmation();
  const windows = useMemo(() => window.luxStudioWindows ? { ...window.luxStudioWindows,
    popout: undefined } : undefined, []);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<SourceDiagnostic[]>([]);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [looksOpen, setLooksOpen] = useState(false);
  const fileSummary = useRef<HTMLButtonElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const lookOperation = useRef(false);
  const composing = useRef(false);
  const workspace = useMemo(() => createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': '' } }), []);
  const session = useMemo(() => createAuthoringSession(workspace, {
    submit: (source, options) => client.submit(source, options), save: request => window.luxAuthoring.save(request), savePath: request => window.luxAuthoring.savePath(request), open: () => window.luxAuthoring.open(), openPath: path => window.luxAuthoring.openPath(path),
    export: request => window.luxExport.create(request),
    getControls: () => ({ intensity: client.getSnapshot().authoring?.intensity ?? 0.5 }),
    getControlSnapshot: () => {
      const runtime = client.getSnapshot().authoring;
      if (!runtime) return null;
      const state = getRuntimeControlState(runtime);
      if(state.sdkVersion==='0.4.0'){
        if(!state.nodeControls)throw Error('Composition controls are unavailable');
        return {sourceHash:runtime.revisionId,nodes:state.nodeControls.nodes};
      }
      return { sourceHash: runtime.revisionId, schema: state.controlSchema, schemaHash: state.controlSchemaHash, values: state.controls };
    },
    getControlAnimations:()=>client.getSnapshot().authoring?.controlAnimations??[],
    readLibraryComponent:id=>window.luxLibrary.read(id),
    acceptedDocument: () => client.acceptedDocument(),
    saveLook: request => window.luxLooks.save(request),
    readLook: id => window.luxLooks.read(id),
    lookThumbnail: captureLookThumbnail,
  }), [workspace]);
  const pendingControlWrites = useRef(new Set<Promise<unknown>>());
  const controlEdits = useMemo(() => ({ changed: () => session.controlsChanged(), track: (write: Promise<unknown>) => {
    pendingControlWrites.current.add(write);
    void write.then(() => pendingControlWrites.current.delete(write), () => pendingControlWrites.current.delete(write));
  } }), [session]);
  async function finishControlWrites() { while (pendingControlWrites.current.size) await Promise.all([...pendingControlWrites.current]); }
  const draft = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const io = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const busy = io.busy || draft.busy, dirty = draft.dirty || io.controlsDirty || io.libraryDirty;
  function reportError(reason: unknown, draftVersion: number, submittedSource: SourceBundle) {
    setError(String(reason));
    if (reason instanceof SourceCompileError) setDiagnostics(diagnosticsForSource(reason.diagnostics, submittedSource, draftVersion, workspace.getSnapshot()));
  }
  useEffect(() => window.luxAuthoring.onAgentCommand(async command => {
    if (lookOperation.current && !['read', 'status'].includes(command.method)) throw Error('Wait for the look operation to finish');
    if (confirmation.isPending() && !['read', 'status', 'capture','library.list','library.read'].includes(command.method)) throw Error('Studio is waiting for a user confirmation');
    if (['parameters', 'playback', 'restart'].includes(command.method)) {
      const write = dispatchRuntimeCommand(client, command.method, command.params);
      if (command.method === 'parameters') {
        pendingControlWrites.current.add(write);
        void write.then(() => pendingControlWrites.current.delete(write), () => pendingControlWrites.current.delete(write));
      }
      return write;
    }
    if(command.method==='library.list')return window.luxLibrary.list();
    if(command.method==='library.read')return window.luxLibrary.read(command.params.id);
    if(command.method==='library.create'||command.method==='library.update'){
      const result=await completeLibraryMutation(
        ()=>command.method==='library.create'?window.luxLibrary.create(command.params):window.luxLibrary.update(command.params),
        ()=>session.checkLibraryUpdates(),reason=>setError(String(reason)));
      setLibraryVersion(value=>value+1);return result;
    }
    if (command.method === 'status') return agentStatus();
    if (command.method === 'read') return { ...session.read(), status: agentStatus() };
    if (command.method === 'capture') {
      const capture = await client.capture(), bytes = new Uint8Array(capture.bytes);
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { base64: btoa(binary), metadata: capture.metadata };
    }
    if(command.method==='scene.save')return session.savePath(command.params.path,command.params.expectedDraftVersion,command.params.overwrite);
    if(command.method==='scene.open'){
      const current=workspace.getSnapshot(),io=session.getSnapshot();
      if((current.dirty||io.controlsDirty||io.libraryDirty)&&!command.params.discardDirty)throw Error('Scene has unsaved changes; pass discardDirty:true to open another scene');
      return session.openPath(command.params.path,command.params.expectedDraftVersion);
    }
    if (command.method !== 'build' || session.getSnapshot().busy || composing.current) throw Error('Studio is busy or command is unsupported');
    const source = command.params.source as SourceBundle;
    setError('');
    try {
      if (pendingControlWrites.current.size) await finishControlWrites();
      await session.build(source, command.params?.expectedDraftVersion,command.params?.libraryLinks);
      return { draftVersion: workspace.getSnapshot().version, status: agentStatus() };
    } catch (reason) { reportError(reason, command.params?.expectedDraftVersion, source); throw reason; }
  }), [session, workspace]);
  useEffect(() => window.luxConfirmation?.onCloseRequest(id => {
    void confirmation.confirm('close').then(discard => window.luxConfirmation!.reply(id, discard)).catch(reason => setError(String(reason)));
  }), [confirmation.confirm]);
  useEffect(() => { void window.luxAuthoring.dirty(dirty); }, [dirty]);
  useEffect(() => {
    const signature = () => runtimeEditSignature(client.getSnapshot().authoring);
    let value = signature();
    return client.subscribe(() => { const next = signature(); if (value !== null && next !== null && next !== value) session.controlsChanged(); value = next; });
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
            roundtrip.document.source.files[source.entry] !== source.files[source.entry] || ('intensity' in roundtrip.document.controls ? roundtrip.document.controls.intensity : undefined) !== 0.8) throw Error('Save/reopen did not preserve the visual');
        await new Promise(resolve => setTimeout(resolve, 500));
        await window.luxAuthoring.smokeResult?.({ ok: true, initial, applied, invalidRejected, capture, savedAndReopened: true });
      } catch (error) { setError(String(error)); await window.luxAuthoring.smokeResult?.({ ok: false, error: String(error), snapshot: client.getSnapshot() }); }
    }
  }).catch(reason => setError(String(reason))); }, [session, workspace]);
  async function build() { if (composing.current || session.getSnapshot().busy || workspace.getSnapshot().busy) return; setError(''); const current = session.read();
    try { if (pendingControlWrites.current.size) await finishControlWrites(); await session.build(current.source, current.draftVersion); setDiagnostics([]); } catch (reason) { reportError(reason, current.draftVersion, current.source); } }
  async function save(saveAs = false) {
    if (composing.current || session.getSnapshot().busy || workspace.getSnapshot().busy) return;
    setError('');
    try { if (pendingControlWrites.current.size) await finishControlWrites(); await session.save(saveAs); } catch (reason) { setError(String(reason)); }
  }
  async function open() {
    if (dirty && !await confirmation.confirm('open')) return;
    setError('');
    try { await session.open(); setDiagnostics([]); } catch (reason) { const current = workspace.getSnapshot(); reportError(reason, current.version, current.source); }
  }
  async function withLookOperation<T>(operation: () => Promise<T>) {
    if (lookOperation.current || session.getSnapshot().busy || workspace.getSnapshot().busy) throw Error('Studio is busy');
    lookOperation.current = true;
    try { await finishControlWrites(); return await operation(); }
    finally { lookOperation.current = false; }
  }
  async function captureLookThumbnail(documentSnapshot: ReturnType<typeof client.acceptedDocument>) {
    const runtime = client.getSnapshot().authoring!;
    const capture = await client.capture();
    const after = client.getSnapshot().authoring;
    if (after?.instanceId !== runtime.instanceId || after.generation !== runtime.generation ||
        capture.metadata.controlSequence !== (runtime.controlSequence ?? 0) ||
        (capture.metadata.animationSequence ?? 0) !== (runtime.animationSequence ?? 0) ||
        JSON.stringify(client.acceptedDocument()) !== JSON.stringify(documentSnapshot)) return undefined;
    const bitmap = await createImageBitmap(new Blob([capture.bytes], {type: 'image/png'}));
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(256 / bitmap.width, 144 / bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/png');
      return data.length <= 350000 ? data : undefined;
    } finally { bitmap.close(); }
  }
  async function saveLook(name: string, selected?: {id: string; revision: number}) {
    return withLookOperation(async () => {
      const look = await session.saveLook(name, selected);
      return {look, thumbnail: !!look.thumbnail};
    });
  }
  async function loadLook(id: string) {
    return withLookOperation(async () => {
      const current = session.getSnapshot();
      if ((workspace.getSnapshot().dirty || current.controlsDirty || current.libraryDirty) && !await confirmation.confirm('load-look')) return false;
      await session.loadLook(id); setDiagnostics([]); setError(''); return true;
    });
  }
  const fileMenu = <StudioMenu label="File" buttonRef={fileSummary} className="file-tools">
    <MenuItem disabled={busy} onClick={() => void open()}>Open</MenuItem>
    <MenuItem disabled={busy} onClick={() => void save()}>Save</MenuItem>
    <MenuItem disabled={busy} onClick={() => void save(true)}>Save as</MenuItem>
    <MenuItem disabled={busy} onClick={() => setLooksOpen(true)}>Looks…</MenuItem>
    <MenuItem disabled={busy || composing.current || !!window.luxExport?.unavailableReason} title={window.luxExport?.unavailableReason} onClick={() => setExportOpen(true)}>
      Export for Resolume{window.luxExport?.unavailableReason ? ' (not included)' : ''}</MenuItem>
  </StudioMenu>;
  const commands = <>
    <span className="document-name" title={io.name}><span className="document-label">Scene</span><span className="document-title">{io.name}</span>{dirty && <span aria-label="Unsaved changes"> *</span>}</span>
    <Button className="studio-build-button" variant="outlined" color="inherit" disabled={busy} aria-label="Build" aria-busy={busy} title="Build preview (Ctrl/Cmd+S in source)" onClick={() => void build()}>
      {busy && <span className="status-spinner" aria-hidden="true" />}Build
    </Button>
  </>;
  const links=session.read().libraryLinks;
  const libraryPanel=<LibraryPanel client={window.luxLibrary} links={links} updates={io.libraryUpdates} fallbacks={io.libraryFallbacks} refreshKey={libraryVersion}
    onApplyUpdates={async()=>{setError('');try{await session.applyLibraryUpdates();setDiagnostics([]);}catch(reason){setError(String(reason));throw reason;}}}
    onFork={id=>{try{session.forkLibraryComponent(id);}catch(reason){setError(String(reason));}}} onError={reason=>setError(String(reason))}/>;
  return <ThemeProvider theme={studioTheme}><StudioMenuProvider><div className="authoring-shell">
    {confirmation.dialog}
    <ExportDialog disabled={busy || composing.current} open={exportOpen} onClose={() => setExportOpen(false)} onClosed={() => fileSummary.current?.focus()} defaultName={io.name} create={async name => { if (pendingControlWrites.current.size) await finishControlWrites(); return session.exportSource(name); }} />
    <LooksDialog open={looksOpen} onClose={() => setLooksOpen(false)} onClosed={() => fileSummary.current?.focus()} client={window.luxLooks} onSave={saveLook} onLoad={loadLook} />
    <StudioApp client={client} presentation={client} windows={windows} fileMenu={fileMenu} sourceChanged={draft.hasRunningSource && !draft.runningMatchesDraft} appCommands={commands} appError={error} controlEdits={controlEdits} libraryPanel={libraryPanel}
      sourcePanel={<SourcePanel workspace={workspace} readOnly={busy} onApply={() => void build()} onSave={() => void save()} onCompositionChange={value => { composing.current = value; }} diagnostics={diagnostics} />} />
  </div></StudioMenuProvider></ThemeProvider>;
}
