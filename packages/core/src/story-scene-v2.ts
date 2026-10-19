import {outputSettingsSchema,hashSchema} from '../../runtime-contracts/src/index.ts';
import type {SourceBundle,OutputSettings} from '../../runtime-contracts/src/index.ts';
import {validateSource,snapshotRecord} from '../../../apps/build-worker/src/source-policy.mjs';
import {formatBytes} from '../../assets/src/index.mjs';
import {normalizeControlSchema,validateControlSnapshot,canonicalControlSchemaJson} from '../../runtime-contracts/src/parameters.mjs';
import {validateControlAnimationBindings} from '../../runtime-contracts/src/control-animation.mjs';
import type {ControlAnimationBinding} from '../../runtime-contracts/src/control-animation.mjs';
import {normalizeTempoSettings} from '../../runtime-contracts/src/tempo.mjs';
import type {SceneTempoSettings} from '../../runtime-contracts/src/tempo.mjs';
import {normalizeSceneStoryV2,storyLifecycleLimits} from '../../runtime-contracts/src/story.mjs';
import type {SceneStoryV2} from '../../runtime-contracts/src/story.mjs';
import type {SavedControlSnapshot} from './scene-document.ts';
import {normalizeSceneSoundtrack} from './scene-soundtrack.ts';
import type {SceneSoundtrack} from './scene-soundtrack.ts';

export type StoryVisualSource=Readonly<{
 id:string;
 source:SourceBundle&Readonly<{sdkVersion:'0.2.0'}>;
 controls:SavedControlSnapshot;
 controlAnimations:readonly ControlAnimationBinding[];
}>;
export type StorySceneDocumentV7=Readonly<{
 format:'lux-scene';version:7;visuals:readonly StoryVisualSource[];
 settings:OutputSettings;tempo:SceneTempoSettings;story:SceneStoryV2;soundtrack?:SceneSoundtrack;
}>;

const stableId=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const reserved=new Set(['constructor','prototype','__proto__']);
const encoder=new TextEncoder();

function invalid(message:string):never{throw Error(message);}
function dense(value:unknown,path:string):unknown[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)invalid(`${path} must be a plain array`);
 const length=Object.getOwnPropertyDescriptor(value,'length')?.value;
 if(!Number.isSafeInteger(length)||Reflect.ownKeys(value).length!==length+1)invalid(`${path} must be a dense plain array`);
 const result=[];
 for(let index=0;index<length;index++){
  const item=Object.getOwnPropertyDescriptor(value,String(index));
  if(!item?.enumerable||!Object.hasOwn(item,'value'))invalid(`${path} must contain own data entries`);
  result.push(item.value);
 }
 return result;
}
function visualId(value:unknown,path:string):string{
 if(typeof value!=='string'||!stableId.test(value)||reserved.has(value))invalid(`${path} is not a valid Story visual ID`);
 return value;
}
function savedControls(value:unknown):SavedControlSnapshot{
 const raw=snapshotRecord(value,['sourceHash','schema','schemaHash','values']),schema=normalizeControlSchema(raw.schema);
 return Object.freeze({sourceHash:hashSchema.parse(raw.sourceHash),schema,schemaHash:hashSchema.parse(raw.schemaHash),values:validateControlSnapshot(schema,raw.values)});
}
async function sha256(value:string):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(value));
 return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function validateStorySceneDocumentV7(value:unknown):StorySceneDocumentV7{
 // soundtrack is optional and keeps version 7; files without it are unchanged.
 const fields=['format','version','visuals','settings','tempo','story'];
 if(value&&typeof value==='object'&&Object.hasOwn(value,'soundtrack'))fields.push('soundtrack');
 const raw=snapshotRecord(value,fields);
 if(raw.format!=='lux-scene'||raw.version!==7)invalid('Expected lux-scene version 7');
 const rows=dense(raw.visuals,'Scene v7 visuals');
 if(rows.length<1||rows.length>storyLifecycleLimits.visuals)invalid('Scene v7 must contain 1–8 visuals');
 const seen=new Set<string>(),visuals:StoryVisualSource[]=[];let aggregateSourceTextBytes=0;
 for(let index=0;index<rows.length;index++){
  const row=snapshotRecord(rows[index],['id','source','controls','controlAnimations']),id=visualId(row.id,`visuals.${index}.id`);
  if(seen.has(id))invalid(`Duplicate Scene v7 visual ID ${id}`);seen.add(id);
  const source=validateSource(row.source) as StoryVisualSource['source'];
  if(source.sdkVersion!=='0.2.0')invalid(`Scene v7 visual ${id} requires SDK 0.2.0 source`);
  for(const text of Object.values(source.files)){
   const bytes=encoder.encode(text).byteLength;
   if(aggregateSourceTextBytes>storyLifecycleLimits.aggregateSourceTextBytes-bytes)invalid(`Scene v7 aggregate source text exceeds ${formatBytes(storyLifecycleLimits.aggregateSourceTextBytes)}`);
   aggregateSourceTextBytes+=bytes;
  }
  if(row.controlAnimations===undefined)invalid(`Scene v7 visual ${id} requires controlAnimations`);
  const controls=savedControls(row.controls),controlAnimations=validateControlAnimationBindings(row.controlAnimations);
  for(const binding of controlAnimations){
   if(binding.nodePath.length!==0)invalid(`Scene v7 visual ${id} control animations require a flat node path`);
   if(binding.definitionHash!==controls.schemaHash||binding.schemaHash!==controls.schemaHash)invalid(`Scene v7 visual ${id} control animation schema identity mismatch`);
  }
  visuals.push(Object.freeze({id,source,controls,controlAnimations}));
 }
 const story=normalizeSceneStoryV2(raw.story),referenced=[story.normalVisualId,...story.beats.map(beat=>beat.visualId),...story.sequence.map(occurrence=>occurrence.visualId)];
 for(const id of referenced)if(!seen.has(id))invalid(`Scene v7 Story references unknown visual ID ${id}`);
 const result=Object.freeze({format:'lux-scene' as const,version:7 as const,visuals:Object.freeze(visuals),settings:Object.freeze(outputSettingsSchema.parse(snapshotRecord(raw.settings))),tempo:normalizeTempoSettings(raw.tempo),story,...(Object.hasOwn(raw,'soundtrack')?{soundtrack:normalizeSceneSoundtrack(raw.soundtrack)}:{})});
 if(encoder.encode(JSON.stringify(result,null,2)+'\n').byteLength>storyLifecycleLimits.sceneBytes)invalid(`Scene v7 JSON exceeds ${formatBytes(storyLifecycleLimits.sceneBytes)}`);
 return result;
}

export async function verifyStorySceneDocumentV7(value:unknown):Promise<StorySceneDocumentV7>{
 const document=validateStorySceneDocumentV7(value);
 for(const visual of document.visuals){
  // sourceHash identifies the last accepted control cache. Draft source may be newer
  // or invalid; current source identity is verified when a compiled manifest is admitted.
  if(await sha256(canonicalControlSchemaJson(visual.controls.schema))!==visual.controls.schemaHash)invalid(`Scene v7 visual ${visual.id} control schema hash mismatch`);
 }
 return document;
}

export function createStorySceneDocumentV7(
 visuals:readonly StoryVisualSource[],settings:OutputSettings,tempo:SceneTempoSettings,story:SceneStoryV2,
):StorySceneDocumentV7{
 return validateStorySceneDocumentV7({format:'lux-scene',version:7,visuals,settings,tempo,story});
}
