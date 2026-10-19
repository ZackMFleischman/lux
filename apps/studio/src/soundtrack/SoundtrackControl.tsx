import { Alert, Button, FormControlLabel, IconButton, Popover, Slider, Switch, TextField, Tooltip } from '@mui/material';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { SoundtrackPlayer } from './soundtrack-player.ts';
import type { SoundtrackClient } from './soundtrack-client.ts';
import type { SceneSoundtrack } from '../../../../packages/core/src/scene-soundtrack.ts';
import { soundtrackFileName, soundtrackMaxOffsetSeconds } from '../../../../packages/core/src/scene-soundtrack.ts';

export type SoundtrackControlProps = {
  player: SoundtrackPlayer; api?: SoundtrackClient;
  soundtrack: SceneSoundtrack | null; origin: string | null; disabled?: boolean;
  /** Returns false when the scene rejected the change; the player then keeps its current audio. */
  onChange(next: SceneSoundtrack | null): boolean; onResolved(absolutePath: string): void; onError(message: string): void;
};

function NoteIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 3v11.6A3.5 3.5 0 1 0 11 18V8h7V3H9z" /></svg>;
}
function SpeakerIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z" />
    {muted ? <path stroke="currentColor" strokeWidth="2" d="M16 9l5 6m0-6l-5 6" /> : <path fill="none" stroke="currentColor" strokeWidth="2" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />}</svg>;
}

