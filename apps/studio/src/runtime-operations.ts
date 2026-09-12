import { z } from 'zod';
import { snapshotRecord } from '../../build-worker/src/source-policy.mjs';
import type { StudioClient } from './service-client.ts';

const target = { instanceId: z.string().min(1), expectedGeneration: z.number().int().nonnegative().safe() };
const valuesSchema=z.record(z.number().finite()).refine(values=>Object.keys(values).length>0 && Object.keys(values).length<=32,'Expected 1–32 parameter values');
export const parameterInputSchema = z.object({ ...target, expectedRevisionId: z.string().min(1), expectedControlSchemaHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),values:valuesSchema, mode: z.literal('live').default('live') }).strict();
export const playbackInputSchema = z.object({ ...target, action: z.enum(['play', 'pause', 'reset']) }).strict();
export const restartInputSchema = z.object(target).strict();
const requestId = z.string().min(1).max(100);
export const studioOperationSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('lux.parameters.set'), input: parameterInputSchema.extend({ requestId }) }).strict(),
  z.object({ name: z.literal('lux.playback'), input: playbackInputSchema.extend({ requestId }) }).strict(),
  z.object({ name: z.literal('lux.runtime.restart'), input: restartInputSchema.extend({ requestId }) }).strict(),
]);
export async function dispatchRuntimeCommand(client: StudioClient, method: string, params: unknown) {
  const schemas = { parameters: parameterInputSchema, playback: playbackInputSchema, restart: restartInputSchema };
  if (!Object.hasOwn(schemas, method)) throw Error('Unsupported runtime command');
  const names = { parameters: 'lux.parameters.set', playback: 'lux.playback', restart: 'lux.runtime.restart' } as const;
  const key = method as keyof typeof schemas;
  if(key==='parameters') {const raw=snapshotRecord(params);params={...raw,values:snapshotRecord(raw.values)};}
  const operation = studioOperationSchema.parse({ name: names[key], input: { ...schemas[key].parse(params), requestId: crypto.randomUUID() } });
  const applied = await client.invoke(operation);
  return { applied, status: client.getSnapshot() };
}
