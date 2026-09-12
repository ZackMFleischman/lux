import { z } from 'zod';

export type PanelDefinition = Readonly<{ kind: string; title: string; multiple: boolean; parseViewState(value: unknown): Record<string, unknown> }>;
export class PanelRegistry {
  private definitions = new Map<string, PanelDefinition>();
  constructor(definitions: readonly PanelDefinition[]) {
    for (const definition of definitions) {
      if (!/^[a-z][a-z0-9-]{0,31}$/.test(definition.kind) || this.definitions.has(definition.kind)) throw Error('Invalid or duplicate panel kind');
      this.definitions.set(definition.kind, Object.freeze({ ...definition }));
    }
  }
  list(): readonly PanelDefinition[] { return [...this.definitions.values()]; }
  get(kind: string): PanelDefinition { const value = this.definitions.get(kind); if (!value) throw Error('Unavailable panel: ' + kind); return value; }
}
const define = (kind: string, title: string, schema: z.ZodTypeAny, multiple = false): PanelDefinition => ({
  kind, title, multiple, parseViewState: value => schema.parse(value ?? {}) as Record<string, unknown>,
});
/** Only implemented panel kinds are registered; future Library/Graph need real renderers. */
export function createStudioPanelRegistry(additional: readonly PanelDefinition[] = []) {
  return new PanelRegistry([
    define('preview', 'Preview', z.object({ fit: z.enum(['contain', 'actual']).optional(), zoom: z.number().finite().min(0.1).max(8).optional() }).strict()),
    define('source', 'Source', z.object({ selectedFile: z.string().max(240).regex(/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/).optional() }).strict()),
    define('inspector', 'Inspector', z.object({ lockedTargetId: z.string().min(1).max(128).nullable().optional() }).strict(), true),
    define('jobs', 'Jobs', z.object({ filter: z.enum(['all', 'failed', 'running']).optional() }).strict()),
    ...additional,
  ]);
}
