import { InspectorBreadcrumb } from './InspectorBreadcrumb.tsx';
import {GraphPanel,compositionNodeLabel,compositionOccurrence,nodeKey} from './GraphPanel.tsx';
import {visualSelection} from './visual-model.ts';
import type {NodePath} from '../../../packages/runtime-contracts/src/graph.ts';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Button, Chip, CssBaseline, Paper, ThemeProvider, IconButton, Tooltip, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,TextField } from '@mui/material';
import { studioTheme } from './theme.ts';
import { ParameterInspector, parameterOwner } from './controls/ParameterInspector.tsx';
import type { ControlEdits } from './controls/ParameterInspector.tsx';
import { PerformanceStatus } from './performance/PerformanceStatus.tsx';
import { Preview } from './preview.tsx';
import {StoryPanel,storyStatusLabel} from './story/StoryPanel.tsx';
import { StudioController } from './service-client.ts';
import type { ReactNode } from 'react';
import { StudioDockShell } from './layout/StudioDockShell.tsx';
import type { StudioPanelKind } from './layout/StudioDockShell.tsx';
import type { StudioClient, StudioSnapshot, Metric } from './service-client.ts';
import type { PresentationPort } from './presentation.ts';
import type { StudioWindowClient, WindowState } from './window-client.ts';
import { createRendererSnapshot } from './renderer-snapshot.ts';
import { Disclosure } from './Disclosure.tsx';
import { ProblemsPanel } from './source/ProblemsPanel.tsx';
import type { SourceDiagnostic } from './source/diagnostics.ts';
import type { SourceSnapshot } from './source/workspace.ts';
import { blocksTextEntry, isTextEntryTarget, shortcutCommand, shortcutHint, shortcutReference } from './studio-shortcuts.ts';
import type { StudioShortcutActions } from './studio-shortcuts.ts';

type SourceDiagnosticsView = {
  items: readonly SourceDiagnostic[];
  snapshot: SourceSnapshot;
  visualSnapshots?:Readonly<Record<string,SourceSnapshot>>;
  onNavigate(target: { path: string; offset: number;visualId?:string }): void;
};

