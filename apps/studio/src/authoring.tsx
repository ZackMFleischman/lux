import { useEffect, useState } from 'react';
import { Alert, Button, TextField, ThemeProvider } from '@mui/material';
import { StudioApp } from './renderer.tsx';
import { studioTheme } from './theme.ts';
import { StandaloneClient } from './standalone-client.ts';
const client = new StandaloneClient(window.luxAuthoring);
export function AuthoringApp() {
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { void window.luxAuthoring.example().then(async source => {
    setCode(source.files[source.entry] ?? '');
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
        await new Promise(resolve => setTimeout(resolve, 500));
        await window.luxAuthoring.smokeResult?.({ ok: true, initial, applied, invalidRejected, capture });
      } catch (error) { setError(String(error)); await window.luxAuthoring.smokeResult?.({ ok: false, error: String(error), snapshot: client.getSnapshot() }); }
    }
  }).catch(reason => setError(String(reason))); }, []);
  async function build() { setBusy(true); setError(''); try { await client.submit({ sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': code } }); } catch (reason) { setError(String(reason)); } finally { setBusy(false); } }
  return <ThemeProvider theme={studioTheme}><div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <details style={{ padding: '8px 16px', background: '#191b23', flexShrink: 0 }}><summary>Visual source</summary>
      <TextField fullWidth multiline minRows={8} maxRows={16} label="TypeScript visual" value={code} onChange={event => setCode(event.target.value)}
        slotProps={{ input: { style: { fontFamily: 'Consolas, monospace', fontSize: 12 } } }} />
    </details><div style={{ padding: '4px 16px', background: '#191b23' }}><Button variant="contained" disabled={busy || !code} onClick={() => void build()}>{busy ? 'Building…' : 'Build & preview'}</Button>
      {error && <Alert severity="error">{error}</Alert>}</div>
    <div style={{ flex: 1, minHeight: 0 }}><StudioApp client={client} presentation={client} windows={window.luxStudioWindows ? { ...window.luxStudioWindows,
      popout: async () => { throw Error('Separate preview windows are not connected in this standalone checkpoint. Fullscreen is available.'); } } : undefined} /></div>
  </div></ThemeProvider>;
}
