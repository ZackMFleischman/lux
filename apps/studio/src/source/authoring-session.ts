import { DEFAULT_OUTPUT, controlValuesSchema } from '../../../../packages/runtime-contracts/src/index.ts';
import type { SourceBundle, ControlValues } from '../../../../packages/runtime-contracts/src/index.ts';
import type { SceneDocument } from '../../../../packages/core/src/scene-file.ts';
import { createSceneDocument, verifySceneDocument, verifySavedControlSnapshot, validateSavedControlSnapshot, sceneControlSnapshot, sceneSourceHash, sceneHash } from '../../../../packages/core/src/scene-document.ts';
import type { SavedControlSnapshot } from '../../../../packages/core/src/scene-document.ts';
import type { SourceWorkspace } from './workspace.ts';

type SavedFile = { token: string; name: string };
type Ports = {
  submit(source: SourceBundle, options?: {savedControls?:SavedControlSnapshot}): Promise<void>;
  save(request: { token?: string; saveAs: boolean; document: SceneDocument }): Promise<SavedFile | null>;
  getControls?(): ControlValues;
  getControlSnapshot?(): SavedControlSnapshot | null;
  open?(): Promise<(SavedFile & { document: SceneDocument }) | null>;
  /** Legacy port retained for fixture compatibility; controls now enter submit before activation. */
  applyControls?(controls: ControlValues): Promise<void>;
  export?(request: { name: string; document: SceneDocument }): Promise<{ path: string; releaseId: string; runtimeId: string } | null>;
};
/** Coordinates whole-document I/O. File and runtime authority remain in the injected ports. */
export function createAuthoringSession(workspace: SourceWorkspace, ports: Ports) {
  let token: string | undefined;
  let state: Readonly<{ busy: boolean; name: string; controlsDirty: boolean }> = Object.freeze({ busy: false, name: 'Untitled', controlsDirty: false });
  let controlsVersion = 0;
  // An opened document retains its own values until its visual activates.
  // The previous preview can remain alive when the new source is invalid.
  let pendingDocumentControls: SavedControlSnapshot | null = null;
  const listeners = new Set<() => void>();
  function update(patch: Partial<typeof state>) { state = Object.freeze({ ...state, ...patch }); for (const listener of listeners) listener(); }
  async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (state.busy || workspace.getSnapshot().busy) throw Error('Studio is busy');
    update({ busy: true });
    try { return await operation(); } finally { update({ busy: false }); }
  }
  async function documentControls(source:SourceBundle, requireAccepted=false):Promise<ControlValues | SavedControlSnapshot> {
    const candidate=pendingDocumentControls ?? ports.getControlSnapshot?.();
    if(source.sdkVersion==='0.1.0') {
      if(candidate) {
        const snapshot=await verifySavedControlSnapshot(candidate);
        if(requireAccepted && snapshot.sourceHash!==await sceneSourceHash(source)) throw Error('Accepted controls do not belong to the exported source');
        return controlValuesSchema.parse(snapshot.values);
      }
      if(!ports.getControls) throw Error('Legacy controls are unavailable');
      return controlValuesSchema.parse(ports.getControls());
    }
    if(candidate) {
      const snapshot=await verifySavedControlSnapshot(candidate);
      if(requireAccepted && snapshot.sourceHash!==await sceneSourceHash(source)) throw Error('Accepted controls do not belong to the exported source');
      return snapshot;
    }
    if(requireAccepted || workspace.getSnapshot().hasRunningSource) throw Error('Accepted controls are unavailable for this source');
    return Object.freeze({sourceHash:await sceneSourceHash(source),schema:Object.freeze([]),schemaHash:await sceneHash('[]'),values:Object.freeze({})});
  }
  async function activate(source: SourceBundle, expectedVersion: number) {
    const openedControls=pendingDocumentControls;
    await workspace.submit(source, expectedVersion, admitted => ports.submit(admitted,
      pendingDocumentControls ? {savedControls:pendingDocumentControls} : undefined));
    pendingDocumentControls = null;
    if(openedControls && source.sdkVersion==='0.2.0') {
      const accepted=ports.getControlSnapshot?.();
      if(accepted && JSON.stringify(validateSavedControlSnapshot(accepted))!==JSON.stringify(openedControls)) {
        controlsVersion++;update({controlsDirty:true});
      }
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    read() { const snapshot = workspace.getSnapshot(); return { source: structuredClone(snapshot.source), draftVersion: snapshot.version }; },
    controlsChanged() { if (pendingDocumentControls) return; controlsVersion++; update({ controlsDirty: true }); },
    build(source: SourceBundle, expectedVersion: number) {
      return exclusive(() => activate(source, expectedVersion));
    },
    exportSource(name: string) {
      return exclusive(async () => {
        if (!ports.export) throw Error('Export is unavailable');
        const snapshot = workspace.getSnapshot(), source = structuredClone(snapshot.source);
        await activate(source, snapshot.version);
        return ports.export({ name, document: createSceneDocument(source, { ...DEFAULT_OUTPUT }, await documentControls(source,true)) });
      });
    },
    save(saveAs = false) {
      return exclusive(async () => {
        const snapshot = workspace.getSnapshot(), controlVersion = controlsVersion;
        const source=structuredClone(snapshot.source);
        const document = createSceneDocument(source, { ...DEFAULT_OUTPUT }, await documentControls(source));
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
        const document = await verifySceneDocument(result.document);
        if (document.settings.width !== 1920 || document.settings.height !== 1080 || document.settings.fps !== 60 || document.settings.seed !== 0)
          throw Error('This build supports 1920×1080 at 60 fps with seed 0');
        const savedControls=await sceneControlSnapshot(document);
        workspace.replaceDocument(document.source);
        pendingDocumentControls = savedControls;
        token = result.token; update({ name: result.name, controlsDirty: false });
        await activate(document.source, workspace.getSnapshot().version);
        return result;
      });
    },
  };
}
