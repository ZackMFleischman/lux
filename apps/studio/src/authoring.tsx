import { StudioMenu, StudioMenuProvider } from './StudioMenu.tsx';
import { MenuItem } from '@mui/material';
import { useEffect, useState, useMemo, useRef, useSyncExternalStore } from 'react';
import { Button, ThemeProvider } from '@mui/material';
import { StudioApp } from './renderer.tsx';
import { studioTheme } from './theme.ts';
import { getRuntimeControlState, runtimeEditSignature } from './service-client.ts';
import { StandaloneClient } from './standalone-client.ts';
import { DEFAULT_OUTPUT } from '../../../packages/runtime-contracts/src/index.ts';
import type { SourceBundle } from '../../../packages/runtime-contracts/src/index.ts';
import { dispatchRuntimeCommand } from './runtime-operations.ts';
import { createSourceWorkspace } from './source/workspace.ts';
import { createAuthoringSession } from './source/authoring-session.ts';
import { SourcePanel } from './source/SourcePanel.tsx';
import type { SourceNavigationTarget } from './source/SourcePanel.tsx';
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
import { PreviewCaptureActions, PreviewCaptureMenu } from './PreviewCaptureMenu.tsx';
import { PreviewRecorder } from './preview-recorder.ts';
import { assertAgentCaptureSize } from './preview-capture-client.ts';
import type { PreviewRecorderSnapshot } from './preview-recorder.ts';
import './preview-capture-client.ts';
import { createRendererSnapshot } from './renderer-snapshot.ts';
import { shortcutHint } from './studio-shortcuts.ts';
import type { StudioShortcutActions, StudioShortcutCommand } from './studio-shortcuts.ts';
import {createStudioAudioRuntime} from './audio/studio-audio-runtime.ts';
import {AudioInputControl} from './audio/AudioInputControl.tsx';
const audioProvider=createStudioAudioRuntime({permissions:window.luxAudioPermissions,mediaDevices:navigator.mediaDevices,
  createContext:()=>new AudioContext(),scheduler:{request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id)}});
