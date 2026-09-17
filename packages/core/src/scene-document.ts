import { z } from 'zod';
import { legacySourceBundleSchema, assetSourceBundleSchema, outputSettingsSchema, controlValuesSchema, INTENSITY_CONTROL, hashSchema } from '../../runtime-contracts/src/index.ts';
import type { SourceBundle, OutputSettings, ControlValues } from '../../runtime-contracts/src/index.ts';
import { validateSource, snapshotRecord } from '../../../apps/build-worker/src/source-policy.mjs';
import { normalizeControlSchema, validateControlSnapshot, canonicalControlSchemaJson } from '../../runtime-contracts/src/parameters.mjs';
import type { ControlSchema, ControlValues as ParameterValues } from '../../runtime-contracts/src/parameters.mjs';
import { nodeIdSchema } from '../../runtime-contracts/src/identities.ts';
import type { NodePath, DefinitionHash } from '../../runtime-contracts/src/graph.ts';
import { validateSceneLibraryLinks } from './component-library.ts';
import type { SceneLibraryLink } from './component-library.ts';
import {validateControlAnimationBindings} from '../../runtime-contracts/src/control-animation.mjs';
import type {ControlAnimationBinding} from '../../runtime-contracts/src/control-animation.mjs';
import {normalizeTempoSettings} from '../../runtime-contracts/src/tempo.mjs';
import type {SceneTempoSettings} from '../../runtime-contracts/src/tempo.mjs';
import {normalizeSceneStory} from '../../runtime-contracts/src/story.mjs';
import type {SceneStoryV1} from '../../runtime-contracts/src/story.mjs';
import {validateStorySceneDocumentV7,verifyStorySceneDocumentV7} from './story-scene-v2.ts';
import type {StorySceneDocumentV7} from './story-scene-v2.ts';
export type {StoryVisualSource,StorySceneDocumentV7} from './story-scene-v2.ts';

