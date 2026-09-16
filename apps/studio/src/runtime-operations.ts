import { z } from 'zod';
import { snapshotRecord } from '../../build-worker/src/source-policy.mjs';
import type { StudioClient } from './service-client.ts';
import { nodeIdSchema } from '../../../packages/runtime-contracts/src/identities.ts';

const target = { instanceId: z.string().min(1), expectedGeneration: z.number().int().nonnegative().safe() };
const valuesSchema=z.record(z.number().finite()).refine(values=>Object.keys(values).length>0,'Expected at least one parameter value');
export const parameterInputSchema = z.object({ ...target, expectedRevisionId: z.string().min(1), expectedControlSchemaHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),values:valuesSchema, mode: z.literal('live').default('live') }).strict();
export const playbackInputSchema = z.object({ ...target, action: z.enum(['play', 'pause', 'reset']) }).strict();
export const nodeParameterInputSchema=parameterInputSchema.extend({nodePath:z.array(nodeIdSchema).min(1).max(16),expectedControlSchemaHash:z.string().regex(/^[a-f0-9]{64}$/)});
const animationTarget={nodePath:z.array(nodeIdSchema).max(8),definitionHash:z.string().regex(/^[a-f0-9]{64}$/),schemaHash:z.string().regex(/^[a-f0-9]{64}$/),controlId:z.string().min(1).max(64)};
const animationAmount={amount:z.number().finite().nonnegative(),enabled:z.boolean()};
const lfoAnimationBindingSchema=z.object({...animationTarget,...animationAmount,shape:z.enum(['sine','triangle','saw','square']),periodSeconds:z.number().finite().min(.05).max(3600),phase:z.number().finite().min(0).max(1)}).strict();
const audioAnalyzerSchema=z.object({version:z.literal(1),fftSize:z.literal(2048),minDecibels:z.number().finite().min(-120).max(-40),maxDecibels:z.number().finite().min(-80).max(0)}).strict()
  .refine(analyzer=>analyzer.maxDecibels-analyzer.minDecibels>=10,{message:'Audio analyzer range must span at least 10 decibels'});
const audioSourceSchema=z.object({kind:z.literal('audio-band'),logicalInputId:z.literal('primary-audio'),band:z.enum(['level','bass','mids','highs']),analyzer:audioAnalyzerSchema}).strict();
const kickSourceSchema=z.object({kind:z.literal('audio-kick'),logicalInputId:z.literal('primary-audio'),analyzer:audioAnalyzerSchema}).strict();
const audioAnimationBindingSchema=z.object({...animationTarget,...animationAmount,kind:z.literal('audio'),source:audioSourceSchema,
  attackMs:z.number().int().safe().min(0).max(60000),releaseMs:z.number().int().safe().min(0).max(60000)}).strict();
const kickAnimationBindingSchema=z.object({...animationTarget,...animationAmount,kind:z.literal('kick'),source:kickSourceSchema,
  attackMs:z.number().int().safe().min(0).max(60000),releaseMs:z.number().int().safe().min(0).max(60000),
  sensitivity:z.number().finite().min(0).max(1),retriggerMs:z.number().int().safe().min(0).max(2000),envelope:z.enum(['linear','exponential'])}).strict();
const tempoAnimationBindingSchema=z.object({...animationTarget,...animationAmount,kind:z.literal('tempo'),shape:z.enum(['sine','triangle','saw','square']),beatsPerCycle:z.number().finite().min(.25).max(64),phase:z.number().finite().min(0).max(1)}).strict();
const variationAnimationBindingSchema=z.object({...animationTarget,...animationAmount,kind:z.literal('variation'),distribution:z.enum(['random','centered','spread'])}).strict();
const animationBindingSchema=z.union([lfoAnimationBindingSchema,audioAnimationBindingSchema,kickAnimationBindingSchema,tempoAnimationBindingSchema,variationAnimationBindingSchema]);
export const nodeAnimationInputSchema=z.object({...target,expectedRevisionId:z.string().min(1),expectedControlSchemaHash:z.string().regex(/^[a-f0-9]{64}$/),nodePath:z.array(nodeIdSchema).max(8),controlId:z.string().min(1).max(64),animation:animationBindingSchema.nullable(),restart:z.boolean().optional()}).strict();
export const nodeVariationInputSchema=z.object({...target,expectedRevisionId:z.string().min(1),expectedControlSchemaHash:z.string().regex(/^[a-f0-9]{64}$/),nodePath:z.array(nodeIdSchema).max(8),controlId:z.string().min(1).max(64),variation:z.object({distribution:z.enum(['random','centered','spread']),amount:z.number().finite().nonnegative(),enabled:z.boolean()}).strict().nullable()}).strict();
export const restartInputSchema = z.object(target).strict();
export const previewResizeInputSchema = z.object({ ...target, width: z.number().int().min(1).max(3840), height: z.number().int().min(1).max(2160) }).strict();
export const tempoSetInputSchema=z.object({...target,expectedRevisionId:z.string().min(1),bpm:z.number().finite().min(20).max(300)}).strict();
export const tempoTapInputSchema=z.object({...target,expectedRevisionId:z.string().min(1)}).strict();
const requestId = z.string().min(1).max(100);
export const studioOperationSchema = z.discriminatedUnion('name', [
  z.object({name:z.literal('lux.node.parameters.set'),input:nodeParameterInputSchema.extend({requestId})}).strict(),
  z.object({name:z.literal('lux.node.animation.set'),input:nodeAnimationInputSchema.extend({requestId})}).strict(),
  z.object({name:z.literal('lux.node.variation.set'),input:nodeVariationInputSchema.extend({requestId})}).strict(),
  z.object({ name: z.literal('lux.parameters.set'), input: parameterInputSchema.extend({ requestId }) }).strict(),
  z.object({ name: z.literal('lux.playback'), input: playbackInputSchema.extend({ requestId }) }).strict(),
  z.object({ name: z.literal('lux.runtime.restart'), input: restartInputSchema.extend({ requestId }) }).strict(),
  z.object({ name: z.literal('lux.preview.resize'), input: previewResizeInputSchema.extend({ requestId }) }).strict(),
  z.object({name:z.literal('lux.tempo.set'),input:tempoSetInputSchema.extend({requestId})}).strict(),
  z.object({name:z.literal('lux.tempo.tap'),input:tempoTapInputSchema.extend({requestId})}).strict(),
]);
export async function dispatchRuntimeCommand(client: StudioClient, method: string, params: unknown) {
  const schemas = { parameters: parameterInputSchema, variation:nodeVariationInputSchema, playback: playbackInputSchema, restart: restartInputSchema,'tempo.set':tempoSetInputSchema,'tempo.tap':tempoTapInputSchema };
  if (!Object.hasOwn(schemas, method)) throw Error('Unsupported runtime command');
  const names = { parameters: 'lux.parameters.set', variation:'lux.node.variation.set', playback: 'lux.playback', restart: 'lux.runtime.restart','tempo.set':'lux.tempo.set','tempo.tap':'lux.tempo.tap' } as const;
  const key = method as keyof typeof schemas;
  if(key==='parameters') {const raw=snapshotRecord(params);params={...raw,values:snapshotRecord(raw.values)};}
  const operation = studioOperationSchema.parse({ name: names[key], input: { ...schemas[key].parse(params), requestId: crypto.randomUUID() } });
  const applied = await client.invoke(operation);
  return { applied, status: client.getSnapshot() };
}
