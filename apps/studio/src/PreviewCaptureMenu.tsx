import { IconButton, MenuItem, Tooltip } from '@mui/material';
import { StudioMenu } from './StudioMenu.tsx';
import type { PreviewRecorderSnapshot } from './preview-recorder.ts';
import { shortcutHint } from './studio-shortcuts.ts';

export type PreviewCaptureActionsProps = {
  available: boolean; status: PreviewRecorderSnapshot;
  onSaveFrame(): Promise<void>; onStart(): Promise<void>; onStop(): Promise<void>;
};

function statusText(status: PreviewRecorderSnapshot): string {
  if (status.phase === 'idle') return '';
  const dimensions = `${status.width} × ${status.height}`;
  return status.phase === 'stopping' ? `Finishing recording ${dimensions}` : `Recording ${dimensions}`;
}

export function PreviewCaptureActions({ available, status, onSaveFrame, onStart, onStop }: PreviewCaptureActionsProps) {
  const active = status.phase !== 'idle';
  const stopping = status.phase === 'stopping';
  return <div className="preview-capture-actions" aria-label="Preview capture actions">
    <Tooltip title={`Save frame PNG (${shortcutHint['save-frame']})`}><span><IconButton aria-label="Save frame PNG" disabled={!available || active} onClick={() => void onSaveFrame()}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 6h4l1.4-2h5.2L16 6h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2m8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6" /></svg>
    </IconButton></span></Tooltip>
    <Tooltip title={`${stopping ? 'Finishing recording' : active ? 'Stop recording' : 'Record video'} (${shortcutHint['toggle-recording']})`}><span><IconButton aria-label={active ? 'Stop recording' : 'Record video'} disabled={!available || stopping} onClick={() => void (active ? onStop() : onStart())}>
      {active ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" /></svg>
        : <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="currentColor" /></svg>}
    </IconButton></span></Tooltip>
    {active && <span className="preview-recording-status"><i aria-hidden="true" />{statusText(status)}</span>}
  </div>;
}

export function PreviewCaptureMenu({ available, status, onSaveFrame, onStart, onStop }: PreviewCaptureActionsProps) {
  const active = status.phase !== 'idle';
  const dimensions = active ? `${status.width} × ${status.height}` : '';
  return <>
    <StudioMenu label={active ? 'Preview · REC' : 'Preview'} className="preview-capture-menu">
      <MenuItem disabled={!available || active} onClick={() => void onSaveFrame()}><span>Save frame PNG</span><span className="studio-shortcut-hint" aria-hidden="true">{shortcutHint['save-frame']}</span></MenuItem>
      {active
        ? <MenuItem disabled={status.phase === 'stopping'} onClick={() => void onStop()}><span>Stop recording</span><span className="studio-shortcut-hint" aria-hidden="true">{shortcutHint['toggle-recording']}</span></MenuItem>
        : <MenuItem disabled={!available} onClick={() => void onStart()}><span>Record video</span><span className="studio-shortcut-hint" aria-hidden="true">{shortcutHint['toggle-recording']}</span></MenuItem>}
      {active && <MenuItem disabled>{status.phase === 'stopping' ? 'Finishing' : 'Recording'} {dimensions} · WebM</MenuItem>}
    </StudioMenu>
    {active && <span className="preview-recording-status" role="status">
      <i aria-hidden="true" />{statusText(status)}
    </span>}
  </>;
}
