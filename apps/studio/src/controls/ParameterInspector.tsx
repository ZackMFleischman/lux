import { useEffect, useRef, useState } from 'react';
import { IconButton, Slider, TextField, Tooltip } from '@mui/material';
import { getRuntimeControlState } from '../service-client.ts';
import type { RuntimeView, StudioClient, StudioController } from '../service-client.ts';
import type { NumberControlDefinition } from '../../../../packages/runtime-contracts/src/parameters.mjs';
export type ControlEdits = { changed(): void; track(write: Promise<unknown>): void };

export function parameterOwner(runtime: RuntimeView | null): string | null {
  return runtime?.authority === 'studio'
    ? JSON.stringify([runtime.instanceId, runtime.generation, runtime.revisionId, runtime.controlSchemaHash]) : null;
}
function ParameterRow({ definition, applied, owner, available, client, controller, onError, edits }: {
  definition: NumberControlDefinition; applied: number; owner: string | null; available: boolean;
  client: StudioClient; controller: StudioController; onError: (error: string | null) => void;
  edits?: ControlEdits;
}) {
  const [value, setValue] = useState(applied);
  const [text, setText] = useState(String(applied));
  const intent = useRef<object | null>(null);
  const editing = useRef(false);
  useEffect(() => {
    if (intent.current) return;
    setValue(applied);
    if (!editing.current) setText(String(applied));
  }, [applied]);
  useEffect(() => () => { intent.current = null; }, []);
  async function change(next: number) {
    if (!available || !owner || parameterOwner(client.getSnapshot().authoring) !== owner || !Number.isFinite(next) || next < definition.min || next > definition.max) return;
    const pending = {};
    intent.current = pending;
    setValue(next); setText(String(next)); onError(null);
    edits?.changed();
    try { const write = controller.setParameters({ [definition.id]: next }); edits?.track(write); await write; }
    catch (error) {
      if (intent.current === pending && parameterOwner(client.getSnapshot().authoring) === owner) onError(String(error));
    } finally {
      if (intent.current === pending) {
        intent.current = null;
        const current = client.getSnapshot();
        if (parameterOwner(current.authoring) === owner && current.authoring) {
          const confirmed = getRuntimeControlState(current.authoring).controls[definition.id]!;
          setValue(confirmed); if (!editing.current) setText(String(confirmed));
        }
      }
    }
  }
  function commitText() {
    editing.current = false;
    const next = text.trim() === '' ? NaN : Number(text);
    if (!Number.isFinite(next) || next < definition.min || next > definition.max) {
      setText(String(value)); onError(`${definition.label} must be between ${definition.min} and ${definition.max}.`); return;
    }
    if (next !== value) void change(next);
  }
  return <div className="parameter-row" data-control-id={definition.id} data-applied-value={applied}>
    <div className="parameter-heading">
      <label className="parameter-name" htmlFor={`parameter-${definition.id}`} title={`${definition.label}${definition.unit ? ` (${definition.unit})` : ''}`}>{definition.label}{definition.unit && <small> {definition.unit}</small>}</label>
      <TextField id={`parameter-${definition.id}`} className="parameter-number" size="small" type="number" value={text} disabled={!available}
        slotProps={{ htmlInput: { 'aria-label': `${definition.label} value`, min: definition.min, max: definition.max, step: definition.step ?? 'any' } }}
        onChange={event => { editing.current = true; setText(event.target.value); edits?.changed(); }}
        onBlur={commitText} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitText(); } if (event.key === 'Escape') { event.stopPropagation(); editing.current = false; setText(String(value)); } }} />
      <Tooltip title="Reset to default"><span><IconButton size="small" disabled={!available} aria-label={`Reset ${definition.label} to default`} onClick={() => void change(definition.default)}>↺</IconButton></span></Tooltip>
    </div>
    <Slider size="small" aria-label={definition.label} min={definition.min} max={definition.max}
      step={definition.step ?? (definition.max - definition.min) / 100} value={value} disabled={!available}
      onChange={(_event, next) => { if (typeof next === 'number') void change(next); }} />
  </div>;
}
export function ParameterInspector({ runtime, available, client, controller, onError, edits }: {
  runtime: RuntimeView | null; available: boolean; client: StudioClient; controller: StudioController;
  onError: (error: string | null) => void;
  edits?: ControlEdits;
}) {
  if (!runtime) return <p className="hint">Build a visual to see its controls.</p>;
  const state = getRuntimeControlState(runtime), owner = parameterOwner(runtime);
  return <>{state.controlSchema.length === 0 && <p className="hint">This visual defines no live controls.</p>}
    {state.controlSchema.map(definition => <ParameterRow key={`${owner}:${definition.id}`} definition={definition}
      applied={state.controls[definition.id]!} owner={owner} available={available} client={client} controller={controller} onError={onError} edits={edits} />)}
    {!!runtime.controlMigration?.length && <details><summary>Controls updated</summary>{runtime.controlMigration.map(change => <p key={change.id}>{change.id}: {change.reason.replaceAll('-', ' ')}</p>)}</details>}
  </>;
}