export function metricText(metric: Metric | null, nowMs: number): { value: string; detail: string } {
  if (!metric || !Number.isFinite(metric.value) || metric.value < 0 || !Number.isFinite(metric.sampledAtMs) ||
      !Number.isFinite(metric.coverage) || metric.coverage <= 0 || metric.coverage > 1 || metric.sampledAtMs > nowMs) {
    return { value: 'Unavailable', detail: 'No observed samples' };
  }
  const age = nowMs - metric.sampledAtMs;
  return { value: `${metric.value.toFixed(1)} fps`, detail: `${age > 2000 ? 'Stale · ' : ''}${Math.round(metric.coverage * 100)}% coverage · ${(age / 1000).toFixed(1)}s ago` };
}
function MetricView({ label, metric, nowMs }: { label: string; metric: Metric | null; nowMs: number }) {
  const text = metricText(metric, nowMs);
  return <div className="metric"><span>{label}</span><strong>{text.value}</strong><small>{text.detail}</small></div>;
}
export type StudioProps = {
  controlEdits?: ControlEdits;
  client: StudioClient; presentation?: PresentationPort; windows?: StudioWindowClient; previewOnly?: boolean; nowMs?: number; sourcePanel?: ReactNode; sourceDiagnostics?: SourceDiagnosticsView; libraryPanel?:ReactNode; appCommands?: ReactNode; fileMenu?: ReactNode; previewActions?: ReactNode; shortcutActions?: StudioShortcutActions; appError?: string; sourceChanged?: boolean; controlsAvailable?: boolean;selectedVisualId?:string;
};
export function StudioApp(props: StudioProps) {
  return <ThemeProvider theme={studioTheme}><CssBaseline /><StudioLayout {...props} /></ThemeProvider>;
}
function controlOwner(snapshot: StudioSnapshot): string | null {
  const runtime = snapshot.authoring;
  return snapshot.connection === 'connected' && runtime?.authority === 'studio'
    ? parameterOwner(runtime) : null;
}
const activeJobStates = new Set(['queued', 'pending', 'running', 'compiling', 'initializing']);
function sentenceCase(value: string): string { return value ? value[0]!.toUpperCase() + value.slice(1) : value; }
function sourceDiagnosticFault(fault: string | undefined, sourceDiagnostics: readonly SourceDiagnostic[]): boolean {
  return !!fault && fault.includes('SourceCompileError:') && sourceDiagnostics.length > 0 &&
    sourceDiagnostics.every(diagnostic => fault.includes(diagnostic.message));
}
export function studioStatus(snapshot: StudioSnapshot, sourceProblemCount = 0): { build: string; building: boolean; problems: number; runtime: string } {
  const jobs = [...snapshot.jobs];
  const latest = jobs.at(-1), active = jobs.findLast(job => activeJobStates.has(job.state.toLowerCase()));
  const build = active?.summary ?? (latest?.state.toLowerCase() === 'failed' ? 'Build failed'
    : latest?.state.toLowerCase() === 'succeeded' ? 'Build ready' : 'Build idle');
  const problems = sourceProblemCount + (snapshot.authoring?.fault ? 1 : 0) +
    jobs.filter(job => !!job.fault || job.state.toLowerCase() === 'failed').length;
  const runtime = snapshot.connection === 'connecting' ? 'Connecting' : snapshot.connection !== 'connected' ? 'Disconnected'
    : snapshot.authoring?.fault || snapshot.authoring?.playback === 'failed' ? 'Failed'
    : snapshot.authoring ? sentenceCase(snapshot.authoring.playback) : 'No runtime';
  return { build, building: !!active, problems, runtime };
}
function StudioLayout({ client, presentation, windows, previewOnly = false, nowMs, sourcePanel,sourceDiagnostics,libraryPanel, appCommands, fileMenu, previewActions, shortcutActions, appError, controlEdits, sourceChanged, controlsAvailable,selectedVisualId }: StudioProps) {
  const [toolsHost, setToolsHost] = useState<HTMLElement | null>(null);
  const [transportMenu, setTransportMenu] = useState<HTMLElement | null>(null);
  const view = useMemo(() => createRendererSnapshot(client), [client]);
  const snapshot = useSyncExternalStore(view.subscribe, view.getSnapshot, view.getSnapshot);
  const owner = controlOwner(snapshot);
  // A rejected old-target write must not discard a new runtime's queued input.
  const controller = useMemo(() => new StudioController(client), [client, owner]);
  const [windowState, setWindowState] = useState<WindowState>({ detached: false, fullscreen: false });
  const [focusedPanel, setFocusedPanel] = useState<StudioPanelKind>('preview');
  const [maximizedPanel, setMaximizedPanel] = useState<StudioPanelKind | null>(null);
  const [maximizedInspector, setMaximizedInspector] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pendingCommands, setPendingCommands] = useState(0);
  const transportPending = useRef(false);
  const jobsRef = useRef<HTMLElement>(null), openPanelRef = useRef<null | ((kind: StudioPanelKind) => void)>(null), togglePanelRef = useRef<null | ((kind: StudioPanelKind) => void)>(null);
  const bindOpenPanel = useCallback((action: null | ((kind: StudioPanelKind) => void)) => { openPanelRef.current = action; }, []);
  const bindTogglePanel = useCallback((action: null | ((kind: StudioPanelKind) => void)) => { togglePanelRef.current = action; }, []);
  const panelFocus = useRef<HTMLElement | null>(null), fullscreenFocus = useRef<HTMLElement | null>(null), previousFullscreen = useRef(false);
  const shortcutsFocus = useRef<HTMLElement | null>(null);
  const [jobsRequest, setJobsRequest] = useState(0),[storyRequest,setStoryRequest]=useState(0);
  useEffect(() => {
    if (!jobsRequest) return;
    if (openPanelRef.current) openPanelRef.current('jobs');
    else jobsRef.current?.focus();
  }, [jobsRequest]);
  useEffect(()=>{if(storyRequest)openPanelRef.current?.('story');},[storyRequest]);
  const [fullscreenHint, setFullscreenHint] = useState(false);
  const busy = pendingCommands > 0;
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => nowMs ?? Date.now());
  const runtime = snapshot.authoring;
  const [tempoDraft,setTempoDraft]=useState('120'),tempoEditing=useRef(false);
  useEffect(()=>{if(!tempoEditing.current)setTempoDraft(String(runtime?.tempo?.bpm??120));},[runtime?.tempo?.bpm,runtime?.instanceId,runtime?.generation]);
  const sourceProblemCount = sourceDiagnostics?.items.length ?? 0;
  const matchingSourceFaults = snapshot.jobs.filter(job => sourceDiagnosticFault(job.fault, sourceDiagnostics?.items ?? [])).length;
  const baseStatus = studioStatus(snapshot, sourceProblemCount);
  const status = { ...baseStatus, problems: Math.max(0, baseStatus.problems - matchingSourceFaults) };
  useEffect(() => { setError(null); }, [runtime?.instanceId, runtime?.generation]);
  const [graphSelection,setGraphSelection]=useState<NodePath|null>(null);
  const selectedGraphSelection=visualSelection(runtime,graphSelection);
  const selectedNodePath=selectedGraphSelection??undefined;
  useEffect(()=>{if(selectedGraphSelection!==graphSelection)setGraphSelection(selectedGraphSelection);},[selectedGraphSelection,graphSelection]);
  function selectGraphNode(path:NodePath|null){setGraphSelection(path?[...path]:null);openPanelRef.current?.('inspector');}
  const available = snapshot.connection === 'connected' && runtime?.authority === 'studio' && controlsAvailable !== false;
  useEffect(() => {
    if (nowMs !== undefined) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [nowMs]);
  useEffect(() => {
    if (!windows) return;
    let active = true, receivedEvent = false;
    const unsubscribe = windows.subscribe(state => { receivedEvent = true; if (active) setWindowState(state); });
    void windows.getState().then(state => { if (active && !receivedEvent) setWindowState(state); }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; unsubscribe(); };
  }, [windows]);
  function rememberFocus(target: { current: HTMLElement | null }): void {
    target.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  function restoreFocus(target: { current: HTMLElement | null }): void {
    const element = target.current; target.current = null;
    queueMicrotask(() => { if (element?.isConnected) element.focus(); });
  }
  function toggleMaximized(panel = focusedPanel): void {
    if (maximizedPanel) { setMaximizedPanel(null); restoreFocus(panelFocus); return; }
    rememberFocus(panelFocus); setMaximizedPanel(panel);
  }
  function toggleFullscreen(): void {
    if (!windows) return;
    if (!windowState.fullscreen) rememberFocus(fullscreenFocus);
    windowAction(() => windows.fullscreen(!windowState.fullscreen));
  }
  function toggleInspector(): void {
    if (maximizedPanel === 'preview' && !windowState.fullscreen) { setMaximizedInspector(value => !value); return; }
    if (maximizedPanel === 'inspector') { setMaximizedPanel(null); restoreFocus(panelFocus); }
    togglePanelRef.current?.('inspector');
  }
  function openShortcutReference(returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null): void {
    shortcutsFocus.current = returnFocus; setShortcutsOpen(true);
  }
  function closeShortcutReference(): void { setShortcutsOpen(false); }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (windows) void windows.fullscreen(false).catch(reason => setError(String(reason)));
      if (!windowState.fullscreen && maximizedPanel) { setMaximizedPanel(null); restoreFocus(panelFocus); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [windows, windowState.fullscreen, maximizedPanel]);
  useEffect(() => {
    if (previousFullscreen.current && !windowState.fullscreen) restoreFocus(fullscreenFocus);
    previousFullscreen.current = windowState.fullscreen;
  }, [windowState.fullscreen]);
  const shortcutActionsRef = useRef(shortcutActions); shortcutActionsRef.current = shortcutActions;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const shortcut = shortcutCommand(event);
      if (!shortcut || event.defaultPrevented || event.isComposing) return;
      if (shortcut === 'shortcut-reference' && event.repeat) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        if (shortcut !== 'shortcut-reference') event.preventDefault();
        return;
      }
      if (blocksTextEntry(shortcut) && isTextEntryTarget(event.target)) {
        if (shortcut !== 'shortcut-reference') event.preventDefault();
        return;
      }
      event.preventDefault();
      if (event.repeat) return;
      if (shortcut === 'maximize-panel') { if (!previewOnly) toggleMaximized(); return; }
      if (shortcut === 'fullscreen') { toggleFullscreen(); return; }
      if (shortcut === 'toggle-inspector') { if (!previewOnly) toggleInspector(); return; }
      if (shortcut === 'shortcut-reference') { openShortcutReference(); return; }
      const action = shortcutActionsRef.current?.[shortcut];
      if (!action || action.disabled) return;
      void action.run();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [focusedPanel, maximizedPanel, previewOnly, windowState.fullscreen, windows]);
  useEffect(() => {
    setFullscreenHint(windowState.fullscreen);
    if (!windowState.fullscreen) return;
    const timer = setTimeout(() => setFullscreenHint(false), 3500);
    return () => clearTimeout(timer);
  }, [windowState.fullscreen]);
  async function command(action: () => Promise<unknown>, transport = true): Promise<void> {
    if (transport && transportPending.current) return;
    if (transport) { transportPending.current = true; setPendingCommands(count => count + 1); }
    setError(null);
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (transport) { transportPending.current = false; setPendingCommands(count => count - 1); } }
  }
  function commitTempo(){tempoEditing.current=false;const bpm=Number(tempoDraft);if(!Number.isFinite(bpm)||bpm<20||bpm>300){setTempoDraft(String(runtime?.tempo?.bpm??120));setError('Tempo must be between 20 and 300 BPM.');return;}if(bpm===(runtime?.tempo?.bpm??120))return;const write=controller.setTempoBpm(bpm);controlEdits?.track(write);void command(()=>write);}
  function tapTempo(){const write=controller.tapTempo();controlEdits?.track(write);void command(()=>write);}
  function windowAction(action: () => Promise<void>): void { void action().catch(reason => setError(String(reason))); }
  const compact = previewOnly || maximizedPanel !== null || windowState.fullscreen;
  const expandedPanel: StudioPanelKind = previewOnly || windowState.fullscreen ? 'preview' : maximizedPanel ?? 'preview';
  const showMaximizedInspector = maximizedPanel === 'preview' && maximizedInspector && !windowState.fullscreen;
  const previewOutput = runtime?.output;
  const workerFps = snapshot.performance?.worker?.produced;
  const previewFpsValue = runtime?.playback === 'playing' && snapshot.performance?.status === 'live' && workerFps?.availability === 'available' && workerFps.value !== undefined ? `${workerFps.value.toFixed(1)} FPS` : '— FPS';
  const previewFpsDetail = snapshot.performance?.status === 'live' && workerFps?.availability === 'available' ? 'Measured worker FPS' : 'Worker FPS unavailable or stale';
  const presetValue = previewOutput && [[1280,720],[1920,1080],[2560,1440]].some(([width,height]) => width === previewOutput.width && height === previewOutput.height)
    ? `${previewOutput.width}x${previewOutput.height}` : 'custom';
  const resizePreview = (height: number) => {
    if (!previewOutput) return;
    const width = Math.round(height * previewOutput.width / previewOutput.height);
    void command(() => controller.resize(width, height));
  };
  const previewPane = <Paper component="main" square className="preview-panel">
        <div className="panel-toolbar" hidden={windowState.fullscreen}>
          <div className="preview-actions">
            {previewActions}
            {!previewOnly && <Button aria-pressed={maximizedPanel === 'preview'} title={`${maximizedPanel === 'preview' ? 'Restore workspace' : 'Maximize preview'} (${shortcutHint['maximize-panel']})`} onClick={() => toggleMaximized('preview')}>{maximizedPanel === 'preview' ? <>Restore workspace <span className="studio-shortcut-hint" aria-hidden="true">{shortcutHint['maximize-panel']}</span></> : 'Maximize'}</Button>}
            {maximizedPanel === 'preview' && !windowState.fullscreen && <Button aria-pressed={maximizedInspector} title={`${maximizedInspector ? 'Hide Inspector' : 'Show Inspector'} (${shortcutHint['toggle-inspector']})`} onClick={toggleInspector}>{maximizedInspector ? 'Hide Inspector' : 'Show Inspector'}</Button>}
            {(previewOnly || windowState.detached || windows?.popout) && <Button disabled={!windows} onClick={() => windows && windowAction(() => previewOnly || windowState.detached ? windows.dock() : windows.popout!())}>{previewOnly || windowState.detached ? 'Dock preview' : 'Pop out'}</Button>}
            <Button disabled={!windows} title={`${windowState.fullscreen ? 'Exit fullscreen' : 'Fullscreen'} (${shortcutHint.fullscreen})`} onClick={toggleFullscreen}>{windowState.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</Button>
          </div>
          <div className="preview-resolution-controls">
            <label className="preview-resolution">Resolution
              <select aria-label="Preview resolution preset" disabled={!available || busy} value={presetValue} onChange={event => { const parts = event.target.value.split('x'); const width = Number(parts[0]), height = Number(parts[1]); if (Number.isInteger(width) && Number.isInteger(height)) void command(() => controller.resize(width, height)); }}>
                <option value="custom">Custom</option><option value="1280x720">1280 × 720</option><option value="1920x1080">1920 × 1080</option><option value="2560x1440">2560 × 1440</option>
              </select>
            </label>
            <label className="preview-resolution-scale">Scale <input aria-label="Preview resolution scale" type="range" min="360" max="2160" step="90" disabled={!available || busy || !previewOutput} value={previewOutput ? Math.min(2160, Math.max(360, previewOutput.height)) : 1080} onChange={event => resizePreview(Number(event.target.value))} /></label>
            {previewOutput && <span className="preview-resolution-value" aria-live="polite">{previewOutput.width} × {previewOutput.height}</span>}
            <span className="preview-fps" aria-label={`Worker frame rate ${previewFpsValue}`} title={previewFpsDetail}>{previewFpsValue}</span>
          </div>
        </div>
        <Preview runtime={runtime} port={presentation} moved={!previewOnly && windowState.detached} onError={setError} onDock={() => windows && windowAction(() => windows.dock())} />
        {runtime?.fault && <Alert severity="error"><strong>{runtime.fault.code}</strong> · {runtime.fault.message}</Alert>}
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        <div className="transport" hidden={windowState.fullscreen} aria-busy={busy}><div className="transport-actions">
          <Tooltip title={runtime?.playback === 'playing' ? 'Pause' : 'Play'}><span><IconButton className="playback-toggle" aria-label={runtime?.playback === 'playing' ? 'Pause' : 'Play'} disabled={!available}
            onClick={() => void command(() => controller.playback(runtime?.playback === 'playing' ? 'pause' : 'play'))}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d={runtime?.playback === 'playing' ? 'M6 4h4v16H6zm8 0h4v16h-4z' : 'M6 3l15 9-15 9z'} /></svg>
          </IconButton></span></Tooltip>
          <Tooltip title="Reset"><span><IconButton aria-label="Reset" disabled={!available} onClick={() => void command(() => controller.playback('reset'))}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M4 10a8 8 0 1 1 0 5M4 4v6h6" /></svg>
          </IconButton></span></Tooltip>
          <span className="tempo-label">BPM</span><TextField className="tempo-bpm" size="small" type="number" value={tempoDraft} disabled={!available} onFocus={()=>{tempoEditing.current=true;}} onChange={event=>{tempoEditing.current=true;setTempoDraft(event.target.value);}} onBlur={commitTempo} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commitTempo();}else if(event.key==='Escape'){tempoEditing.current=false;setTempoDraft(String(runtime?.tempo?.bpm??120));}}} slotProps={{htmlInput:{min:20,max:300,step:.1,'aria-label':'Tempo BPM'}}}/>
          <Button size="small" aria-label="Tap tempo" disabled={!available} onClick={tapTempo}>Tap</Button>
          <Tooltip title="More playback actions"><IconButton aria-label="More playback actions" aria-haspopup="menu" aria-expanded={!!transportMenu} onClick={event => setTransportMenu(event.currentTarget)}>...</IconButton></Tooltip>
          <Menu anchorEl={transportMenu} open={!!transportMenu} onClose={() => setTransportMenu(null)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setTransportMenu(null); } }}>
            <MenuItem disabled={!available} onClick={() => { setTransportMenu(null); void command(() => controller.restart()); }}>Restart runtime</MenuItem>
          </Menu>
        </div></div>
      </Paper>;
  const inspectorPane = <Paper component="aside" square className="inspector" aria-label="Scene controls">
        <section><Disclosure title="Controls" defaultOpen className="controls-section" badge={<span className="controls-badges"><Chip label="LIVE" />{selectedVisualId?<Chip className="selected-visual-chip" label={`Source ${selectedVisualId}`} />:null}</span>}>
          <InspectorBreadcrumb runtime={runtime} path={selectedNodePath} onSelect={setGraphSelection} />
          <ParameterInspector nodePath={selectedNodePath} runtime={runtime} available={!!available} client={client} controller={controller} onError={setError} edits={controlEdits} />
        </Disclosure></section>
      </Paper>;
  const diagnosticsPane = <Paper component="aside" square className="diagnostics-pane" aria-label="Diagnostics">
        <section><Disclosure title="Performance"><PerformanceStatus performance={snapshot.performance} /><MetricView label="Visual delivery" metric={snapshot.visualFps} nowMs={nowMs ?? clock} /><MetricView label="UI cadence" metric={snapshot.uiFps} nowMs={nowMs ?? clock} />
          <p className="hint">Delivery and interface cadence are measured separately.</p></Disclosure></section>
        <section><Disclosure title="Runtime"><dl className="identity"><dt>Authoring revision</dt><dd>{runtime?.revisionId ?? 'Unavailable'}</dd><dt>Instance</dt><dd>{runtime?.instanceId ?? 'Unavailable'}</dd><dt>Generation / clock epoch</dt><dd>{runtime ? `${runtime.generation} / ${runtime.clockEpoch}` : 'Unavailable'}</dd><dt>Completed frame</dt><dd>{runtime?.frameId ?? 'Unavailable'}</dd></dl></Disclosure></section>
        <section><Disclosure title="Host output"><p className="host-revision">{snapshot.host?.revisionId ?? 'No host status available'}</p><p className="hint">Authoring changes do not update a pinned host revision.</p></Disclosure></section>
      </Paper>;
  const storyStatus=runtime?.storySchedule??runtime?.story;
  const storyPane=<Paper component="aside" square className="story-pane"><StoryPanel key={`${runtime?.instanceId??'none'}:${runtime?.generation??0}:${storyStatus?.storyHash??'none'}`} status={storyStatus} previewPlayback={runtime?.playback} available={!!available} controller={controller} onError={message=>setError(message)}/></Paper>;
  const openStory=()=>{setMaximizedPanel(null);setStoryRequest(value=>value+1);};
  const openJobs = () => { setMaximizedPanel(null); setJobsRequest(value => value + 1); };
  const jobsPane = <section ref={jobsRef} tabIndex={-1} className="diagnostics" aria-label="Jobs and diagnostics"><div className="section-heading"><h2>Jobs & diagnostics</h2><span className="subtle">{snapshot.jobs.length} jobs · {sourceProblemCount} diagnostics</span></div>
      {runtime?.fault && <p className="error" role="alert"><strong>{runtime.fault.code}</strong> · {runtime.fault.message}</p>}
      {snapshot.jobs.map(job => <p key={job.jobId} className={job.fault ? 'error' : ''}><span className="tag">{job.state}</span> {job.summary}{job.fault && !sourceDiagnosticFault(job.fault, sourceDiagnostics?.items ?? []) && ` · ${job.fault}`}</p>)}
      {sourceDiagnostics && <ProblemsPanel diagnostics={sourceDiagnostics.items} snapshot={sourceDiagnostics.snapshot} visualSnapshots={sourceDiagnostics.visualSnapshots} onNavigate={target => {
        sourceDiagnostics.onNavigate(target); openPanelRef.current?.('source');
      }} />}
      {!runtime?.fault && snapshot.jobs.length === 0 && !sourceProblemCount && <p>{snapshot.message ?? 'No jobs reported.'}</p>}
    </section>;
  return <><Dialog open={shortcutsOpen} onClose={closeShortcutReference} aria-labelledby="shortcut-reference-title" maxWidth="sm" fullWidth
    slotProps={{ transition: { onExited: () => restoreFocus(shortcutsFocus) } }} onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
    <DialogTitle id="shortcut-reference-title">Keyboard shortcuts</DialogTitle>
    <DialogContent><dl className="shortcut-reference-list">{shortcutReference.map(item => <div key={item.command}><dt>{item.label}</dt><dd><kbd>{shortcutHint[item.command]}</kbd>{item.command === 'shortcut-reference' && <small>Shift+/</small>}</dd></div>)}</dl></DialogContent>
    <DialogActions><Button onClick={closeShortcutReference}>Done</Button></DialogActions>
  </Dialog><div className={`studio ${compact ? 'studio-expanded' : ''} ${windowState.fullscreen ? 'studio-preview-fullscreen' : ''}`}>
    {windowState.fullscreen && fullscreenHint && <div className="fullscreen-hint" role="status">Press Escape to exit fullscreen</div>}
    <header className="app-bar" hidden={windowState.fullscreen}>
      <div className="brand"><strong>LUX</strong></div>
      {fileMenu}
      <span className="view-tools-host" ref={setToolsHost} />
      {appCommands ?? <div className="scene-heading"><span className="eyebrow">AUTHORING</span><span>{runtime?.sceneName ?? 'No scene connected'}</span></div>}
      {maximizedPanel && maximizedPanel !== 'preview' && !windowState.fullscreen && <Button color="inherit" title={`Restore workspace (${shortcutHint['maximize-panel']})`} onClick={() => toggleMaximized()}>Restore workspace <span className="studio-shortcut-hint" aria-hidden="true">{shortcutHint['maximize-panel']}</span></Button>}
    </header>
    {appError && <Alert severity="error">{appError}</Alert>}
    <div className="workspace">
      {sourcePanel ? <StudioDockShell onOpenPanelReady={bindOpenPanel} onTogglePanelReady={bindTogglePanel} onActivePanelChange={setFocusedPanel} onShortcutsHelp={openShortcutReference} toolsHost={toolsHost} compact={compact} expandedPanel={expandedPanel} showInspector={showMaximizedInspector} preview={previewPane} source={sourcePanel} library={libraryPanel??<section aria-label="Shared component library">Library unavailable.</section>} inspector={inspectorPane} story={storyPane} diagnostics={diagnosticsPane} jobs={jobsPane} graph={<GraphPanel runtime={runtime} selected={selectedNodePath?nodeKey(selectedNodePath):null} onSelect={selectGraphNode}/>} /> : <>{previewPane}{(!compact || showMaximizedInspector) && inspectorPane}{(!compact || showMaximizedInspector) && diagnosticsPane}</>}
    </div>
    {!sourcePanel && !compact && jobsPane}
    <footer className="status-bar" hidden={windowState.fullscreen || previewOnly} aria-label="Studio status">
      <button type="button" className={`status-item status-build ${status.build === 'Build failed' ? 'status-error' : ''}`} aria-busy={status.building} aria-label={`Build status: ${status.build}. Open Jobs and diagnostics`} onClick={openJobs}><span aria-hidden="true" className={status.building ? 'status-spinner' : 'status-build-icon'}>{status.building ? '' : '↻'}</span><span aria-live="polite">{status.build}</span></button>
      <button type="button" className={`status-item ${status.problems ? 'status-error' : ''}`} aria-label={`Problems: ${status.problems}. Open Jobs and diagnostics`} onClick={openJobs}><span aria-hidden="true">!</span><span>{status.problems} {status.problems === 1 ? 'problem' : 'problems'}</span></button>
      {sourceChanged && <span className="status-item" title="Build to apply the source edits to Preview">Source changed · Build to update</span>}
      {storyStatus&&<button type="button" className="status-item status-story" aria-label={`Story status: ${storyStatusLabel(storyStatus)}. Open Story`} onClick={openStory}><span aria-hidden="true">Story</span><span aria-live="polite">{storyStatusLabel(storyStatus)}</span></button>}
      {['Connecting', 'Disconnected', 'Failed'].includes(status.runtime) && <button type="button" className="status-item status-runtime status-error" aria-label={`Runtime status: ${status.runtime}. Open Jobs and diagnostics`} onClick={openJobs}>{status.runtime}</button>}
    </footer>
  </div></>;
}
