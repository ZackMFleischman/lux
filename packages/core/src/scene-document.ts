import { z } from 'zod';
import { legacySourceBundleSchema, assetSourceBundleSchema, outputSettingsSchema, controlValuesSchema } from '../../runtime-contracts/src/index.ts';
import type { SourceBundle, AssetSourceBundle, OutputSettings, ControlValues } from '../../runtime-contracts/src/index.ts';
import { validateSource, snapshotRecord } from '../../../apps/build-worker/src/source-policy.mjs';

const legacySchema = z.object({ format: z.literal('lux-scene'), version: z.literal(1), source: legacySourceBundleSchema, settings: outputSettingsSchema, controls: controlValuesSchema }).strict();
const schema = z.discriminatedUnion('version',[legacySchema,legacySchema.extend({version:z.literal(2),source:assetSourceBundleSchema}).strict()]);
export type SceneDocument = z.infer<typeof schema>;
export function validateSceneDocument(value: unknown): SceneDocument {
  // Validate raw records before schema cloning can erase inherited/accessor
  // properties and their provenance. Preserve legacy scene source ordering.
  const raw = snapshotRecord(value,['format','version','source','settings','controls']);
  const source = validateSource(raw.source);
  const result = schema.parse({...raw,source:raw.version===2 ? source : raw.source,
    settings:snapshotRecord(raw.settings),controls:snapshotRecord(raw.controls)});
  const snapshot = result.version === 2 ? {...result,source:source as AssetSourceBundle} : result;
  if (snapshot.version === 2 && new TextEncoder().encode(JSON.stringify(snapshot,null,2)+'\n').byteLength > 7340032) throw Error('Scene v2 JSON exceeds 7 MiB');
  return snapshot;
}
export function createSceneDocument(source: SourceBundle, settings: OutputSettings, controls: ControlValues): SceneDocument {
  return validateSceneDocument({format:'lux-scene',version:'sourceVersion' in source ? 2 : 1,source,settings,controls});
}
