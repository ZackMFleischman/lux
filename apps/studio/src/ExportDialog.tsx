import { useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';

export function ExportDialog({ disabled, defaultName, create }: {
  disabled: boolean; defaultName: string;
  create(name: string): Promise<{ path: string; releaseId: string; runtimeId: string } | null>;
}) {
  const [open, setOpen] = useState(false), [name, setName] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  const pending = useRef(false);
  async function submit() {
    if (pending.current || !name.trim() || name.trim().length > 80) return;
    pending.current = true; setBusy(true); setError(''); setResult('');
    try { const exported = await create(name.trim()); if (exported) setResult(exported.path); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <><Button disabled={disabled} onClick={() => {
    setName(defaultName.replace(/\.lux-scene$/i, '')); setError(''); setResult(''); setOpen(true);
  }}>Export for Resolume</Button>
    <Dialog open={open} onClose={() => { if (!pending.current) setOpen(false); }} fullWidth maxWidth="sm" aria-labelledby="export-title">
      <DialogTitle id="export-title">Export for Resolume</DialogTitle>
      <DialogContent><Typography sx={{ mb: 2 }}>Validate the current visual and create a named source package. Each export preserves its own version.</Typography>
        <TextField autoFocus fullWidth label="Source name" value={name} disabled={busy} slotProps={{ htmlInput: { maxLength: 80 } }} onChange={event => setName(event.target.value)} />
        {busy && <Typography role="status" sx={{ mt: 2 }}>Validating and exporting… Choose a folder when prompted.</Typography>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {result && <><Alert severity="success" sx={{ mt: 2 }}>Source package created.</Alert>
          <TextField fullWidth multiline label="Package location" value={result} slotProps={{ input: { readOnly: true } }} sx={{ mt: 2 }} />
          <Typography sx={{ mt: 2 }}>Close Resolume, then open install.cmd in this folder. The installer will ask for Resolume’s Extra Effects folder. Your editable visual remains in Lux.</Typography></>}
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setOpen(false)}>{result ? 'Done' : 'Cancel'}</Button>
        <Button variant="contained" disabled={busy || !name.trim() || name.trim().length > 80} onClick={() => void submit()}>Choose folder and export</Button></DialogActions>
    </Dialog>
  </>;
}
