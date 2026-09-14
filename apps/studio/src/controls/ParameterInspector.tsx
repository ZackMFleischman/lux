import type {NodePath} from '../../../../packages/runtime-contracts/src/graph.ts';
import { useEffect, useRef, useState } from 'react';
import { IconButton, Slider, TextField, Tooltip } from '@mui/material';
import { getRuntimeControlState } from '../service-client.ts';
import type { RuntimeView, StudioClient, StudioController } from '../service-client.ts';
import type { NumberControlDefinition } from '../../../../packages/runtime-contracts/src/parameters.mjs';
export type ControlEdits = { changed(): void; track(write: Promise<unknown>): void };

export function parameterOwner(runtime: RuntimeView | null, nodePath?:NodePath): string | null {
  return runtime?.authority === 'studio'
    ? JSON.stringify([runtime.instanceId, runtime.generation, runtime.revisionId, runtime.controlSchemaHash,nodePath??null]) : null;
}
function ParameterRow({ definition, displayLabel, applied, owner, available, client, controller, onError, edits, nodePath, description }: {
  definition: NumberControlDefinition; applied: number; owner: string | null; available: boolean;
  displayLabel: string; description?:string;
  client: StudioClient; controller: StudioController; onError: (error: string | null) => void;
  edits?: ControlEdits; nodePath?:NodePath;
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
    if (!available || !owner || parameterOwner(client.getSnapshot().authoring,nodePath) !== owner || !Number.isFinite(next) || next < definition.min || next > definition.max) return;
    const pending = {};
    intent.current = pending;
    setValue(next); setText(String(next)); onError(null);
    edits?.changed();
    try { const write = (nodePath?controller.setNodeParameters(nodePath,{[definition.id]:next}):controller.setParameters({ [definition.id]: next })); edits?.track(write); await write; }
    catch (error) {
      if (intent.current === pending && parameterOwner(client.getSnapshot().authoring,nodePath) === owner) onError(String(error));
    } finally {
      if (intent.current === pending) {
        intent.current = null;
        const current = client.getSnapshot();
        if (parameterOwner(current.authoring,nodePath) === owner && current.authoring) {
          const confirmed = (nodePath?current.authoring.nodeControls?.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(nodePath))?.values[definition.id]:getRuntimeControlState(current.authoring).controls[definition.id]) ?? applied;
          setValue(confirmed); if (!editing.current) setText(String(confirmed));
        }
      }
    }
  }
  function commitText() {
    editing.current = false;
    const next = text.trim() === '' ? NaN : Number(text);
    if (!Number.isFinite(next) || next < definition.min || next > definition.max) {
      setText(String(value)); onError(`${displayLabel} must be between ${definition.min} and ${definition.max}.`); return;
    }
    if (next !== value) void change(next);
  }
  const controlDescription = definition.description ?? description;
  const label = <label className="parameter-name" htmlFor={`parameter-${definition.id}`} {...(controlDescription ? { tabIndex: 0 } : { title: `${displayLabel}${definition.unit ? ` (${definition.unit})` : ''}` })}>{displayLabel}{definition.unit && <small> {definition.unit}</small>}</label>;
  return <div className="parameter-row" data-control-id={definition.id} data-applied-value={applied}>
    <div className="parameter-heading">
      {controlDescription ? <Tooltip title={controlDescription} placement="left-start" disableInteractive slotProps={{ tooltip: { className: 'control-description-tooltip' } }}>{label}</Tooltip> : label}
      <TextField id={`parameter-${definition.id}`} className="parameter-number" size="small" type="number" value={text} disabled={!available}
        slotProps={{ htmlInput: { 'aria-label': `${displayLabel} value`, min: definition.min, max: definition.max, step: definition.step ?? 'any' } }}
        onChange={event => { editing.current = true; setText(event.target.value); edits?.changed(); }}
        onBlur={commitText} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitText(); } if (event.key === 'Escape') { event.stopPropagation(); editing.current = false; setText(String(value)); } }} />
      <Tooltip title="Reset to default"><span><IconButton size="small" disabled={!available} aria-label={`Reset ${displayLabel} to default`} onClick={() => void change(definition.default)}>↺</IconButton></span></Tooltip>
    </div>
    {description&&<p className="hint">{description}</p>}
    <Slider size="small" aria-label={displayLabel} min={definition.min} max={definition.max}
      step={definition.step ?? (definition.max - definition.min) / 100} value={value} disabled={!available}
      onChange={(_event, next) => { if (typeof next === 'number') void change(next); }} />
  </div>;
}
export function ParameterInspector({ runtime, available, client, controller, onError, edits, nodePath }: {
  runtime: RuntimeView | null; available: boolean; client: StudioClient; controller: StudioController;
  onError: (error: string | null) => void;
  edits?: ControlEdits; nodePath?:NodePath;
}) {
  if (!runtime) return <p className="hint">Build a visual to see its controls.</p>;
  const node=nodePath?runtime.nodeControls?.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(nodePath)):null;
  if(nodePath&&!node)return <p className="hint">This node is no longer available. Select another node.</p>;
  const state=node?{controlSchema:node.schema,controls:node.values}:getRuntimeControlState(runtime), owner = parameterOwner(runtime,nodePath);
  const labelCounts = new Map<string, number>();
  for (const definition of state.controlSchema) labelCounts.set(definition.label, (labelCounts.get(definition.label) ?? 0) + 1);
  const displayLabel = (definition: NumberControlDefinition) => labelCounts.get(definition.label)! > 1 ? `${definition.id} · ${definition.label}` : definition.label;
  return <>{state.controlSchema.length === 0 && <p className="hint">This visual defines no live controls.</p>}
    {state.controlSchema.map(definition => <ParameterRow key={`${owner}:${definition.id}`} definition={definition} displayLabel={displayLabel(definition)}
      description={node&&runtime.composition?runtime.composition.definitions[node.definitionHash]?.metadata.controlDescriptions[definition.id]:undefined} applied={state.controls[definition.id]!} owner={owner} available={available} client={client} controller={controller} onError={onError} edits={edits} nodePath={nodePath} />)}
    {!!runtime.controlMigration?.length && <details><summary>Controls updated</summary>{runtime.controlMigration.map(change => <p key={change.id}>{change.id}: {change.reason.replaceAll('-', ' ')}</p>)}</details>}
  </>;
}
