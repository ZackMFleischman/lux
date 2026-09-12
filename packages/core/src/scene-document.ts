import { z } from 'zod';
import { legacySourceBundleSchema, assetSourceBundleSchema, outputSettingsSchema, controlValuesSchema, INTENSITY_CONTROL, hashSchema } from '../../runtime-contracts/src/index.ts';
import type { SourceBundle, OutputSettings, ControlValues } from '../../runtime-contracts/src/index.ts';
import { validateSource, snapshotRecord } from '../../../apps/build-worker/src/source-policy.mjs';
import { normalizeControlSchema, validateControlSnapshot, canonicalControlSchemaJson } from '../../runtime-contracts/src/parameters.mjs';
import type { ControlSchema, ControlValues as ParameterValues } from '../../runtime-contracts/src/parameters.mjs';

const legacySchema = z.object({ format: z.literal('lux-scene'), version: z.literal(1), source: legacySourceBundleSchema.extend({sdkVersion:z.literal('0.1.0')}), settings: outputSettingsSchema, controls: controlValuesSchema }).strict();
const schema = z.discriminatedUnion('version',[legacySchema,legacySchema.extend({version:z.literal(2),source:assetSourceBundleSchema.extend({sdkVersion:z.literal('0.1.0')})}).strict()]);
export type SavedControlSnapshot = Readonly<{sourceHash:string;schema:ControlSchema;schemaHash:string;values:ParameterValues}>;
type LegacySceneDocument = z.infer<typeof schema>;
export type ParameterSceneDocument = Readonly<{format:'lux-scene';version:3;source:SourceBundle;settings:OutputSettings;controls:SavedControlSnapshot}>;
export type SceneDocument = LegacySceneDocument | ParameterSceneDocument;

/** Synchronous data validation; persisted/admitted caches also require verifySceneDocument. */
export function validateSavedControlSnapshot(value:unknown): SavedControlSnapshot {
  const raw=snapshotRecord(value,['sourceHash','schema','schemaHash','values']);
  const schema=normalizeControlSchema(raw.schema);
  return Object.freeze({sourceHash:hashSchema.parse(raw.sourceHash),schema,schemaHash:hashSchema.parse(raw.schemaHash),values:validateControlSnapshot(schema,raw.values)});
}
export async function sceneHash(text:string):Promise<string> {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function sceneSourceHash(source:SourceBundle):Promise<string> { return sceneHash(JSON.stringify(validateSource(source))); }
export async function verifySavedControlSnapshot(value:unknown):Promise<SavedControlSnapshot> {
  const snapshot=validateSavedControlSnapshot(value);
  if(await sceneHash(canonicalControlSchemaJson(snapshot.schema))!==snapshot.schemaHash) throw Error('Saved control schema hash mismatch');
  return snapshot;
}
export async function verifySceneDocument(value:unknown):Promise<SceneDocument> {
  const document=validateSceneDocument(value);
  if(document.version===3) await verifySavedControlSnapshot(document.controls);
  return document;
}
export async function sceneControlSnapshot(document:SceneDocument):Promise<SavedControlSnapshot> {
  if(document.version===3) return verifySavedControlSnapshot(document.controls);
  const schema=normalizeControlSchema([INTENSITY_CONTROL]);
  return Object.freeze({sourceHash:await sceneSourceHash(document.source),schema,schemaHash:await sceneHash(canonicalControlSchemaJson(schema)),values:validateControlSnapshot(schema,document.controls)});
}
export function validateSceneDocument(value: unknown): SceneDocument {
  // Validate raw records before schema cloning can erase inherited/accessor
  // properties and their provenance. Preserve legacy scene source ordering.
  const raw = snapshotRecord(value,['format','version','source','settings','controls']);
  const source = validateSource(raw.source);
  if(raw.version===3) {
    if(raw.format!=='lux-scene' || source.sdkVersion!=='0.2.0') throw Error('Scene v3 requires SDK 0.2.0 source');
    const result:ParameterSceneDocument=Object.freeze({format:'lux-scene',version:3,source:source as SourceBundle,settings:outputSettingsSchema.parse(snapshotRecord(raw.settings)),controls:validateSavedControlSnapshot(raw.controls)});
    if(new TextEncoder().encode(JSON.stringify(result,null,2)+'\n').byteLength>7340032) throw Error('Scene v3 JSON exceeds 7 MiB');
    return result;
  }
  const result = schema.parse({...raw,source:raw.version===2 ? source : raw.source,
    settings:snapshotRecord(raw.settings),controls:snapshotRecord(raw.controls)});
  const snapshot = result.version === 2 ? {...result,source:source as Extract<LegacySceneDocument,{version:2}>['source']} : result;
  if (snapshot.version === 2 && new TextEncoder().encode(JSON.stringify(snapshot,null,2)+'\n').byteLength > 7340032) throw Error('Scene v2 JSON exceeds 7 MiB');
  return snapshot;
}
export function createSceneDocument(source: SourceBundle, settings: OutputSettings, controls: ControlValues | SavedControlSnapshot): SceneDocument {
  return validateSceneDocument({format:'lux-scene',version:source.sdkVersion==='0.2.0' ? 3 : 'sourceVersion' in source ? 2 : 1,source,settings,controls});
}
