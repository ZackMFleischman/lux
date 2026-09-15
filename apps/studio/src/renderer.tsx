import {GraphPanel,compositionNodeLabel,compositionOccurrence,nodeKey} from './GraphPanel.tsx';
import type {NodePath} from '../../../packages/runtime-contracts/src/graph.ts';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Button, Chip, CssBaseline, Paper, ThemeProvider, IconButton, Tooltip, Menu, MenuItem } from '@mui/material';
import { studioTheme } from './theme.ts';
import { ParameterInspector, parameterOwner } from './controls/ParameterInspector.tsx';
import type { ControlEdits } from './controls/ParameterInspector.tsx';
import { PerformanceStatus } from './performance/PerformanceStatus.tsx';
import { Preview } from './preview.tsx';
import { StudioController } from './service-client.ts';
import type { ReactNode } from 'react';
import { StudioDockShell } from './layout/StudioDockShell.tsx';
import type { StudioClient, StudioSnapshot, Metric } from './service-client.ts';
import type { PresentationPort } from './presentation.ts';
import type { StudioWindowClient, WindowState } from './window-client.ts';
import { createRendererSnapshot } from './renderer-snapshot.ts';
import { Disclosure } from './Disclosure.tsx';

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
  client: StudioClient; presentation?: PresentationPort; windows?: StudioWindowClient; previewOnly?: boolean; nowMs?: number; sourcePanel?: ReactNode; libraryPanel?:ReactNode; appCommands?: ReactNode; fileMenu?: ReactNode; appError?: string; sourceChanged?: boolean;
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
export function studioStatus(snapshot: StudioSnapshot): { build: string; building: boolean; problems: number; runtime: string } {
  const jobs = [...snapshot.jobs];
  const latest = jobs.at(-1), active = jobs.findLast(job => activeJobStates.has(job.state.toLowerCase()));
  const build = active?.summary ?? (latest?.state.toLowerCase() === 'failed' ? 'Build failed'
    : latest?.state.toLowerCase() === 'succeeded' ? 'Build ready' : 'Build idle');
  const problems = (snapshot.authoring?.fault ? 1 : 0) + jobs.filter(job => !!job.fault || job.state.toLowerCase() === 'failed').length;
  const runtime = snapshot.connection === 'connecting' ? 'Connecting' : snapshot.connection !== 'connected' ? 'Disconnected'
    : snapshot.authoring?.fault || snapshot.authoring?.playback === 'failed' ? 'Failed'
    : snapshot.authoring ? sentenceCase(snapshot.authoring.playback) : 'No runtime';
  return { build, building: !!active, problems, runtime };
}
function StudioLayout({ client, presentation, windows, previewOnly = false, nowMs, sourcePanel,libraryPanel, appCommands, fileMenu, appError, controlEdits, sourceChanged }: StudioProps) {
  const [toolsHost, setToolsHost] = useState<HTMLElement | null>(null);
  const [transportMenu, setTransportMenu] = useState<HTMLElement | null>(null);
  const view = useMemo(() => createRendererSnapshot(client), [client]);
  const snapshot = useSyncExternalStore(view.subscribe, view.getSnapshot, view.getSnapshot);
  const owner = controlOwner(snapshot);
  // A rejected old-target write must not discard a new runtime's queued input.
  const controller = useMemo(() => new StudioController(client), [client, owner]);
  const [windowState, setWindowState] = useState<WindowState>({ detached: false, fullscreen: false });
  const [maximized, setMaximized] = useState(false);
  const [maximizedInspector, setMaximizedInspector] = useState(false);
  const [pendingCommands, setPendingCommands] = useState(0);
  const transportPending = useRef(false);
  const jobsRef = useRef<HTMLElement>(null), openPanelRef = useRef<null | ((kind: 'jobs' | 'inspector') => void)>(null);
  const bindOpenPanel = useCallback((action: null | ((kind: 'jobs' | 'inspector') => void)) => { openPanelRef.current = action; }, []);
  const [jobsRequest, setJobsRequest] = useState(0);
  useEffect(() => {
    if (!jobsRequest) return;
    if (openPanelRef.current) openPanelRef.current('jobs');
    else jobsRef.current?.focus();
  }, [jobsRequest]);
  const [fullscreenHint, setFullscreenHint] = useState(false);
  const busy = pendingCommands > 0;
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => nowMs ?? Date.now());
  const runtime = snapshot.authoring;
  const status = studioStatus(snapshot);
  useEffect(() => { setError(null); }, [runtime?.instanceId, runtime?.generation]);
  const [graphSelection,setGraphSelection]=useState<NodePath|null>(null);
  const selectedNodePath=graphSelection??undefined;
  const selectedNode=selectedNodePath?compositionOccurrence(runtime,selectedNodePath):undefined;
  function selectGraphNode(path:NodePath|null){setGraphSelection(path?[...path]:null);openPanelRef.current?.('inspector');}
  const available = snapshot.connection === 'connected' && runtime?.authority === 'studio';
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
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (windows) void windows.fullscreen(false).catch(reason => setError(String(reason)));
      if (!windowState.fullscreen) setMaximized(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [windows, windowState.fullscreen]);
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
  function windowAction(action: () => Promise<void>): void { void action().catch(reason => setError(String(reason))); }
  const compact = previewOnly || maximized || windowState.fullscreen;
  const showMaximizedInspector = maximized && maximizedInspector && !windowState.fullscreen;
  const previewOutput = runtime?.output;
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
            {!previewOnly && <Button aria-pressed={maximized} onClick={() => setMaximized(value => !value)}>{maximized ? 'Restore workspace' : 'Maximize'}</Button>}
            {maximized && !windowState.fullscreen && <Button aria-pressed={maximizedInspector} onClick={() => setMaximizedInspector(value => !value)}>{maximizedInspector ? 'Hide Inspector' : 'Show Inspector'}</Button>}
            {(previewOnly || windowState.detached || windows?.popout) && <Button disabled={!windows} onClick={() => windows && windowAction(() => previewOnly || windowState.detached ? windows.dock() : windows.popout!())}>{previewOnly || windowState.detached ? 'Dock preview' : 'Pop out'}</Button>}
            <Button disabled={!windows} onClick={() => windows && windowAction(() => windows.fullscreen(!windowState.fullscreen))}>{windowState.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</Button>
          </div>
          <div className="preview-resolution-controls">
            <label className="preview-resolution">Resolution
              <select aria-label="Preview resolution preset" disabled={!available || busy} value={presetValue} onChange={event => { const parts = event.target.value.split('x'); const width = Number(parts[0]), height = Number(parts[1]); if (Number.isInteger(width) && Number.isInteger(height)) void command(() => controller.resize(width, height)); }}>
                <option value="custom">Custom</option><option value="1280x720">1280 × 720</option><option value="1920x1080">1920 × 1080</option><option value="2560x1440">2560 × 1440</option>
              </select>
            </label>
            <label className="preview-resolution-scale">Scale <input aria-label="Preview resolution scale" type="range" min="360" max="2160" step="90" disabled={!available || busy || !previewOutput} value={previewOutput ? Math.min(2160, Math.max(360, previewOutput.height)) : 1080} onChange={event => resizePreview(Number(event.target.value))} /></label>
            {previewOutput && <span className="preview-resolution-value" aria-live="polite">{previewOutput.width} × {previewOutput.height}</span>}
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
          <Tooltip title="More playback actions"><IconButton aria-label="More playback actions" aria-haspopup="menu" aria-expanded={!!transportMenu} onClick={event => setTransportMenu(event.currentTarget)}>...</IconButton></Tooltip>
          <Menu anchorEl={transportMenu} open={!!transportMenu} onClose={() => setTransportMenu(null)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setTransportMenu(null); } }}>
            <MenuItem disabled={!available} onClick={() => { setTransportMenu(null); void command(() => controller.restart()); }}>Restart runtime</MenuItem>
          </Menu>
        </div></div>
      </Paper>;
  const inspectorPane = <Paper component="aside" square className="inspector" aria-label="Scene controls and status">
        <section><Disclosure title="Controls" defaultOpen className="controls-section" badge={<Chip label="LIVE" />}>
          <p className="inspector-target">{selectedNodePath&&selectedNode?compositionNodeLabel(runtime,selectedNodePath):(selectedNodePath?'Selected node unavailable':runtime?.composition?'Composition controls':'Visual controls')}</p>
          <ParameterInspector nodePath={selectedNodePath} runtime={runtime} available={!!available} client={client} controller={controller} onError={setError} edits={controlEdits} />
        </Disclosure></section>
        <section><Disclosure title="Performance"><PerformanceStatus performance={snapshot.performance} /><MetricView label="Visual delivery" metric={snapshot.visualFps} nowMs={nowMs ?? clock} /><MetricView label="UI cadence" metric={snapshot.uiFps} nowMs={nowMs ?? clock} />
          <p className="hint">Delivery and interface cadence are measured separately.</p></Disclosure></section>
        <section><Disclosure title="Runtime"><dl className="identity"><dt>Authoring revision</dt><dd>{runtime?.revisionId ?? 'Unavailable'}</dd><dt>Instance</dt><dd>{runtime?.instanceId ?? 'Unavailable'}</dd><dt>Generation / clock epoch</dt><dd>{runtime ? `${runtime.generation} / ${runtime.clockEpoch}` : 'Unavailable'}</dd><dt>Completed frame</dt><dd>{runtime?.frameId ?? 'Unavailable'}</dd></dl></Disclosure></section>
        <section><Disclosure title="Host output"><p className="host-revision">{snapshot.host?.revisionId ?? 'No host status available'}</p><p className="hint">Authoring changes do not update a pinned host revision.</p></Disclosure></section>
      </Paper>;
  const openJobs = () => { setMaximized(false); setJobsRequest(value => value + 1); };
  const jobsPane = <section ref={jobsRef} tabIndex={-1} className="diagnostics" aria-label="Jobs and diagnostics"><div className="section-heading"><h2>Jobs & diagnostics</h2><span className="subtle">{snapshot.jobs.length} reported</span></div>
      {runtime?.fault && <p className="error" role="alert"><strong>{runtime.fault.code}</strong> · {runtime.fault.message}</p>}
      {snapshot.jobs.map(job => <p key={job.jobId} className={job.fault ? 'error' : ''}><span className="tag">{job.state}</span> {job.summary}{job.fault && ` · ${job.fault}`}</p>)}
      {!runtime?.fault && snapshot.jobs.length === 0 && <p>{snapshot.message ?? 'No jobs reported.'}</p>}
    </section>;
  return <div className={`studio ${compact ? 'studio-expanded' : ''} ${windowState.fullscreen ? 'studio-preview-fullscreen' : ''}`}>
    {windowState.fullscreen && fullscreenHint && <div className="fullscreen-hint" role="status">Press Escape to exit fullscreen</div>}
    <header className="app-bar" hidden={windowState.fullscreen}>
      <div className="brand"><strong>LUX</strong></div>
      {fileMenu}
      <span className="view-tools-host" ref={setToolsHost} />
      {appCommands ?? <div className="scene-heading"><span className="eyebrow">AUTHORING</span><span>{runtime?.sceneName ?? 'No scene connected'}</span></div>}
    </header>
    {appError && <Alert severity="error">{appError}</Alert>}
    <div className="workspace">
      {sourcePanel ? <StudioDockShell onOpenPanelReady={bindOpenPanel} toolsHost={toolsHost} compact={compact} showInspector={showMaximizedInspector} preview={previewPane} source={sourcePanel} library={libraryPanel??<section aria-label="Shared component library">Library unavailable.</section>} inspector={inspectorPane} jobs={jobsPane} graph={<GraphPanel runtime={runtime} selected={selectedNodePath?nodeKey(selectedNodePath):null} onSelect={selectGraphNode}/>} /> : <>{previewPane}{(!compact || showMaximizedInspector) && inspectorPane}</>}
    </div>
    {!sourcePanel && !compact && jobsPane}
    <footer className="status-bar" hidden={windowState.fullscreen || previewOnly} aria-label="Studio status">
      <button type="button" className={`status-item status-build ${status.build === 'Build failed' ? 'status-error' : ''}`} aria-busy={status.building} aria-label={`Build status: ${status.build}. Open Jobs and diagnostics`} onClick={openJobs}><span aria-hidden="true" className={status.building ? 'status-spinner' : 'status-build-icon'}>{status.building ? '' : '↻'}</span><span aria-live="polite">{status.build}</span></button>
      <button type="button" className={`status-item ${status.problems ? 'status-error' : ''}`} aria-label={`Problems: ${status.problems}. Open Jobs and diagnostics`} onClick={openJobs}><span aria-hidden="true">!</span><span>{status.problems} {status.problems === 1 ? 'problem' : 'problems'}</span></button>
      {sourceChanged && <span className="status-item" title="Build to apply the source edits to Preview">Source changed · Build to update</span>}
      {['Connecting', 'Disconnected', 'Failed'].includes(status.runtime) && <button type="button" className="status-item status-runtime status-error" aria-label={`Runtime status: ${status.runtime}. Open Jobs and diagnostics`} onClick={openJobs}>{status.runtime}</button>}
    </footer>
  </div>;
}
