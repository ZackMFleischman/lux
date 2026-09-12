import { z } from 'zod';

// Null means not observed. Inventory is never evidence of runtime capability.
export const preflightSchema = z.object({
  schemaVersion: z.literal(1),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  host: z.object({ executable: z.string().nullable(), version: z.string().nullable(), refreshHz: z.number().positive().nullable(), pluginDirectory: z.string().nullable() }),
  adapters: z.object({ rendererLuid: z.string().nullable(), bridgeLuid: z.string().nullable(), hostLuid: z.string().nullable() }),
  versions: z.record(z.string()),
  mcp: z.object({ profile: z.string(), client: z.string().nullable(), imageObserved: z.boolean() }),
  checks: z.array(z.object({ name: z.string().min(1), outcome: z.enum(['pass', 'fail', 'unavailable']), evidence: z.string().min(1) })),
}).passthrough();
export type PreflightResult = z.infer<typeof preflightSchema>;

export function integrationReady(value: unknown): boolean {
  const parsed = preflightSchema.safeParse(value);
  if (!parsed.success) return false;
  const r = parsed.data;
  return r.checks.length > 0 && r.checks.every(c => c.outcome === 'pass') &&
    r.host.executable !== null && r.host.version !== null && r.host.refreshHz !== null && r.host.pluginDirectory !== null &&
    r.adapters.rendererLuid !== null && r.adapters.rendererLuid === r.adapters.bridgeLuid && r.adapters.bridgeLuid === r.adapters.hostLuid &&
    r.mcp.client !== null && r.mcp.imageObserved;
}
