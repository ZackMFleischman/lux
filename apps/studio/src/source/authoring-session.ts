import { DEFAULT_OUTPUT } from '../../../../packages/runtime-contracts/src/index.ts';
import type { SourceBundle } from '../../../../packages/runtime-contracts/src/index.ts';
import type { SceneDocument } from '../../../../packages/core/src/scene-file.ts';
import type { SourceWorkspace } from './workspace.ts';

type SavedFile = { token: string; name: string };
type Ports = {
  submit(source: SourceBundle): Promise<void>;
  save(request: { token?: string; saveAs: boolean; document: SceneDocument }): Promise<SavedFile | null>;
  getControls(): SceneDocument['controls'];
  open?(): Promise<(SavedFile & { document: SceneDocument }) | null>;
  applyControls?(controls: SceneDocument['controls']): Promise<void>;
};
/** Coordinates whole-document I/O. File and runtime authority remain in the injected ports. */
export function createAuthoringSession(workspace: SourceWorkspace, ports: Ports) {
  let token: string | undefined;
  let state: Readonly<{ busy: boolean; name: string; controlsDirty: boolean }> = Object.freeze({ busy: false, name: 'Untitled', controlsDirty: false });
  let controlsVersion = 0;
  const listeners = new Set<() => void>();
  function update(patch: Partial<typeof state>) { state = Object.freeze({ ...state, ...patch }); for (const listener of listeners) listener(); }
  async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (state.busy || workspace.getSnapshot().busy) throw Error('Studio is busy');
    update({ busy: true });
    try { return await operation(); } finally { update({ busy: false }); }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    read() { const snapshot = workspace.getSnapshot(); return { source: structuredClone(snapshot.source), draftVersion: snapshot.version }; },
    controlsChanged() { controlsVersion++; update({ controlsDirty: true }); },
    build(source: SourceBundle, expectedVersion: number) {
      return exclusive(() => workspace.submit(source, expectedVersion, ports.submit));
    },
    save(saveAs = false) {
      return exclusive(async () => {
        const snapshot = workspace.getSnapshot(), controlVersion = controlsVersion;
        const document: SceneDocument = { format: 'lux-scene', version: 1, source: structuredClone(snapshot.source),
          settings: { ...DEFAULT_OUTPUT }, controls: { ...ports.getControls() } };
        const result = await ports.save({ token, saveAs, document });
        if (result) { token = result.token; workspace.markSaved(snapshot.version);
          update({ name: result.name, controlsDirty: controlsVersion !== controlVersion }); }
        return result;
      });
    },
    open() {
      return exclusive(async () => {
        if (!ports.open) throw Error('Open is unavailable');
        const result = await ports.open(); if (!result) return null;
        const { document } = result;
        if (document.settings.width !== 1920 || document.settings.height !== 1080 || document.settings.fps !== 60 || document.settings.seed !== 0)
          throw Error('This build supports 1920×1080 at 60 fps with seed 0');
        workspace.replaceDocument(document.source);
        token = result.token; update({ name: result.name, controlsDirty: false });
        await workspace.submit(document.source, workspace.getSnapshot().version, ports.submit);
        await ports.applyControls?.(document.controls);
        update({ controlsDirty: false });
        return result;
      });
    },
  };
}
