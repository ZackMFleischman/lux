import { z } from 'zod';
import { legacySourceBundleSchema,assetSourceBundleSchema } from '../../../../packages/runtime-contracts/src/index.ts';
// Public authoring capabilities are intentionally narrower than internal builds.
const studioSdkVersion=z.enum(['0.1.0','0.2.0','0.4.0']);
const sourceBundleSchema=z.union([legacySourceBundleSchema.extend({sdkVersion:studioSdkVersion}),assetSourceBundleSchema.extend({sdkVersion:studioSdkVersion})]);
const componentId=z.string().uuid();
const mountPath=z.string().max(180).regex(/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/);
export const libraryLinkInputSchema=z.object({componentId,mountPath}).strict();
export const sourceBuildInputSchema = z.object({ expectedDraftVersion: z.number().int().nonnegative(),
  source: sourceBundleSchema,libraryLinks:z.array(libraryLinkInputSchema).optional() }).strict();
const scenePath=z.string().min(1).max(1024).refine(path=>path.toLowerCase().endsWith('.lux-scene'),'Scene path must end in .lux-scene');
export const sceneSaveInputSchema=z.object({path:scenePath,expectedDraftVersion:z.number().int().nonnegative(),overwrite:z.boolean().optional().default(false)}).strict();
export const sceneOpenInputSchema=z.object({path:scenePath,expectedDraftVersion:z.number().int().nonnegative(),discardDirty:z.boolean().optional().default(false)}).strict();
export const libraryComponentSourceSchema=legacySourceBundleSchema.extend({sdkVersion:z.literal('0.4.0')});
const libraryDependencySchema=z.object({componentId,mountPath,revision:z.number().int().positive()}).strict();
export const libraryCreateInputSchema=z.object({name:z.string().trim().min(1).max(80),description:z.string().trim().min(1).max(512),source:libraryComponentSourceSchema,dependencies:z.array(libraryDependencySchema).optional()}).strict();
export const libraryReadInputSchema=z.object({id:componentId,revision:z.number().int().positive().optional()}).strict();
export const libraryUpdateInputSchema=libraryCreateInputSchema.extend({id:componentId,expectedRevision:z.number().int().positive()}).strict();
export function sourceReadResult(value: unknown) {
  const result = { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 16 * 1024 * 1024)
    throw Error('Source read result exceeds 16 MiB');
  return result;
}
