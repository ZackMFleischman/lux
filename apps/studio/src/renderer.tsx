import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Button, Chip, CssBaseline, Paper, Slider, ThemeProvider, IconButton, Tooltip, Menu, MenuItem } from '@mui/material';
import { studioTheme } from './theme.ts';
import { INTENSITY_CONTROL } from '../../../packages/runtime-contracts/src/index.ts';
import { Preview } from './preview.tsx';
import { StudioController } from './service-client.ts';
import type { ReactNode } from 'react';
import { StudioDockShell } from './layout/StudioDockShell.tsx';
import type { StudioClient, StudioSnapshot, Metric } from './service-client.ts';
import type { PresentationPort } from './presentation.ts';
import type { StudioWindowClient, WindowState } from './window-client.ts';

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
  client: StudioClient; presentation?: PresentationPort; windows?: StudioWindowClient; previewOnly?: boolean; nowMs?: number; sourcePanel?: ReactNode; appCommands?: ReactNode; fileMenu?: ReactNode; appError?: string;
};
export function StudioApp(props: StudioProps) {
  return <ThemeProvider theme={studioTheme}><CssBaseline /><StudioLayout {...props} /></ThemeProvider>;
}
function controlOwner(snapshot: StudioSnapshot): string | null {
  const runtime = snapshot.authoring;
  return snapshot.connection === 'connected' && runtime?.authority === 'studio'
    ? JSON.stringify([runtime.instanceId, runtime.generation, runtime.revisionId]) : null;
}
function StudioLayout({ client, presentation, windows, previewOnly = false, nowMs, sourcePanel, appCommands, fileMenu, appError }: StudioProps) {
  const [toolsHost, setToolsHost] = useState<HTMLElement | null>(null);
  const [transportMenu, setTransportMenu] = useState<HTMLElement | null>(null);
  const subscribe = useCallback((listener: () => void) => client.subscribe(listener), [client]);
  const getSnapshot = useCallback(() => client.getSnapshot(), [client]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const owner = controlOwner(snapshot);
  // A rejected old-target write must not discard a new runtime's queued input.
  const controller = useMemo(() => new StudioController(client), [client, owner]);
  const [windowState, setWindowState] = useState<WindowState>({ detached: false, fullscreen: false });
  const [maximized, setMaximized] = useState(false);
  const [pendingCommands, setPendingCommands] = useState(0);
  const transportPending = useRef(false);
  const [fullscreenHint, setFullscreenHint] = useState(false);
  const busy = pendingCommands > 0;
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => nowMs ?? Date.now());
  const [intensity, setIntensity] = useState(snapshot.authoring?.intensity ?? INTENSITY_CONTROL.default);
  const intensityIntent = useRef<{ owner: string } | null>(null);
  const runtime = snapshot.authoring;
  const available = snapshot.connection === 'connected' && runtime?.authority === 'studio';
  useEffect(() => {
    // Runtime status can confirm earlier points while a drag has moved ahead.
    // Keep local input until the coalesced write drain settles for this target.
    if (owner && intensityIntent.current?.owner === owner) return;
    intensityIntent.current = null;
    setIntensity(runtime?.intensity ?? INTENSITY_CONTROL.default);
  }, [runtime?.intensity, owner]);
  useEffect(() => () => { intensityIntent.current = null; }, [client]);
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
  async function changeIntensity(value: number): Promise<void> {
    if (!owner) return;
    const intent = { owner };
    intensityIntent.current = intent;
    setIntensity(value); setError(null);
    try { await controller.setIntensity(value); }
    catch (reason) {
      if (intensityIntent.current === intent && controlOwner(client.getSnapshot()) === owner) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (intensityIntent.current === intent) {
        intensityIntent.current = null;
        const current = client.getSnapshot();
        if (controlOwner(current) === owner) setIntensity(current.authoring!.intensity);
      }
    }
  }
  const compact = previewOnly || maximized || windowState.fullscreen;
  const previewPane = <Paper component="main" square className="preview-panel">
        <div className="panel-toolbar" hidden={windowState.fullscreen}><div><Chip label="FINAL" /></div>
          <div className="preview-actions">
            {!previewOnly && <Button aria-pressed={maximized} onClick={() => setMaximized(!maximized)}>{maximized ? 'Restore workspace' : 'Maximize'}</Button>}
            {(previewOnly || windowState.detached || windows?.popout) && <Button disabled={!windows} onClick={() => windows && windowAction(() => previewOnly || windowState.detached ? windows.dock() : windows.popout!())}>{previewOnly || windowState.detached ? 'Dock preview' : 'Pop out'}</Button>}
            <Button disabled={!windows} onClick={() => windows && windowAction(() => windows.fullscreen(!windowState.fullscreen))}>{windowState.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</Button>
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
        </div><span className="playback-state">{runtime?.playback ?? 'Awaiting service'}</span></div>
      </Paper>;
  const inspectorPane = <Paper component="aside" square className="inspector" aria-label="Scene controls and status">
        <section><div className="section-heading"><h2>Controls</h2><Chip label="LIVE" /></div>
          <p className="section-description">Authoring values only. Host controls stay independent.</p>
          <label className="parameter-label" id="intensity-label"><span>{INTENSITY_CONTROL.label}</span><output>{available ? intensity.toFixed(2) : '—'}</output></label>
          <Slider aria-labelledby="intensity-label" min={INTENSITY_CONTROL.min} max={INTENSITY_CONTROL.max} step={0.01} value={intensity}
            disabled={!available} onChange={(_event, value) => { if (typeof value === 'number') void changeIntensity(value); }} />
          <div className="parameter-scale"><span>0</span><span>1</span></div>
          <p className="hint">{available ? `Applied value: ${runtime.intensity.toFixed(2)}` : 'Connect an authoring runtime to change controls.'}</p>
        </section>
        <section><h2>Performance</h2><MetricView label="Visual delivery" metric={snapshot.visualFps} nowMs={nowMs ?? clock} /><MetricView label="UI cadence" metric={snapshot.uiFps} nowMs={nowMs ?? clock} />
          <p className="hint">Delivery and interface cadence are measured separately.</p></section>
        <section><h2>Runtime</h2><dl className="identity"><dt>Authoring revision</dt><dd>{runtime?.revisionId ?? 'Unavailable'}</dd><dt>Instance</dt><dd>{runtime?.instanceId ?? 'Unavailable'}</dd><dt>Generation / clock epoch</dt><dd>{runtime ? `${runtime.generation} / ${runtime.clockEpoch}` : 'Unavailable'}</dd><dt>Completed frame</dt><dd>{runtime?.frameId ?? 'Unavailable'}</dd></dl></section>
        <section><div className="section-heading"><h2>Host output</h2><Chip label="SEPARATE" /></div><p className="host-revision">{snapshot.host?.revisionId ?? 'No host status available'}</p><p className="hint">Authoring changes do not update a pinned host revision.</p></section>
      </Paper>;
  const jobsPane = <section className="diagnostics" aria-label="Jobs and diagnostics"><div className="section-heading"><h2>Jobs & diagnostics</h2><span className="subtle">{snapshot.jobs.length} reported</span></div>
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
      <span className={`connection ${snapshot.connection === 'connected' ? 'connected' : ''}`}><i />{snapshot.connection === 'connected' ? 'Service connected' : snapshot.connection === 'connecting' ? 'Connecting' : 'Disconnected'}</span>
    </header>
    {appError && <Alert severity="error">{appError}</Alert>}
    <div className="workspace">
      {sourcePanel ? <StudioDockShell toolsHost={toolsHost} compact={compact} preview={previewPane} source={sourcePanel} inspector={inspectorPane} jobs={jobsPane} /> : <>{previewPane}{!compact && inspectorPane}</>}
    </div>
    {!sourcePanel && !compact && jobsPane}
    <footer className="status-bar" hidden={windowState.fullscreen}><span><i className="status-dot" />{snapshot.connection === 'connected' ? 'Authoring service' : 'Awaiting authoring service'}</span><span>Presentation only · output size is independent of window size</span><span>TRACER 0.1</span></footer>
  </div>;
}
