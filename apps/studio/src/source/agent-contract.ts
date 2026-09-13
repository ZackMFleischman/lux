import { z } from 'zod';
import { legacySourceBundleSchema,assetSourceBundleSchema } from '../../../../packages/runtime-contracts/src/index.ts';
// Public authoring capabilities are intentionally narrower than internal builds.
const studioSdkVersion=z.enum(['0.1.0','0.2.0']);
const sourceBundleSchema=z.union([legacySourceBundleSchema.extend({sdkVersion:studioSdkVersion}),assetSourceBundleSchema.extend({sdkVersion:studioSdkVersion})]);
export const sourceBuildInputSchema = z.object({ expectedDraftVersion: z.number().int().nonnegative(),
  source: sourceBundleSchema }).strict();
export function sourceReadResult(value: unknown) {
  const result = { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 16 * 1024 * 1024)
    throw Error('Source read result exceeds 16 MiB');
  return result;
}
