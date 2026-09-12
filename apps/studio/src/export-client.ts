import type { SceneDocument } from '../../../packages/core/src/scene-file.ts';
export type StudioExportRequest = { name: string; document: SceneDocument };
export type StudioExportResult = { path: string; releaseId: string; runtimeId: string };
export interface StudioExportClient { create(request: StudioExportRequest): Promise<StudioExportResult | null>; }
declare global { interface Window { luxExport: StudioExportClient } }
