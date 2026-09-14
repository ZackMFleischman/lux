import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

declare global {
  interface Window { luxConfirmation?: {
    onCloseRequest(listener: (id: string) => void): () => void;
    reply(id: string, discard: boolean): Promise<void>;
  } }
}
export function useDiscardConfirmation() {
  const [action, setAction] = useState<'open' | 'close' | 'load-look' | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);
  const settle = useCallback((value: boolean) => { const resolve = pending.current; pending.current = null; setAction(null); resolve?.(value); }, []);
  const confirm = useCallback((next: 'open' | 'close' | 'load-look'): Promise<boolean> => {
    if (pending.current) return Promise.resolve(false);
    return new Promise(resolve => { pending.current = resolve; setAction(next); });
  }, []);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  const dialog = <Dialog open={action !== null} onClose={() => settle(false)} aria-labelledby="discard-title" onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
    <DialogTitle id="discard-title">Discard unsaved changes?</DialogTitle>
    <DialogContent><DialogContentText>{action === 'close' ? 'Your unsaved changes will be lost when Lux closes.' : action === 'load-look' ? 'Load this look and discard your unsaved scene changes?' : 'Your unsaved changes will be lost if you open another scene.'}</DialogContentText></DialogContent>
    <DialogActions><Button autoFocus onClick={() => settle(false)}>Keep editing</Button><Button color="error" onClick={() => settle(true)}>{action === 'close' ? 'Discard and close' : action === 'load-look' ? 'Discard and load look' : 'Discard and open'}</Button></DialogActions>
  </Dialog>;
  return { confirm, dialog, isPending: () => pending.current !== null };
}
