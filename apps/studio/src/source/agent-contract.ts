import { z } from 'zod';
import { sourceBundleSchema } from '../../../../packages/runtime-contracts/src/index.ts';
export const sourceBuildInputSchema = z.object({ expectedDraftVersion: z.number().int().nonnegative(),
  source: sourceBundleSchema }).strict();
export function sourceReadResult(value: unknown) {
  const result = { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 16 * 1024 * 1024)
    throw Error('Source read result exceeds 16 MiB');
  return result;
}