/** Transport-row control for the scene soundtrack: link, relink, remove, offset, volume and session mute. */
export function SoundtrackControl({ player, api, soundtrack, origin, disabled, onChange, onResolved, onError }: SoundtrackControlProps) {
  const status = useSyncExternalStore(player.subscribe, player.getView);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [offsetDraft, setOffsetDraft] = useState(String(soundtrack?.offsetSeconds ?? 0));
  const [volumeDraft, setVolumeDraft] = useState(soundtrack?.volume ?? 1);
  const [offsetError, setOffsetError] = useState<string | null>(null);
  const offsetEditing = useRef(false), buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const callbacks = useRef({ onResolved, onError }); callbacks.current = { onResolved, onError };

  useEffect(() => { if (!offsetEditing.current) { setOffsetDraft(String(soundtrack?.offsetSeconds ?? 0)); setOffsetError(null); } setVolumeDraft(soundtrack?.volume ?? 1); },
    [soundtrack?.offsetSeconds, soundtrack?.volume]);
  useEffect(() => { player.setSettings({ offsetSeconds: soundtrack?.offsetSeconds ?? 0, volume: soundtrack?.volume ?? 1 }); },
    [player, soundtrack?.offsetSeconds, soundtrack?.volume]);
  // A soundtrack from an opened scene loads through the main process by scene file token.
  // A soundtrack chosen in this session already has its decoded buffer.
  const sha256 = soundtrack?.sha256 ?? null;
  useEffect(() => {
    if (!soundtrack) { player.setBuffer(null); player.setLink(null, 'none'); return; }
    if (!origin) return;
    const name = soundtrackFileName(soundtrack);
    if (!api) { player.setBuffer(null); player.setLink(name, 'error', 'Soundtrack loading is unavailable in this window.'); return; }
    let cancelled = false;
    player.setBuffer(null); player.setLink(name, 'loading');
    void api.loadLinked(origin).then(async result => {
      if (cancelled) return;
      if (result.status !== 'loaded') { player.setLink(name, 'unavailable', result.message); return; }
      const buffer = await player.decode(result.bytes);
      if (cancelled) return;
      player.setBuffer(buffer); player.setLink(name, 'loaded');
      callbacks.current.onResolved(result.absolutePath);
    }).catch(error => { if (!cancelled) player.setLink(name, 'error', `${name} could not be played. ${error instanceof Error ? error.message : String(error)}`); });
    return () => { cancelled = true; };
  }, [player, api, origin, sha256]);

  async function choose() {
    if (!api || choosing) return;
    setChoosing(true); onError('');
    try {
      const file = await api.choose();
      if (!file) return;
      let buffer;
      try { buffer = await player.decode(file.bytes); }
      catch { throw Error(`Lux could not decode ${file.name}. Use an MP3, WAV, OGG or M4A file.`); }
      // The scene must accept the link before the player switches audio.
      if (!onChange({ path: file.absolutePath, absolutePath: file.absolutePath, sha256: file.sha256,
        offsetSeconds: soundtrack?.offsetSeconds ?? 0, volume: soundtrack?.volume ?? 1 })) return;
      player.setBuffer(buffer); player.setLink(file.name, 'loaded');
    } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setChoosing(false); }
  }
  function remove() { if (!onChange(null)) return; setAnchor(null); player.setBuffer(null); player.setLink(null, 'none'); }
  function commitOffset() {
    offsetEditing.current = false;
    if (!soundtrack) return;
    const value = Number(offsetDraft);
    if (offsetDraft.trim() === '' || !Number.isFinite(value) || value < 0 || value > soundtrackMaxOffsetSeconds) {
      setOffsetError('Enter 0 to 86400 seconds'); return;
    }
    setOffsetError(null);
    if (value !== soundtrack.offsetSeconds && !onChange({ ...soundtrack, offsetSeconds: value })) setOffsetDraft(String(soundtrack.offsetSeconds));
  }
  function commitVolume(value: number) { if (soundtrack && value !== soundtrack.volume) onChange({ ...soundtrack, volume: value }); }

  const name = soundtrack ? soundtrackFileName(soundtrack) : null;
  const warning = status.state === 'unavailable' || status.state === 'error';
  const folder = soundtrack ? soundtrack.absolutePath.split(/[\\/]/).slice(-2, -1)[0] ?? '' : '';
  const stateText = !soundtrack ? 'No soundtrack' : status.state === 'loading' ? 'Loading…' : warning ? (status.state === 'unavailable' ? 'File unavailable' : 'Cannot play')
    : status.muted ? 'Muted' : 'Linked';
  const label = name ? `Soundtrack: ${name}. ${stateText}` : 'Soundtrack: none';
  return <span className="soundtrack-control" data-soundtrack-state={soundtrack ? status.state : 'none'}>
    <Tooltip title={warning ? status.message ?? stateText : name ? `Soundtrack · ${name}` : 'Add a soundtrack'}>
      <Button ref={buttonRef} size="small" color="inherit" className={`soundtrack-button${warning ? ' soundtrack-warning' : ''}`} aria-label={label}
        aria-haspopup="dialog" aria-expanded={!!anchor} aria-controls={anchor ? titleId : undefined} disabled={disabled}
        onClick={event => setAnchor(event.currentTarget)} startIcon={<NoteIcon />}>
        <span className="soundtrack-name">{name ?? 'Soundtrack'}</span>{warning && <span className="soundtrack-alert" aria-hidden="true">!</span>}
      </Button>
    </Tooltip>
    {soundtrack && <Tooltip title={status.muted ? 'Unmute soundtrack' : 'Mute soundtrack'}>
      <IconButton aria-label="Mute soundtrack" aria-pressed={status.muted} onClick={() => player.setSettings({ muted: !status.muted })}><SpeakerIcon muted={status.muted} /></IconButton>
    </Tooltip>}
    <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'top', horizontal: 'left' }} transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{ paper: { className: 'soundtrack-popover', role: 'dialog', 'aria-labelledby': `${titleId}-title`, id: titleId } as object }}
      onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
      <h2 id={`${titleId}-title`} className="soundtrack-title">Soundtrack</h2>
      <p className="soundtrack-file" role="status" aria-live="polite"><span className="soundtrack-file-name" title={soundtrack?.absolutePath}>{name ?? 'No file linked'}</span>{soundtrack && <span className="soundtrack-state">{stateText}</span>}</p>
      {warning && status.message && <Alert severity="warning" className="soundtrack-message">{status.message}
        {soundtrack && <Tooltip title={soundtrack.absolutePath}><span className="soundtrack-location" tabIndex={0} aria-label={`Last linked at ${soundtrack.absolutePath}`}>Last linked in folder “{folder || soundtrack.absolutePath}”</span></Tooltip>}</Alert>}
      <div className="soundtrack-actions">
        <Button size="small" variant="outlined" color="inherit" disabled={!api || choosing} onClick={() => void choose()}>{choosing ? 'Choosing…' : soundtrack ? (warning ? 'Relink file…' : 'Replace file…') : 'Choose soundtrack…'}</Button>
        {soundtrack && <Button size="small" color="inherit" onClick={remove}>Remove</Button>}
      </div>
      {soundtrack && <div className="soundtrack-settings">
        <TextField size="small" type="number" label="Offset (seconds)" value={offsetDraft}
          error={!!offsetError} helperText={offsetError ?? 'Song position at scene time 0'}
          onFocus={() => { offsetEditing.current = true; }} onChange={event => { offsetEditing.current = true; setOffsetError(null); setOffsetDraft(event.target.value); }}
          onBlur={commitOffset} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitOffset(); } }}
          slotProps={{ htmlInput: { min: 0, max: soundtrackMaxOffsetSeconds, step: 0.01, 'aria-label': 'Soundtrack offset seconds' } }} />
        <label className="soundtrack-volume"><span>Volume</span>
          <Slider size="small" min={0} max={1} step={0.01} value={volumeDraft} aria-label="Soundtrack volume"
            getAriaValueText={value => `${Math.round(value * 100)}%`} valueLabelDisplay="auto" valueLabelFormat={value => `${Math.round(value * 100)}%`}
            onChange={(_event, value) => { const next = value as number; setVolumeDraft(next); player.setSettings({ volume: next }); }}
            onChangeCommitted={(_event, value) => commitVolume(value as number)} />
        </label>
        <FormControlLabel control={<Switch size="small" checked={status.muted} onChange={event => player.setSettings({ muted: event.target.checked })} />} label="Mute (this session only)" />
      </div>}
      <p className="soundtrack-hint">Plays with Play, pauses with Pause and restarts with Reset. Follows scene time; Story beat seek and replay do not move it. Saved with the scene; loading a Look removes it.</p>
    </Popover>
  </span>;
}
