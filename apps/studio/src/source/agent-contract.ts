import { z } from 'zod';
import { legacySourceBundleSchema,assetSourceBundleSchema } from '../../../../packages/runtime-contracts/src/index.ts';
import {normalizeSceneStory} from '../../../../packages/runtime-contracts/src/story.mjs';
import {validateStorySceneDocumentV7} from '../../../../packages/core/src/story-scene-v2.ts';
// Public authoring capabilities are intentionally narrower than internal builds.
const studioSdkVersion=z.enum(['0.1.0','0.2.0','0.4.0']);
const sourceBundleSchema=z.union([legacySourceBundleSchema.extend({sdkVersion:studioSdkVersion}),assetSourceBundleSchema.extend({sdkVersion:studioSdkVersion})]);
const componentId=z.string().uuid();
const mountPath=z.string().max(180).regex(/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/);
export const libraryLinkInputSchema=z.object({componentId,mountPath}).strict();
const storyId=z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
export const sceneStoryInputSchema=z.object({version:z.literal(1),
  beats:z.array(z.object({id:storyId,label:z.string().min(1).refine(value=>[...value.trim()].length<=160,'Expected at most 160 Unicode code points'),timing:z.discriminatedUnion('kind',[
    z.object({kind:z.literal('sustained')}).strict(),
    z.object({kind:z.literal('timed'),durationSeconds:z.number().finite().positive()}).strict()
  ])}).strict()).max(128),
  sequence:z.array(z.object({id:storyId,beatId:storyId,follow:z.discriminatedUnion('kind',[
    z.object({kind:z.literal('manual')}).strict(),
    z.object({kind:z.literal('after'),seconds:z.number().finite().positive()}).strict()
  ])}).strict()).max(1024)
}).strict().superRefine((value,context)=>{try{normalizeSceneStory(value);}catch(error){context.addIssue({code:z.ZodIssueCode.custom,message:error instanceof Error?error.message:String(error)});}});
export const storySceneDocumentInputSchema=z.unknown().transform((value,context)=>{try{return validateStorySceneDocumentV7(value);}catch(error){context.addIssue({code:z.ZodIssueCode.custom,message:error instanceof Error?error.message:String(error)});return z.NEVER;}});
export const sourceBuildInputObjectSchema = z.object({ expectedDraftVersion: z.number().int().nonnegative(),
  source:sourceBundleSchema.optional(),document:storySceneDocumentInputSchema.optional(),libraryLinks:z.array(libraryLinkInputSchema).optional(),story:sceneStoryInputSchema.nullable().optional() }).strict();
export const sourceBuildInputSchema = sourceBuildInputObjectSchema.superRefine((value,context)=>{
    if((value.source===undefined)===(value.document===undefined))context.addIssue({code:z.ZodIssueCode.custom,message:'Build requires exactly one of source or document'});
    if(value.document!==undefined&&(value.libraryLinks!==undefined||value.story!==undefined))context.addIssue({code:z.ZodIssueCode.custom,message:'Scene v7 document builds cannot include libraryLinks or Story v1'});
  });
const scenePath=z.string().min(1).max(1024).refine(path=>path.toLowerCase().endsWith('.lux-scene'),'Scene path must end in .lux-scene');
export const sceneSaveInputSchema=z.object({path:scenePath,expectedDraftVersion:z.number().int().nonnegative(),overwrite:z.boolean().optional().default(false)}).strict();
export const sceneOpenInputSchema=z.object({path:scenePath,expectedDraftVersion:z.number().int().nonnegative(),discardDirty:z.boolean().optional().default(false)}).strict();
export const libraryComponentSourceSchema=legacySourceBundleSchema.extend({sdkVersion:z.literal('0.4.0')});
const libraryDependencySchema=z.object({componentId,mountPath,revision:z.number().int().positive()}).strict();
export const libraryCreateInputSchema=z.object({name:z.string().trim().min(1).max(80),description:z.string().trim().min(1).max(512),source:libraryComponentSourceSchema,dependencies:z.array(libraryDependencySchema).optional()}).strict();
export const libraryReadInputSchema=z.object({id:componentId,revision:z.number().int().positive().optional()}).strict();
export const libraryUpdateInputSchema=libraryCreateInputSchema.extend({id:componentId,expectedRevision:z.number().int().positive()}).strict();
const mib=1024*1024;
// Read keeps one selected source beside a 32 MiB Scene v7 document. Seven MiB
// covers its worst JSON escaping/assets; thirteen covers bounded runtime status.
const readResponseBytes=(32+7+13)*mib;
export const agentTransportLimits=Object.freeze({requestBytes:34*mib,responseBytes:readResponseBytes,readToolResultBytes:2*readResponseBytes});
export function sourceReadResult(value: unknown) {
  const text=JSON.stringify(value);
  if(new TextEncoder().encode(text).byteLength>agentTransportLimits.responseBytes)throw Error('Source read JSON exceeds 52 MiB');
  const result = { content: [{ type: 'text' as const, text }] };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > agentTransportLimits.readToolResultBytes)
    throw Error('Source read result exceeds 104 MiB');
  return result;
}