const legacySchema = z.object({ format: z.literal('lux-scene'), version: z.literal(1), source: legacySourceBundleSchema.extend({sdkVersion:z.literal('0.1.0')}), settings: outputSettingsSchema, controls: controlValuesSchema }).strict();
const schema = z.discriminatedUnion('version',[legacySchema,legacySchema.extend({version:z.literal(2),source:assetSourceBundleSchema.extend({sdkVersion:z.literal('0.1.0')})}).strict()]);
export type SavedControlSnapshot = Readonly<{sourceHash:string;schema:ControlSchema;schemaHash:string;values:ParameterValues}>;
type LegacySceneDocument = z.infer<typeof schema> & Readonly<{tempo:SceneTempoSettings;controlAnimations?:readonly ControlAnimationBinding[]}>;
export type ParameterSceneDocument = Readonly<{format:'lux-scene';version:3;source:SourceBundle;settings:OutputSettings;controls:SavedControlSnapshot;tempo:SceneTempoSettings;controlAnimations?:readonly ControlAnimationBinding[]}>;
export type SavedNodeControlSnapshot=Readonly<{sourceHash:string;nodes:readonly Readonly<{nodePath:NodePath;definitionHash:DefinitionHash;schema:ControlSchema;schemaHash:string;values:ParameterValues}>[]}>;
export type CompositionSceneDocument=Readonly<{format:'lux-scene';version:4;source:SourceBundle;settings:OutputSettings;controls:SavedNodeControlSnapshot;tempo:SceneTempoSettings;controlAnimations:readonly ControlAnimationBinding[]}>;
export type LinkedCompositionSceneDocument=Readonly<{format:'lux-scene';version:5;source:SourceBundle;settings:OutputSettings;controls:SavedNodeControlSnapshot;libraryLinks:readonly SceneLibraryLink[];tempo:SceneTempoSettings;controlAnimations:readonly ControlAnimationBinding[]}>;
export type StorySceneDocument = Readonly<Omit<ParameterSceneDocument,'version'> & {version:6;story?:SceneStoryV1}>;
export type SingleVisualSceneDocument = LegacySceneDocument | ParameterSceneDocument | CompositionSceneDocument | LinkedCompositionSceneDocument | StorySceneDocument;
export type SceneDocument = SingleVisualSceneDocument | StorySceneDocumentV7;

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
export function validateSavedNodeControlSnapshot(value:unknown):SavedNodeControlSnapshot{
 const raw=snapshotRecord(value,['sourceHash','nodes']);if(!Array.isArray(raw.nodes)||raw.nodes.length<1)throw Error('Saved composition nodes must contain at least one row');const seen=new Set<string>();const nodes=raw.nodes.map((value,index)=>{const row=snapshotRecord(value,['nodePath','definitionHash','schema','schemaHash','values']);if(!Array.isArray(row.nodePath)||row.nodePath.length<1||row.nodePath.length>8)throw Error('Invalid saved composition node path');const nodePath=Object.freeze(row.nodePath.map(id=>nodeIdSchema.parse(id))),path=JSON.stringify(nodePath);if(seen.has(path))throw Error('Duplicate saved composition node path');seen.add(path);const schema=normalizeControlSchema(row.schema);return Object.freeze({nodePath,definitionHash:hashSchema.parse(row.definitionHash),schema,schemaHash:hashSchema.parse(row.schemaHash),values:validateControlSnapshot(schema,row.values)});});return Object.freeze({sourceHash:hashSchema.parse(raw.sourceHash),nodes:Object.freeze(nodes)});
}
export async function verifySavedNodeControlSnapshot(value:unknown):Promise<SavedNodeControlSnapshot>{const snapshot=validateSavedNodeControlSnapshot(value);for(const node of snapshot.nodes)if(await sceneHash(canonicalControlSchemaJson(node.schema))!==node.schemaHash)throw Error('Saved node control schema hash mismatch');return snapshot;}
export async function verifySceneDocument(value:unknown):Promise<SceneDocument> {
  const document=validateSceneDocument(value);
  if(document.version===7)return verifyStorySceneDocumentV7(document);
  if(document.version===3||document.version===6) await verifySavedControlSnapshot(document.controls);else if(document.version===4||document.version===5)await verifySavedNodeControlSnapshot(document.controls);
  return document;
}
export async function sceneControlSnapshot(document:SceneDocument):Promise<SavedControlSnapshot|SavedNodeControlSnapshot> {
  if(document.version===7)throw Error('Scene v7 has multiple visual snapshots');
  if(document.version===3||document.version===6) return verifySavedControlSnapshot(document.controls);
  if(document.version===4||document.version===5)return verifySavedNodeControlSnapshot(document.controls);
  const schema=normalizeControlSchema([INTENSITY_CONTROL]);
  return Object.freeze({sourceHash:await sceneSourceHash(document.source),schema,schemaHash:await sceneHash(canonicalControlSchemaJson(schema)),values:validateControlSnapshot(schema,document.controls)});
}
export function validateSceneDocument(value: unknown): SceneDocument {
  // Validate raw records before schema cloning can erase inherited/accessor
  // properties and their provenance. Preserve legacy scene source ordering.
  const raw = snapshotRecord(value);
  if(raw.version===7)return validateStorySceneDocumentV7(value);
  const fields=raw.version===5?['format','version','source','settings','controls','libraryLinks']:['format','version','source','settings','controls'],optional=[...(Object.hasOwn(raw,'controlAnimations')?['controlAnimations']:[]),...(Object.hasOwn(raw,'tempo')?['tempo']:[]),...(raw.version===6&&Object.hasOwn(raw,'story')?['story']:[])];
  if(Object.keys(raw).length!==fields.length+optional.length||fields.some(field=>!Object.hasOwn(raw,field)))throw Error('Missing or unsupported scene fields');
  const source = validateSource(raw.source);
  const animations=Object.hasOwn(raw,'controlAnimations')?{controlAnimations:validateControlAnimationBindings(raw.controlAnimations)}:{};
  const tempo=normalizeTempoSettings(raw.tempo);
  if(raw.version===6) {
    if(raw.format!=='lux-scene'||source.sdkVersion!=='0.2.0')throw Error('Scene v6 requires SDK 0.2.0 source');
    const result:StorySceneDocument=Object.freeze({format:'lux-scene',version:6,source,settings:outputSettingsSchema.parse(snapshotRecord(raw.settings)),controls:validateSavedControlSnapshot(raw.controls),tempo,...animations,...(Object.hasOwn(raw,'story')?{story:normalizeSceneStory(raw.story)}:{})});
    if(new TextEncoder().encode(JSON.stringify(result,null,2)+'\n').byteLength>7340032)throw Error('Scene v6 JSON exceeds 7 MiB');
    return result;
  }
  if(raw.version===3) {
    if(raw.format!=='lux-scene' || source.sdkVersion!=='0.2.0') throw Error('Scene v3 requires SDK 0.2.0 source');
    const result:ParameterSceneDocument=Object.freeze({format:'lux-scene',version:3,source:source as SourceBundle,settings:outputSettingsSchema.parse(snapshotRecord(raw.settings)),controls:validateSavedControlSnapshot(raw.controls),tempo,...animations});
    if(new TextEncoder().encode(JSON.stringify(result,null,2)+'\n').byteLength>7340032) throw Error('Scene v3 JSON exceeds 7 MiB');
    return result;
  }
  if(raw.version===4){if(raw.format!=='lux-scene'||source.sdkVersion!=='0.4.0')throw Error('Scene v4 requires SDK 0.4.0 source');const result:CompositionSceneDocument=Object.freeze({format:'lux-scene',version:4,source,settings:outputSettingsSchema.parse(snapshotRecord(raw.settings)),controls:validateSavedNodeControlSnapshot(raw.controls),tempo,controlAnimations:validateControlAnimationBindings(raw.controlAnimations??[])});if(new TextEncoder().encode(JSON.stringify(result,null,2)+'\n').byteLength>7340032)throw Error('Scene v4 JSON exceeds 7 MiB');return result;}
  if(raw.version===5){if(raw.format!=='lux-scene'||source.sdkVersion!=='0.4.0')throw Error('Scene v5 requires SDK 0.4.0 source');const result:LinkedCompositionSceneDocument=Object.freeze({format:'lux-scene',version:5,source,settings:outputSettingsSchema.parse(snapshotRecord(raw.settings)),controls:validateSavedNodeControlSnapshot(raw.controls),libraryLinks:validateSceneLibraryLinks(raw.libraryLinks),tempo,controlAnimations:validateControlAnimationBindings(raw.controlAnimations??[])});if(new TextEncoder().encode(JSON.stringify(result,null,2)+'\n').byteLength>7340032)throw Error('Scene v5 JSON exceeds 7 MiB');return result;}
  const {controlAnimations:_animations,tempo:_tempo,...legacyRaw}=raw;
  const result = schema.parse({...legacyRaw,source:raw.version===2 ? source : raw.source,
    settings:snapshotRecord(raw.settings),controls:snapshotRecord(raw.controls)});
  const snapshot = {...result,...(result.version===2?{source:source as Extract<LegacySceneDocument,{version:2}>['source']} : {}),tempo,...animations};
  if (snapshot.version === 2 && new TextEncoder().encode(JSON.stringify(snapshot,null,2)+'\n').byteLength > 7340032) throw Error('Scene v2 JSON exceeds 7 MiB');
  return snapshot;
}
export function createSceneDocument(source: SourceBundle, settings: OutputSettings, controls: ControlValues | SavedControlSnapshot | SavedNodeControlSnapshot, libraryLinks:readonly SceneLibraryLink[]=[],controlAnimations:readonly ControlAnimationBinding[]=[],tempo:SceneTempoSettings=normalizeTempoSettings(),story:SceneStoryV1|null=null,retainStoryVersion=false): SingleVisualSceneDocument {
  if((story||retainStoryVersion)&&source.sdkVersion!=='0.2.0')throw Error('Story scenes require SDK 0.2.0 source');
  const links=validateSceneLibraryLinks(libraryLinks),version=source.sdkVersion==='0.4.0'?(links.length?5:4):source.sdkVersion==='0.2.0' ? (story||retainStoryVersion?6:3) : 'sourceVersion' in source ? 2 : 1;
  if(links.length&&version!==5)throw Error('Library links require SDK 0.4.0 composition source');
  const document=validateSceneDocument({format:'lux-scene',version,source,settings,controls,...(version===5?{libraryLinks:links}:{}),...(story?{story}:{}),tempo:normalizeTempoSettings(tempo),...((version===4||version===5||controlAnimations.length)?{controlAnimations}: {})});
  if(document.version===7)throw Error('Single-visual scene construction produced Scene v7');
  return document;
}
