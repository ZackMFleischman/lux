import { useEffect, useState, useRef, useMemo } from 'react';
import { Alert, Button, TextField, ThemeProvider } from '@mui/material';
import { StudioApp } from './renderer.tsx';
import { studioTheme } from './theme.ts';
import { StandaloneClient } from './standalone-client.ts';
import { DEFAULT_OUTPUT } from '../../../packages/runtime-contracts/src/index.ts';
import type { SourceBundle } from '../../../packages/runtime-contracts/src/index.ts';
import { dispatchRuntimeCommand } from './runtime-operations.ts';
const client = new StandaloneClient(window.luxAuthoring);
export function AuthoringApp() {
  const windows = useMemo(() => window.luxStudioWindows ? { ...window.luxStudioWindows,
    popout: async () => { throw Error('Separate preview windows are not connected in this standalone checkpoint. Fullscreen is available.'); } } : undefined, []);
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [bundle, setBundle] = useState<SourceBundle | null>(null), [token, setToken] = useState<string | undefined>(), [name, setName] = useState('Untitled'), [dirty, setDirty] = useState(false);
  const draft = useRef<{ source: SourceBundle | null; version: number; busy: boolean }>({ source: null, version: 0, busy: false });
  draft.current.busy = busy;
  useEffect(() => window.luxAuthoring.onAgentCommand(async command => {
    if (['parameters', 'playback', 'restart'].includes(command.method)) return dispatchRuntimeCommand(client, command.method, command.params);
    if (command.method === 'status') return client.getSnapshot();
    if (command.method === 'read') return { source: draft.current.source, draftVersion: draft.current.version, status: client.getSnapshot() };
    if (command.method === 'capture') {
      const capture = await client.capture(), bytes = new Uint8Array(capture.bytes);
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { base64: btoa(binary), metadata: capture.metadata };
    }
    if (command.method !== 'build' || draft.current.busy) throw Error('Studio is busy or command is unsupported');
    if (command.params?.expectedDraftVersion !== draft.current.version) throw Error('Editor changed; read its source again before building');
    const source = command.params.source as SourceBundle;
    setBusy(true); draft.current.busy = true; setError('');
    try {
      await client.submit(source);
      draft.current = { source: structuredClone(source), version: draft.current.version + 1, busy: true };
      setBundle(source); setCode(source.files[source.entry] ?? ''); setDirty(true);
      return { draftVersion: draft.current.version, status: client.getSnapshot() };
    } catch (reason) { setError(String(reason)); throw reason; }
    finally { setBusy(false); draft.current.busy = false; }
  }), []);
  useEffect(() => { void window.luxAuthoring.dirty(dirty); }, [dirty]);
  useEffect(() => {
    let value = client.getSnapshot().authoring?.intensity;
    return client.subscribe(() => { const next = client.getSnapshot().authoring?.intensity; if (value !== undefined && next !== undefined && next !== value) setDirty(true); value = next; });
  }, []);
  useEffect(() => { void window.luxAuthoring.example().then(async source => {
    setCode(source.files[source.entry] ?? '');
    setBundle(source);
    draft.current.source = source; draft.current.version++;
    if (await window.luxAuthoring.smokeEnabled?.()) {
      try {
        await client.submit(source);
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
        const roundtrip = await window.luxAuthoring.smokeSave({ format: 'lux-scene', version: 1, source, settings: DEFAULT_OUTPUT, controls: { intensity: applied.intensity } });
        if (roundtrip.document.source.entry !== source.entry || roundtrip.document.source.sdkVersion !== source.sdkVersion ||
            roundtrip.document.source.files[source.entry] !== source.files[source.entry] || roundtrip.document.controls.intensity !== 0.8) throw Error('Save/reopen did not preserve the visual');
        await new Promise(resolve => setTimeout(resolve, 500));
        await window.luxAuthoring.smokeResult?.({ ok: true, initial, applied, invalidRejected, capture, savedAndReopened: true });
      } catch (error) { setError(String(error)); await window.luxAuthoring.smokeResult?.({ ok: false, error: String(error), snapshot: client.getSnapshot() }); }
    }
  }).catch(reason => setError(String(reason))); }, []);
  function currentSource(): SourceBundle { return bundle ? { ...bundle, files: { ...bundle.files, [bundle.entry]: code } } : { sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': code } }; }
  async function build() { setBusy(true); setError(''); try { await client.submit(currentSource()); } catch (reason) { setError(String(reason)); } finally { setBusy(false); } }
  async function save(saveAs = false) {
    setBusy(true); setError('');
    try { const result = await window.luxAuthoring.save({ token, saveAs, document: { format: 'lux-scene', version: 1, source: currentSource(), settings: DEFAULT_OUTPUT, controls: { intensity: client.getSnapshot().authoring?.intensity ?? 0.5 } } });
      if (result) { setToken(result.token); setName(result.name); setDirty(false); }
    } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  }
  async function open() {
    if (dirty && !window.confirm('Discard unsaved changes and open another visual?')) return;
    setBusy(true); setError('');
    try { const result = await window.luxAuthoring.open(); if (!result) return;
      const document = result.document;
      if (document.settings.width !== 1920 || document.settings.height !== 1080 || document.settings.fps !== 60 || document.settings.seed !== 0) throw Error('This build supports 1920×1080 at 60 fps with seed 0');
      setBundle(document.source); setCode(document.source.files[document.source.entry]); setToken(result.token); setName(result.name); setDirty(false);
      draft.current.source = document.source; draft.current.version++;
      await client.submit(document.source);
      const runtime = client.getSnapshot().authoring!;
      await client.invoke({ name: 'lux.parameters.set', input: { requestId: crypto.randomUUID(), instanceId: runtime.instanceId, expectedGeneration: runtime.generation, expectedRevisionId: runtime.revisionId, values: document.controls, mode: 'live' } });
      setDirty(false);
    } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  }
  return <ThemeProvider theme={studioTheme}><div className="authoring-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <details className="authoring-tools" style={{ padding: '8px 16px', background: '#191b23', flexShrink: 0 }}><summary>Visual source</summary>
      <TextField disabled={busy} fullWidth multiline minRows={8} maxRows={16} label="TypeScript visual" value={code} onChange={event => { setCode(event.target.value); setDirty(true);
        const source = currentSource(); source.files[source.entry] = event.target.value; draft.current.source = source; draft.current.version++; }}
        slotProps={{ input: { style: { fontFamily: 'Consolas, monospace', fontSize: 12 } } }} />
    </details><div className="authoring-tools" style={{ padding: '4px 16px', background: '#191b23' }}><Button variant="contained" disabled={busy || !code} onClick={() => void build()}>{busy ? 'Building…' : 'Build & preview'}</Button>
      <Button disabled={busy} onClick={() => void open()}>Open</Button><Button disabled={busy || !code} onClick={() => void save()}>Save</Button><Button disabled={busy || !code} onClick={() => void save(true)}>Save as</Button><span>{name}{dirty ? ' *' : ''}</span>
      {error && <Alert severity="error">{error}</Alert>}</div>
    <div style={{ flex: 1, minHeight: 0 }}><StudioApp client={client} presentation={client} windows={windows} /></div>
  </div></ThemeProvider>;
}
