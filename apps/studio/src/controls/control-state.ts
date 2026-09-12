import { canonicalControlSchemaJson, normalizeControlSchema, reconcileControlValues, validateControlSnapshot } from '../../../../packages/runtime-contracts/src/parameters.mjs';
import type { ControlSchema, ControlValues } from '../../../../packages/runtime-contracts/src/parameters.mjs';
import { snapshotRecord } from '../../../build-worker/src/source-policy.mjs';
export type SavedControlSnapshot = Readonly<{sourceHash:string;schema:ControlSchema;schemaHash:string;values:ControlValues}>;
export type RuntimeControlState = Readonly<{sdkVersion:'0.1.0'|'0.2.0';controlSchema:ControlSchema;controlSchemaHash:string;controls:ControlValues;controlSequence:number}>;
export const LEGACY_CONTROL_SCHEMA: ControlSchema = normalizeControlSchema([{id:'intensity',type:'number',label:'Intensity',default:0.5,min:0,max:1,changeCost:'live'}]);
export const LEGACY_CONTROL_SCHEMA_HASH = '2f686a688523e2aa6e5368cd286974b87b324cfa4c67507563658b25cadd5a87';
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), value=>value.toString(16).padStart(2,'0')).join('');
}
export async function validateSavedControls(input: unknown): Promise<SavedControlSnapshot> {
  const raw=snapshotRecord(input,['sourceHash','schema','schemaHash','values']);
  if(typeof raw.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(raw.sourceHash))throw Error('Invalid saved source hash');
  const schema=normalizeControlSchema(raw.schema), schemaHash=await sha256(new TextEncoder().encode(canonicalControlSchemaJson(schema)));
  if(raw.schemaHash!==schemaHash)throw Error('Saved control schema hash mismatch');
  return Object.freeze({sourceHash:raw.sourceHash,schema,schemaHash,values:validateControlSnapshot(schema,raw.values)});
}
export function initialControlValues(schema:ControlSchema, previous?:Readonly<{schema:ControlSchema;values:ControlValues}>) {
  return reconcileControlValues(previous?.schema??[],previous?.values??{},schema);
}
