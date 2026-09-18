import { z } from 'zod';

// Logical UUID identities are independent of display paths, content hashes and
// ephemeral session capabilities. Brands never convey filesystem authority.
export const projectIdSchema = z.string().uuid().brand<'ProjectId'>();
export const sceneIdSchema = z.string().uuid().brand<'SceneId'>();
export const componentIdSchema = z.string().uuid().brand<'ComponentId'>();
export const assetIdSchema = z.string().uuid().brand<'AssetId'>();
export const projectRevisionIdSchema = z.string().uuid().brand<'ProjectRevisionId'>();
export const sceneRevisionIdSchema = z.string().uuid().brand<'SceneRevisionId'>();
const uuidSchema = z.string().uuid();
const readableGraphId = /^[a-z][a-z0-9._-]{0,95}$/;
export const graphIdSchema = z.string().refine(
  value => readableGraphId.test(value) || uuidSchema.safeParse(value).success,
  { message: 'Invalid graph identifier' },
);
export const nodeIdSchema = graphIdSchema.brand<'NodeId'>();
export const edgeIdSchema = graphIdSchema.brand<'EdgeId'>();
export type ProjectId = z.infer<typeof projectIdSchema>;
export type SceneId = z.infer<typeof sceneIdSchema>;
export type ComponentId = z.infer<typeof componentIdSchema>;
export type AssetId = z.infer<typeof assetIdSchema>;
export type ProjectRevisionId = z.infer<typeof projectRevisionIdSchema>;
export type SceneRevisionId = z.infer<typeof sceneRevisionIdSchema>;
export type NodeId = z.infer<typeof nodeIdSchema>;
export type EdgeId = z.infer<typeof edgeIdSchema>;
