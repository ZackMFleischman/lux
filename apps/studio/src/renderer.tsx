import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, Button, Chip, CssBaseline, Paper, Slider, ThemeProvider } from '@mui/material';
import { studioTheme } from './theme.ts';
import { INTENSITY_CONTROL } from '../../../packages/runtime-contracts/src/index.ts';
import { Preview } from './preview.tsx';
import { StudioController } from './service-client.ts';
import type { StudioClient, Metric } from './service-client.ts';
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
  client: StudioClient; presentation?: PresentationPort; windows?: StudioWindowClient; previewOnly?: boolean; nowMs?: number;
};
export function StudioApp(props: StudioProps) {
  return <ThemeProvider theme={studioTheme}><CssBaseline /><StudioLayout {...props} /></ThemeProvider>;
}
function StudioLayout({ client, presentation, windows, previewOnly = false, nowMs }: StudioProps) {
  const subscribe = useCallback((listener: () => void) => client.subscribe(listener), [client]);
  const getSnapshot = useCallback(() => client.getSnapshot(), [client]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const controller = useMemo(() => new StudioController(client), [client]);
  const [windowState, setWindowState] = useState<WindowState>({ detached: false, fullscreen: false });
  const [maximized, setMaximized] = useState(false);
  const [pendingCommands, setPendingCommands] = useState(0), [notice, setNotice] = useState<string | null>(null);
  const busy = pendingCommands > 0;
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => nowMs ?? Date.now());
  const [intensity, setIntensity] = useState(snapshot.authoring?.intensity ?? INTENSITY_CONTROL.default);
  const runtime = snapshot.authoring;
  const available = snapshot.connection === 'connected' && runtime?.authority === 'studio';
  useEffect(() => { setIntensity(runtime?.intensity ?? INTENSITY_CONTROL.default); }, [runtime?.intensity, runtime?.generation, runtime?.instanceId]);
  useEffect(() => {
    if (nowMs !== undefined) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [nowMs]);
  useEffect(() => {
    if (!windows) return;
    let active = true;
    const unsubscribe = windows.subscribe(state => { if (active) setWindowState(state); });
    void windows.getState().then(state => { if (active) setWindowState(state); }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; unsubscribe(); };
  }, [windows]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (windowState.fullscreen && windows) void windows.fullscreen(false).catch(reason => setError(String(reason)));
      else setMaximized(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [windows, windowState.fullscreen]);
  async function command(action: () => Promise<unknown>): Promise<void> {
    setPendingCommands(count => count + 1); setError(null); setNotice(null);
    try { await action(); setNotice('Request accepted. Awaiting applied runtime status.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setPendingCommands(count => count - 1); }
  }
  function windowAction(action: () => Promise<void>): void { void action().catch(reason => setError(String(reason))); }
  const compact = previewOnly || maximized;
  return <div className={`studio ${compact ? 'studio-expanded' : ''}`}>
    <header className="app-bar">
      <div className="brand"><span className="brand-symbol" aria-hidden="true">L</span><strong>LUX</strong><span>STUDIO</span></div>
      <div className="scene-heading"><span className="eyebrow">AUTHORING</span><span>{runtime?.sceneName ?? 'No scene connected'}</span></div>
      <span className={`connection ${snapshot.connection === 'connected' ? 'connected' : ''}`}><i />{snapshot.connection === 'connected' ? 'Service connected' : snapshot.connection === 'connecting' ? 'Connecting' : 'Disconnected'}</span>
    </header>
    <div className="workspace">
      <Paper component="main" square className="preview-panel">
        <div className="panel-toolbar"><div><span className="panel-label">Preview</span><Chip label="FINAL" /><span className="subtle">Authoring instance</span></div>
          <div className="preview-actions">
            {!previewOnly && <Button aria-pressed={maximized} onClick={() => setMaximized(!maximized)}>{maximized ? 'Restore workspace' : 'Maximize'}</Button>}
            <Button disabled={!windows} onClick={() => windows && windowAction(() => previewOnly || windowState.detached ? windows.dock() : windows.popout())}>{previewOnly || windowState.detached ? 'Dock preview' : 'Pop out'}</Button>
            <Button disabled={!windows} onClick={() => windows && windowAction(() => windows.fullscreen(!windowState.fullscreen))}>{windowState.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</Button>
          </div>
        </div>
        <Preview runtime={runtime} port={presentation} moved={!previewOnly && windowState.detached} onError={setError} onDock={() => windows && windowAction(() => windows.dock())} />
        {runtime?.fault && <Alert severity="error"><strong>{runtime.fault.code}</strong> · {runtime.fault.message}</Alert>}
        {(error || notice) && <Alert severity={error ? 'error' : 'info'} role={error ? 'alert' : 'status'}>{error ?? notice}</Alert>}
        <div className="transport"><div className="transport-actions">
          <Button variant="contained" disabled={!available || busy || runtime?.playback === 'playing'} onClick={() => void command(() => controller.playback('play'))}>Play</Button>
          <Button disabled={!available || busy || runtime?.playback === 'paused'} onClick={() => void command(() => controller.playback('pause'))}>Pause</Button>
          <Button disabled={!available || busy} onClick={() => void command(() => controller.playback('reset'))}>Reset</Button>
          <span className="divider" />
          <Button disabled={!available || busy} onClick={() => void command(() => controller.restart())}>Restart runtime</Button>
        </div><span className="playback-state">{busy ? 'Sending request…' : runtime?.playback ?? 'Awaiting service'}</span></div>
      </Paper>
      {!compact && <Paper component="aside" square className="inspector" aria-label="Scene controls and status">
        <section><div className="section-heading"><h2>Controls</h2><Chip label="LIVE" /></div>
          <p className="section-description">Authoring values only. Host controls stay independent.</p>
          <label className="parameter-label" id="intensity-label"><span>{INTENSITY_CONTROL.label}</span><output>{available ? intensity.toFixed(2) : '—'}</output></label>
          <Slider aria-labelledby="intensity-label" min={INTENSITY_CONTROL.min} max={INTENSITY_CONTROL.max} step={0.01} value={intensity}
            disabled={!available} onChange={(_event, value) => { if (typeof value !== 'number') return; setIntensity(value); void command(() => controller.setIntensity(value)); }} />
          <div className="parameter-scale"><span>0</span><span>1</span></div>
          <p className="hint">{available ? `Applied value: ${runtime.intensity.toFixed(2)}` : 'Connect an authoring runtime to change controls.'}</p>
        </section>
        <section><h2>Performance</h2><MetricView label="Visual delivery" metric={snapshot.visualFps} nowMs={nowMs ?? clock} /><MetricView label="UI cadence" metric={snapshot.uiFps} nowMs={nowMs ?? clock} />
          <p className="hint">Delivery and interface cadence are measured separately.</p></section>
        <section><h2>Runtime</h2><dl className="identity"><dt>Authoring revision</dt><dd>{runtime?.revisionId ?? 'Unavailable'}</dd><dt>Instance</dt><dd>{runtime?.instanceId ?? 'Unavailable'}</dd><dt>Generation / clock epoch</dt><dd>{runtime ? `${runtime.generation} / ${runtime.clockEpoch}` : 'Unavailable'}</dd><dt>Completed frame</dt><dd>{runtime?.frameId ?? 'Unavailable'}</dd></dl></section>
        <section><div className="section-heading"><h2>Host output</h2><Chip label="SEPARATE" /></div><p className="host-revision">{snapshot.host?.revisionId ?? 'No host status available'}</p><p className="hint">Authoring changes do not update a pinned host revision.</p></section>
      </Paper>}
    </div>
    {!compact && <section className="diagnostics" aria-label="Jobs and diagnostics"><div className="section-heading"><h2>Jobs & diagnostics</h2><span className="subtle">{snapshot.jobs.length} reported</span></div>
      {runtime?.fault && <p className="error" role="alert"><strong>{runtime.fault.code}</strong> · {runtime.fault.message}</p>}
      {snapshot.jobs.map(job => <p key={job.jobId} className={job.fault ? 'error' : ''}><span className="tag">{job.state}</span> {job.summary}{job.fault && ` · ${job.fault}`}</p>)}
      {!runtime?.fault && snapshot.jobs.length === 0 && <p>{snapshot.message ?? 'No jobs reported.'}</p>}
    </section>}
    <footer className="status-bar"><span><i className="status-dot" />{snapshot.connection === 'connected' ? 'Authoring service' : 'Awaiting authoring service'}</span><span>Presentation only · output size is independent of window size</span><span>TRACER 0.1</span></footer>
  </div>;
}
