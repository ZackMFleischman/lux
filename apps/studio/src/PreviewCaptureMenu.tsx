import { MenuItem } from '@mui/material';
import { StudioMenu } from './StudioMenu.tsx';
import type { PreviewRecorderSnapshot } from './preview-recorder.ts';

export function PreviewCaptureMenu({ available, status, onSaveFrame, onStart, onStop }: {
  available: boolean; status: PreviewRecorderSnapshot;
  onSaveFrame(): Promise<void>; onStart(): Promise<void>; onStop(): Promise<void>;
}) {
  const active = status.phase !== 'idle';
  const dimensions = active ? `${status.width} × ${status.height}` : '';
  return <>
    <StudioMenu label={active ? 'Preview · REC' : 'Preview'} className="preview-capture-menu">
      <MenuItem disabled={!available || active} onClick={() => void onSaveFrame()}>Save frame PNG</MenuItem>
      {active
        ? <MenuItem onClick={() => void onStop()}>Stop recording</MenuItem>
        : <MenuItem disabled={!available} onClick={() => void onStart()}>Record video</MenuItem>}
      {active && <MenuItem disabled>{status.phase === 'stopping' ? 'Finishing' : 'Recording'} {dimensions} · WebM</MenuItem>}
    </StudioMenu>
    {active && <span className="preview-recording-status" role="status">
      <i aria-hidden="true" />{status.phase === 'stopping' ? 'Finishing recording' : `Recording ${dimensions}`}
    </span>}
  </>;
}
