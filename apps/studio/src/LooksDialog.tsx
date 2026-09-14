import {useEffect, useRef, useState} from 'react';
import {Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField} from '@mui/material';
import type {LookSummary} from '../../../packages/core/src/look-store.ts';
import type {LookClient} from './look-client.ts';

export function LooksDialog({open, onClose, client, onSave, onLoad}: {
  open: boolean; onClose(): void; client: LookClient;
  onSave(name: string, selected?: LookSummary): Promise<{look: LookSummary; thumbnail: boolean}>;
  onLoad(id: string): Promise<boolean>;
}) {
  const [rows, setRows] = useState<readonly LookSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const locked = useRef(false);
  const current = rows.find(row => row.id === selected && !row.error);
  async function refresh() { setRows(await client.list()); }
  useEffect(() => { if (open) void refresh().catch(reason => setError(String(reason))); }, [open, client]);
  async function run(operation: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    try { await operation(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { locked.current = false; setBusy(false); }
  }
  async function save(update: boolean) {
    await run(async () => {
      const result = await onSave(name, update ? current : undefined);
      await refresh(); setSelected(result.look.id); setName(result.look.name);
      setMessage(result.thumbnail ? `Saved ${result.look.name}.` : `Saved ${result.look.name}; thumbnail unavailable.`);
    });
  }
  return <Dialog open={open} onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm" aria-labelledby="looks-title" className="looks-dialog">
    <DialogTitle id="looks-title" sx={{px: 2, py: 1}}>Looks</DialogTitle>
    <DialogContent sx={{px: 2, py: 1}}>
      <p className="hint">Save the working preview with its controls, animation, and resolution. Source edits need a build first.</p>
      <div className="look-save-row">
        <TextField label="Look name" size="small" value={name} onChange={event => setName(event.target.value)} disabled={busy} slotProps={{htmlInput: {maxLength: 80}}} />
        <Button variant="contained" disabled={busy || !name.trim()} onClick={() => void save(false)}>Save as new</Button>
      </div>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <p role="status">{message}</p>}
      <div className="look-list" role="list" aria-label="Saved looks" aria-busy={busy}>
        {!rows.length && <p className="hint">No saved looks yet.</p>}
        {rows.map(row => <div className={`look-row${selected === row.id ? ' selected' : ''}`} key={row.id} role="listitem">
          <button type="button" className="look-select" disabled={busy || !!row.error} aria-pressed={selected === row.id} onClick={() => { setSelected(row.id); setName(row.name); }}>
            {row.thumbnail ? <img src={row.thumbnail} alt="" /> : <span className="look-placeholder" aria-hidden="true">◇</span>}
            <span><strong>{row.name}</strong><small>{row.error || new Date(row.updatedAt).toLocaleString()}</small></span>
          </button>
          <Button disabled={busy || !!row.error} aria-label={`Load ${row.name}`} onClick={() => void run(async () => { if (await onLoad(row.id)) {setSelected(row.id); setName(row.name); setMessage(`Loaded ${row.name}.`);} })}>Load</Button>
        </div>)}
      </div>
    </DialogContent>
    <DialogActions sx={{px: 2, py: 1, flexWrap: 'wrap'}}>
      <Button disabled={busy} onClick={() => void run(refresh)}>Refresh</Button>
      <Button disabled={busy || !current || !name.trim()} onClick={() => void save(true)}>{current ? `Update “${current.name}”` : 'Update selected look'}</Button>
      <Button disabled={busy} onClick={onClose}>Done</Button>
    </DialogActions>
  </Dialog>;
}