const client = new StandaloneClient(window.luxAuthoring, { codeDeclaredParameters: true,audioProvider });
const agentStatus = () => ({ ...client.getSnapshot(), capabilities: studioCapabilities });
const idleRecording = Object.freeze({ phase: 'idle' }) as PreviewRecorderSnapshot;
const subscribeIdle = () => () => {};
const getIdleRecording = () => idleRecording;
function ShortcutLabel({ command }: { command: StudioShortcutCommand }) {
  return <span className="studio-shortcut-hint" aria-hidden="true">{shortcutHint[command]}</span>;
}
export function AuthoringApp() {
  const confirmation = useDiscardConfirmation();
  const windows = useMemo(() => window.luxStudioWindows ? { ...window.luxStudioWindows,
    popout: undefined } : undefined, []);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<SourceDiagnostic[]>([]);
  const [diagnosticTarget, setDiagnosticTarget] = useState<SourceNavigationTarget | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [looksOpen, setLooksOpen] = useState(false);
  const fileSummary = useRef<HTMLButtonElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const lookOperation = useRef(false);
  const composing = useRef(false);
  const workspace = useMemo(() => createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': '' } }), []);
  const captureRuntimeView = useMemo(() => createRendererSnapshot(client), []);
  const runtimeSnapshot = useSyncExternalStore(captureRuntimeView.subscribe, captureRuntimeView.getSnapshot, captureRuntimeView.getSnapshot);
  const previewRecorder = useMemo(() => window.luxPreviewCapture ? new PreviewRecorder(window.luxPreviewCapture, {
    onError: reason => setError(reason.message),
  }) : null, []);
  const recording = useSyncExternalStore(previewRecorder?.subscribe ?? subscribeIdle, previewRecorder?.getSnapshot ?? getIdleRecording);
  const recordingRuntime = useRef<string | null>(null);
  const session = useMemo(() => createAuthoringSession(workspace, {
    submit: (source, options) => client.submit(source, options), save: request => window.luxAuthoring.save(request), savePath: request => {if(!window.luxAuthoring.savePath)throw Error('Path save is unavailable');return window.luxAuthoring.savePath(request);}, open: () => window.luxAuthoring.open(), openPath: path => {if(!window.luxAuthoring.openPath)throw Error('Path open is unavailable');return window.luxAuthoring.openPath(path);},
    export: request => window.luxExport.create(request),
    getControls: () => ({ intensity: client.getSnapshot().authoring?.intensity ?? 0.5 }), settleControls: finishControlWrites,
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
    getOutput:()=>({...DEFAULT_OUTPUT,...client.getSnapshot().authoring?.output}),
    readLibraryComponent:(id,revision)=>window.luxLibrary.read(id,revision),
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
    if (reason instanceof SourceCompileError) {
      setError('');
      setDiagnostics(diagnosticsForSource(reason.diagnostics, submittedSource, draftVersion, workspace.getSnapshot()));
    } else {
      setDiagnostics([]);
      setDiagnosticTarget(null);
      setError(String(reason));
    }
  }
  function clearDiagnostics() { setDiagnostics([]); setDiagnosticTarget(null); }
  useEffect(() => window.luxAuthoring.onAgentCommand(async command => {
    if (lookOperation.current && !['read', 'status'].includes(command.method)) throw Error('Wait for the look operation to finish');
    if (confirmation.isPending() && !['read', 'status', 'capture','library.list','library.read'].includes(command.method)) throw Error('Studio is waiting for a user confirmation');
    if (['parameters', 'playback', 'restart'].includes(command.method)) {
      if(!session.getSnapshot().runtimeControlsAvailable)throw Error('Studio is busy with a scene file operation');
      const write = dispatchRuntimeCommand(client, command.method, command.params);
      if (command.method === 'parameters') {
        pendingControlWrites.current.add(write);
        void write.then(() => pendingControlWrites.current.delete(write), () => pendingControlWrites.current.delete(write));
      }
      return write;
    }
    if(command.method==='library.list')return window.luxLibrary.list();
    if(command.method==='library.read')return window.luxLibrary.read(command.params.id,command.params.revision);
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
      assertAgentCaptureSize(capture.bytes);
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { base64: btoa(binary), metadata: capture.metadata };
    }
    if(command.method==='scene.save'){await finishControlWrites();return session.savePath(command.params.path,command.params.expectedDraftVersion,command.params.overwrite);}
    if(command.method==='scene.open'){
      await finishControlWrites();const current=workspace.getSnapshot(),io=session.getSnapshot();
      if((current.dirty||io.controlsDirty||io.libraryDirty)&&!command.params.discardDirty)throw Error('Scene has unsaved changes; pass discardDirty:true to open another scene');
      const result=await session.openPath(command.params.path,command.params.expectedDraftVersion);setError('');setDiagnostics([]);return result;
    }
    if (command.method !== 'build' || session.getSnapshot().busy || composing.current) throw Error('Studio is busy or command is unsupported');
    const source = command.params.source as SourceBundle;
    setError('');
    try {
      if (pendingControlWrites.current.size) await finishControlWrites();
      await session.build(source, command.params?.expectedDraftVersion,command.params?.libraryLinks);
      clearDiagnostics();
      return { draftVersion: workspace.getSnapshot().version, status: agentStatus() };
    } catch (reason) { reportError(reason, command.params?.expectedDraftVersion, source); throw reason; }
  }), [session, workspace]);
  useEffect(() => window.luxConfirmation?.onCloseRequest(id => {
    void confirmation.confirm('close').then(discard => window.luxConfirmation!.reply(id, discard)).catch(reason => setError(String(reason)));
  }), [confirmation.confirm]);
  useEffect(() => { void window.luxAuthoring.dirty(dirty); }, [dirty]);
  const runtime = runtimeSnapshot.authoring;
  const audioSource=runtime?.controlAnimations?.find(binding=>binding.kind==='audio'||binding.kind==='kick')?.source;
  const audioConfiguration=audioSource?{logicalInputId:audioSource.logicalInputId,analyzer:audioSource.analyzer}:undefined;
  const runtimeKey = runtime ? `${runtime.instanceId}:${runtime.generation}:${runtime.output.width}x${runtime.output.height}` : null;
  useEffect(() => {
    if (recording.phase === 'idle' || recordingRuntime.current === runtimeKey) return;
    void previewRecorder?.stop().catch(reason => setError(String(reason))).finally(() => { recordingRuntime.current = null; });
  }, [runtimeKey, recording.phase, previewRecorder]);
  useEffect(() => () => { void previewRecorder?.cancel(); }, [previewRecorder]);
  useEffect(() => {
    const signature = () => runtimeEditSignature(client.getSnapshot().authoring);
    let value = signature();
    return client.subscribe(() => { const next = signature(); if (value !== null && next !== null && next !== value) session.controlsChanged(); value = next; });
  }, [session]);
  useEffect(() => { void window.luxAuthoring.example().then(async source => {
    // Do not overwrite a draft edited while the initial example was loading.
    if (workspace.getSnapshot().version !== 0 || session.getSnapshot().busy) return;
    workspace.replaceDocument(source);
    const smoke=await window.luxAuthoring.smokeEnabled?.()===true;
    try {
      await session.build(source, workspace.getSnapshot().version);
      clearDiagnostics();
      if(smoke){
        const initial = client.getSnapshot().authoring!;
        await client.invoke({ name: 'lux.parameters.set', input: { requestId: crypto.randomUUID(), instanceId: initial.instanceId,
          expectedGeneration: initial.generation, expectedRevisionId: initial.revisionId, expectedControlSchemaHash: initial.controlSchemaHash,
          values: { spikeHeight: 1.1 }, mode: 'live' } });
        await client.invoke({ name: 'lux.playback', input: { requestId: crypto.randomUUID(), instanceId: initial.instanceId, expectedGeneration: initial.generation, action: 'pause' } });
        await client.invoke({ name: 'lux.playback', input: { requestId: crypto.randomUUID(), instanceId: initial.instanceId, expectedGeneration: initial.generation, action: 'reset' } });
        const applied = client.getSnapshot().authoring!;
        if (getRuntimeControlState(applied).controls.spikeHeight !== 1.1 || applied.playback !== 'paused' || applied.clockEpoch !== 1) throw Error('Applied control/playback/reset mismatch');
        let invalidRejected = false;
        try { await client.submit({ ...source, files: { [source.entry]: 'this is not valid TypeScript !!' } }); } catch { invalidRejected = true; }
        if (!invalidRejected || client.getSnapshot().authoring?.revisionId !== initial.revisionId) throw Error('Failed source changed active visual');
        const capture = await client.capture();
        const saved = client.acceptedDocument();
        const roundtrip = await window.luxAuthoring.smokeSave(saved);
        if (roundtrip.document.source.entry !== source.entry || roundtrip.document.source.sdkVersion !== source.sdkVersion ||
            roundtrip.document.source.files[source.entry] !== source.files[source.entry] || JSON.stringify(roundtrip.document.controls) !== JSON.stringify(saved.controls)) throw Error('Save/reopen did not preserve the visual');
        await new Promise(resolve => setTimeout(resolve, 500));
        await window.luxAuthoring.smokeResult?.({ ok: true, initial, applied, invalidRejected, capture, savedAndReopened: true });
      }
    } catch (error) { reportError(error,workspace.getSnapshot().version,source);if(smoke)await window.luxAuthoring.smokeResult?.({ ok: false, error: String(error), snapshot: client.getSnapshot() }); }
  }).catch(reason => setError(String(reason))); }, [session, workspace]);
  async function build() { if (composing.current || session.getSnapshot().busy || workspace.getSnapshot().busy) return; setError(''); const current = session.read();
    try { if (pendingControlWrites.current.size) await finishControlWrites(); await session.build(current.source, current.draftVersion); clearDiagnostics(); } catch (reason) { reportError(reason, current.draftVersion, current.source); } }
  async function save(saveAs = false) {
    if (composing.current || session.getSnapshot().busy || workspace.getSnapshot().busy) return;
    setError('');
    try { if (pendingControlWrites.current.size) await finishControlWrites(); await session.save(saveAs); } catch (reason) { setError(String(reason)); }
  }
  async function open() {
    if (dirty && !await confirmation.confirm('open')) return;
    setError('');
    try { if (await session.open()) clearDiagnostics(); } catch (reason) { const current = workspace.getSnapshot(); reportError(reason, current.version, current.source); }
  }
  async function savePreviewFrame() {
    const captureApi = window.luxPreviewCapture, target = client.getSnapshot().authoring;
    if (!captureApi || !target || target.playback === 'failed') throw Error('A working preview is required');
    setError('');
    try {
      const capture = await client.capture(), metadata = capture.metadata;
      if (metadata.instanceId !== target.instanceId || metadata.generation !== target.generation ||
          metadata.width !== target.output.width || metadata.height !== target.output.height) throw Error('Preview changed before the frame could be saved');
      await captureApi.saveFrame(capture.bytes);
    } catch (reason) { setError(String(reason)); }
  }
  async function startPreviewRecording() {
    const target = client.getSnapshot().authoring;
    if (!previewRecorder || !target || target.playback === 'failed') { setError('A working preview is required'); return; }
    const canvas = document.querySelector<HTMLCanvasElement>('.preview-surface canvas');
    if (!canvas) { setError('Preview output canvas is unavailable'); return; }
    setError('');
    const targetKey = `${target.instanceId}:${target.generation}:${target.output.width}x${target.output.height}`;
    // Publish can synchronously render the recording state. Install its identity
    // guard first so that render cannot mistake startup for runtime replacement.
    recordingRuntime.current = targetKey;
    try {
      if (!await previewRecorder.start(canvas, target.output, () => {
        const current = client.getSnapshot().authoring;
        return !!current && current.playback !== 'failed' &&
          `${current.instanceId}:${current.generation}:${current.output.width}x${current.output.height}` === targetKey &&
          document.querySelector<HTMLCanvasElement>('.preview-surface canvas') === canvas;
      })) recordingRuntime.current = null;
    } catch (reason) { recordingRuntime.current = null; setError(String(reason)); }
  }
  async function stopPreviewRecording() {
    setError('');
    try { await previewRecorder?.stop(); }
    catch (reason) { setError(String(reason)); }
    finally { recordingRuntime.current = null; }
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
      await session.loadLook(id); clearDiagnostics(); setError(''); return true;
    });
  }
  const previewAvailable = !!previewRecorder && !!runtimeSnapshot.authoring && runtimeSnapshot.authoring.playback !== 'failed';
  const exportUnavailable = window.luxExport?.unavailableReason;
  const shortcutActions: StudioShortcutActions = {
    build: { run: build, disabled: busy },
    save: { run: save, disabled: busy },
    'save-as': { run: () => save(true), disabled: busy },
    export: { run: () => setExportOpen(true), disabled: busy || composing.current || !!exportUnavailable, disabledReason: exportUnavailable },
    'save-frame': { run: savePreviewFrame, disabled: !previewAvailable || recording.phase !== 'idle' },
    'toggle-recording': { run: recording.phase === 'idle' ? startPreviewRecording : stopPreviewRecording, disabled: !previewAvailable || recording.phase === 'stopping' },
  };
  const fileMenu = <>
    <StudioMenu label="File" buttonRef={fileSummary} className="file-tools">
      <MenuItem disabled={busy} onClick={() => void open()}>Open</MenuItem>
      <MenuItem disabled={shortcutActions.save!.disabled} onClick={() => void shortcutActions.save!.run()}><span>Save</span><ShortcutLabel command="save" /></MenuItem>
      <MenuItem disabled={shortcutActions['save-as']!.disabled} onClick={() => void shortcutActions['save-as']!.run()}><span>Save as</span><ShortcutLabel command="save-as" /></MenuItem>
      <MenuItem disabled={busy} onClick={() => setLooksOpen(true)}>Looks…</MenuItem>
      <MenuItem disabled={shortcutActions.export!.disabled} title={shortcutActions.export!.disabledReason} onClick={() => void shortcutActions.export!.run()}>
        <span>Export for Resolume{exportUnavailable ? ' (not included)' : ''}</span><ShortcutLabel command="export" /></MenuItem>
    </StudioMenu>
  </>;
  const commands = <>
    <PreviewCaptureMenu available={previewAvailable} status={recording}
      onSaveFrame={savePreviewFrame} onStart={startPreviewRecording} onStop={stopPreviewRecording} />
    <AudioInputControl provider={audioProvider} onError={setError} configuration={audioConfiguration}/>
    <span className="document-name" title={io.name}><span className="document-label">Scene</span><span className="document-title">{io.name}</span>{dirty && <span aria-label="Unsaved changes"> *</span>}</span>
    <Button className="studio-build-button" variant="outlined" color="inherit" disabled={busy} aria-label="Build" aria-busy={busy} title={`Build preview (${shortcutHint.build})`} onClick={() => void shortcutActions.build!.run()}>
      {busy && <span className="status-spinner" aria-hidden="true" />}Build
    </Button>
  </>;
  const links=session.read().libraryLinks;
  const libraryPanel=<LibraryPanel client={window.luxLibrary} links={links} updates={io.libraryUpdates} fallbacks={io.libraryFallbacks} refreshKey={libraryVersion}
    onApplyUpdates={async()=>{setError('');try{await session.applyLibraryUpdates();clearDiagnostics();}catch(reason){setError(String(reason));throw reason;}}}
    onFork={id=>{try{session.forkLibraryComponent(id);}catch(reason){setError(String(reason));}}} onError={reason=>setError(String(reason))}/>;
  return <ThemeProvider theme={studioTheme}><StudioMenuProvider><div className="authoring-shell">
    {confirmation.dialog}
    <ExportDialog disabled={busy || composing.current} open={exportOpen} onClose={() => setExportOpen(false)} onClosed={() => fileSummary.current?.focus()} defaultName={io.name} create={async name => { if (pendingControlWrites.current.size) await finishControlWrites(); return session.exportSource(name); }} />
    <LooksDialog open={looksOpen} onClose={() => setLooksOpen(false)} onClosed={() => fileSummary.current?.focus()} client={window.luxLooks} onSave={saveLook} onLoad={loadLook} />
    <StudioApp client={client} presentation={client} windows={windows} fileMenu={fileMenu} shortcutActions={shortcutActions} previewActions={<PreviewCaptureActions available={previewAvailable} status={recording}
      onSaveFrame={savePreviewFrame} onStart={startPreviewRecording} onStop={stopPreviewRecording} />} sourceChanged={draft.hasRunningSource && !draft.runningMatchesDraft} appCommands={commands} appError={error} controlEdits={controlEdits} controlsAvailable={io.runtimeControlsAvailable} libraryPanel={libraryPanel}
      sourceDiagnostics={{ items: diagnostics, snapshot: draft, onNavigate: target => setDiagnosticTarget(previous => ({ ...target, request: (previous?.request ?? 0) + 1, documentKey: draft.documentKey, draftVersion: draft.version })) }}
      sourcePanel={<SourcePanel workspace={workspace} readOnly={busy} onApply={() => void shortcutActions.build!.run()} onCompositionChange={value => { composing.current = value; }} diagnosticTarget={diagnosticTarget}
        onDiagnosticTargetHandled={request => setDiagnosticTarget(current => current?.request === request ? null : current)} />} />
  </div></StudioMenuProvider></ThemeProvider>;
}
