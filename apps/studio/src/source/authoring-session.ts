import { DEFAULT_OUTPUT, controlValuesSchema } from '../../../../packages/runtime-contracts/src/index.ts';
import type { SourceBundle, ControlValues, OutputSettings } from '../../../../packages/runtime-contracts/src/index.ts';
import type { Look, LookSummary, SaveLook } from '../../../../packages/core/src/look-store.ts';
import type { SceneDocument } from '../../../../packages/core/src/scene-file.ts';
import { createSceneDocument, verifySceneDocument, verifySavedControlSnapshot, verifySavedNodeControlSnapshot, validateSavedControlSnapshot, validateSavedNodeControlSnapshot, sceneControlSnapshot, sceneSourceHash, sceneHash } from '../../../../packages/core/src/scene-document.ts';
import type { SavedControlSnapshot, SavedNodeControlSnapshot } from '../../../../packages/core/src/scene-document.ts';
import type { SourceWorkspace } from './workspace.ts';
import { applyLibraryComponent, checkLibraryLinks, forkLibraryComponent as forkLink, validateSceneLibraryLinks } from '../../../../packages/core/src/component-library.ts';
import type { LibraryComponent, SceneLibraryLink } from '../../../../packages/core/src/component-library.ts';
import {validateControlAnimationBindings} from '../../../../packages/runtime-contracts/src/control-animation.mjs';
import type {ControlAnimationBinding} from '../../../../packages/runtime-contracts/src/control-animation.mjs';

type SavedControls=SavedControlSnapshot|SavedNodeControlSnapshot;

type SavedFile = { token: string; name: string };
type Ports = {
  submit(source: SourceBundle, options?: {savedControls?:SavedControls;savedControlAnimations?:readonly ControlAnimationBinding[];output?:OutputSettings}): Promise<void>;
  acceptedDocument?(): SceneDocument;
  saveLook?(request: SaveLook): Promise<LookSummary>;
  readLook?(id: string): Promise<Look>;
  lookThumbnail?(document: SceneDocument): Promise<string | undefined>;
  save(request: { token?: string; saveAs: boolean; document: SceneDocument }): Promise<SavedFile | null>;
  savePath?(request:{path:string;document:SceneDocument;overwrite:boolean}):Promise<SavedFile|null>;
  getControls?(): ControlValues;
  getControlSnapshot?(): SavedControls | null;
  getControlAnimations?():readonly ControlAnimationBinding[];
  settleControls?():Promise<void>;
  open?(): Promise<(SavedFile & { document: SceneDocument }) | null>;
  openPath?(path:string):Promise<(SavedFile & {document:SceneDocument})|null>;
  /** Legacy port retained for fixture compatibility; controls now enter submit before activation. */
  applyControls?(controls: ControlValues): Promise<void>;
  export?(request: { name: string; document: SceneDocument }): Promise<{ path: string; releaseId: string; runtimeId: string } | null>;
  readLibraryComponent?(id: string): Promise<LibraryComponent>;
};
/** Coordinates whole-document I/O. File and runtime authority remain in the injected ports. */
export function createAuthoringSession(workspace: SourceWorkspace, ports: Ports) {
  let token: string | undefined;
  type LibraryUpdate=Readonly<{componentId:string;name:string;resolvedRevision:number;availableRevision:number}>;
  type LibraryFallback=Readonly<{componentId:string;resolvedRevision:number;message:string}>;
  let state: Readonly<{ busy: boolean; name: string; controlsDirty: boolean; libraryDirty:boolean; libraryUpdates:readonly LibraryUpdate[];libraryFallbacks:readonly LibraryFallback[] }> = Object.freeze({ busy: false, name: 'Untitled', controlsDirty: false,libraryDirty:false,libraryUpdates:Object.freeze([]),libraryFallbacks:Object.freeze([]) });
  let controlsVersion = 0;
  let libraryLinks:readonly SceneLibraryLink[]=Object.freeze([]);
  // An opened document retains its own values until its visual activates.
  // The previous preview can remain alive when the new source is invalid.
  let pendingDocumentControls: SavedControls | null = null;
  let pendingDocumentAnimations:readonly ControlAnimationBinding[]|null=null;
  const listeners = new Set<() => void>();
  function update(patch: Partial<typeof state>) { state = Object.freeze({ ...state, ...patch }); for (const listener of listeners) listener(); }
  async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (state.busy || workspace.getSnapshot().busy) throw Error('Studio is busy');
    update({ busy: true });
    try { return await operation(); } finally { update({ busy: false }); }
  }
  async function documentControls(source:SourceBundle, requireAccepted=false):Promise<ControlValues | SavedControls> {
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
      const snapshot=source.sdkVersion==='0.4.0'?await verifySavedNodeControlSnapshot(candidate):await verifySavedControlSnapshot(candidate);
      if(requireAccepted && snapshot.sourceHash!==await sceneSourceHash(source)) throw Error('Accepted controls do not belong to the exported source');
      return snapshot;
    }
    if(requireAccepted || workspace.getSnapshot().hasRunningSource) throw Error('Accepted controls are unavailable for this source');
    if(source.sdkVersion==='0.4.0')throw Error('Accepted composition controls are unavailable for this source');
    return Object.freeze({sourceHash:await sceneSourceHash(source),schema:Object.freeze([]),schemaHash:await sceneHash('[]'),values:Object.freeze({})});
  }
  async function activate(source: SourceBundle, expectedVersion: number,nextLinks:readonly SceneLibraryLink[]=libraryLinks) {
    const openedControls=pendingDocumentControls;
    await workspace.submit(source, expectedVersion, admitted => ports.submit(admitted,
      pendingDocumentControls ? {savedControls:pendingDocumentControls,...(pendingDocumentAnimations?{savedControlAnimations:pendingDocumentAnimations}:{})} : undefined));
    libraryLinks=validateSceneLibraryLinks(nextLinks);
    pendingDocumentControls = null;
    pendingDocumentAnimations=null;
    if(openedControls && (source.sdkVersion==='0.2.0'||source.sdkVersion==='0.4.0')) {
      const accepted=ports.getControlSnapshot?.();
      const normalized=accepted?(source.sdkVersion==='0.4.0'?validateSavedNodeControlSnapshot(accepted):validateSavedControlSnapshot(accepted)):undefined;
      if(normalized && JSON.stringify(normalized)!==JSON.stringify(openedControls)) {
        controlsVersion++;update({controlsDirty:true});
      }
    }
  }
  async function resolveLinked(source:SourceBundle,baseLinks:readonly SceneLibraryLink[],requested?:readonly Readonly<{componentId:string;mountPath:string}>[]){
    const desired=requested??baseLinks.map(link=>({componentId:link.componentId,mountPath:link.mountPath}));
    const seen=new Set<string>();
    for(const row of desired){if(!row||typeof row.componentId!=='string'||typeof row.mountPath!=='string'||seen.has(row.componentId))throw Error('Invalid or duplicate requested library link');seen.add(row.componentId);}
    let next={source,links:validateSceneLibraryLinks(baseLinks.filter(link=>seen.has(link.componentId)))};
    const fallbacks:LibraryFallback[]=[];
    for(const row of desired){
      const existing=next.links.find(link=>link.componentId===row.componentId);
      if(existing&&row.mountPath!==existing.mountPath)throw Error('Changing a library mount path is not supported; fork it first');
      if(!ports.readLibraryComponent){if(existing)continue;throw Error('The component library is unavailable');}
      try{next=applyLibraryComponent(next.source,next.links,await ports.readLibraryComponent(row.componentId),row.mountPath);}
      catch(error){if(!existing)throw error;fallbacks.push({componentId:existing.componentId,resolvedRevision:existing.resolvedRevision,message:error instanceof Error?error.message:String(error)});}
    }
    return {source:next.source,links:next.links,fallbacks:Object.freeze(fallbacks)};
  }
  async function buildLinked(source:SourceBundle,expectedVersion:number,requested?:readonly Readonly<{componentId:string;mountPath:string}>[]){
    const previousLinks=libraryLinks,resolution=await resolveLinked(source,previousLinks,requested);
    const changed=JSON.stringify(previousLinks)!==JSON.stringify(resolution.links);
    try{await activate(resolution.source,expectedVersion,resolution.links);update({libraryDirty:state.libraryDirty||changed,libraryUpdates:Object.freeze([]),libraryFallbacks:resolution.fallbacks});}
    catch(error){const revised=resolution.links.some(link=>previousLinks.some(before=>before.componentId===link.componentId&&before.resolvedRevision!==link.resolvedRevision));
      if(revised)update({libraryFallbacks:Object.freeze([...resolution.fallbacks,{componentId:resolution.links.find(link=>previousLinks.some(before=>before.componentId===link.componentId&&before.resolvedRevision!==link.resolvedRevision))!.componentId,resolvedRevision:previousLinks.find(before=>resolution.links.some(link=>link.componentId===before.componentId&&link.resolvedRevision!==before.resolvedRevision))!.resolvedRevision,message:`Update failed; using saved revision. ${error instanceof Error?error.message:String(error)}`}])});
      throw error;
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    read() { const snapshot = workspace.getSnapshot(); return { source: structuredClone(snapshot.source), draftVersion: snapshot.version,libraryLinks:structuredClone(libraryLinks) }; },
    controlsChanged() { if (pendingDocumentControls) return; controlsVersion++; update({ controlsDirty: true }); },
    build(source: SourceBundle, expectedVersion: number,requested?:readonly Readonly<{componentId:string;mountPath:string}>[]) {
      return exclusive(() => buildLinked(source, expectedVersion,requested));
    },
    saveLook(name: string, selected?: {id: string; revision: number}) {
      return exclusive(async () => {
        if (!ports.acceptedDocument || !ports.saveLook) throw Error('Looks are unavailable');
        const document = await verifySceneDocument(ports.acceptedDocument());
        let thumbnail: string | undefined;
        try { thumbnail = await ports.lookThumbnail?.(document); } catch { /* The accepted snapshot is still usable. */ }
        return ports.saveLook({name, document, ...(selected ? {id: selected.id, expectedRevision: selected.revision} : {}), ...(thumbnail ? {thumbnail} : {})});
      });
    },
    loadLook(id: string) {
      return exclusive(async () => {
        if (!ports.readLook) throw Error('Looks are unavailable');
        const look = await ports.readLook(id);
        const document = await verifySceneDocument(look.document);
        if (document.version === 5 && document.libraryLinks.length) throw Error('This look is not a frozen snapshot');
        const savedControls = await sceneControlSnapshot(document);
        const savedControlAnimations = document.controlAnimations ?? [];
        await workspace.submit(document.source, workspace.getSnapshot().version, source => ports.submit(source, {savedControls, savedControlAnimations, output: document.settings}));
        token = undefined;
        libraryLinks = Object.freeze([]);
        pendingDocumentControls = null;
        pendingDocumentAnimations = null;
        workspace.markSaved(workspace.getSnapshot().version);
        update({name: look.name, controlsDirty: false, libraryDirty: false, libraryUpdates: [], libraryFallbacks: []});
        return look;
      });
    },
    exportSource(name: string) {
      return exclusive(async () => {
        if (!ports.export) throw Error('Export is unavailable');
        const snapshot = workspace.getSnapshot(), source = structuredClone(snapshot.source);
        await activate(source, snapshot.version);
        return ports.export({ name, document: createSceneDocument(source, { ...DEFAULT_OUTPUT }, await documentControls(source,true),libraryLinks,validateControlAnimationBindings(ports.getControlAnimations?.()??[])) });
      });
    },
    save(saveAs = false) {
      return exclusive(async () => {
        const snapshot = workspace.getSnapshot(), controlVersion = controlsVersion;
        const source=structuredClone(snapshot.source);
        const document = createSceneDocument(source, { ...DEFAULT_OUTPUT }, await documentControls(source),libraryLinks,validateControlAnimationBindings(pendingDocumentAnimations??ports.getControlAnimations?.()??[]));
        const result = await ports.save({ token, saveAs, document });
        if (result) { token = result.token; workspace.markSaved(snapshot.version);
          update({ name: result.name, controlsDirty: controlsVersion !== controlVersion,libraryDirty:false }); }
        return result;
      });
    },
    savePath(path:string,expectedVersion:number,overwrite:boolean) {
      return exclusive(async()=>{
        if(!ports.savePath)throw Error('Path save is unavailable');
        await ports.settleControls?.();
        const snapshot=workspace.getSnapshot();if(snapshot.version!==expectedVersion)throw Error('Editor changed; read its source again before saving');
        const controlVersion=controlsVersion,source=structuredClone(snapshot.source);
        const document=createSceneDocument(source,{...DEFAULT_OUTPUT},await documentControls(source),libraryLinks,validateControlAnimationBindings(pendingDocumentAnimations??ports.getControlAnimations?.()??[]));
        const result=await ports.savePath({path,document,overwrite});
        if(!result)return null;
        token=result.token;workspace.markSaved(snapshot.version);update({name:result.name,controlsDirty:controlsVersion!==controlVersion,libraryDirty:false});
        return {name:result.name,path,draftVersion:workspace.getSnapshot().version};
      });
    },
    openPath(path:string,expectedVersion:number) {
      return exclusive(async()=>{
        if(!ports.openPath)throw Error('Path open is unavailable');
        await ports.settleControls?.();
        if(workspace.getSnapshot().version!==expectedVersion)throw Error('Editor changed; read its source again before opening');
        const result=await ports.openPath(path);if(!result)return null;
        const document=await verifySceneDocument(result.document);
        if(document.settings.width!==1920||document.settings.height!==1080||document.settings.fps!==60||document.settings.seed!==0)throw Error('This build supports 1920×1080 at 60 fps with seed 0');
        const savedControls=await sceneControlSnapshot(document),savedAnimations=document.controlAnimations??Object.freeze([]),savedLinks=document.version===5?document.libraryLinks:Object.freeze([]);
        const resolution=await resolveLinked(document.source,savedLinks);
        await ports.submit(resolution.source,{savedControls,savedControlAnimations:savedAnimations,output:document.settings});
        workspace.replaceDocument(resolution.source);await workspace.submit(resolution.source,workspace.getSnapshot().version,async()=>{});
        token=result.token;libraryLinks=resolution.links;pendingDocumentControls=null;pendingDocumentAnimations=null;
        update({name:result.name,controlsDirty:false,libraryDirty:JSON.stringify(resolution.links)!==JSON.stringify(savedLinks),libraryUpdates:Object.freeze([]),libraryFallbacks:resolution.fallbacks});
        return {name:result.name,path,draftVersion:workspace.getSnapshot().version};
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
        const savedAnimations=document.controlAnimations??Object.freeze([]);
        const savedLinks=document.version===5?document.libraryLinks:Object.freeze([]);
        const resolution=await resolveLinked(document.source,savedLinks);
        const libraryChanged=JSON.stringify(resolution.links)!==JSON.stringify(savedLinks);
        workspace.replaceDocument(resolution.source);
        pendingDocumentControls = savedControls;
        pendingDocumentAnimations=savedAnimations;
        token = result.token; update({ name: result.name, controlsDirty: false,libraryDirty:libraryChanged,libraryUpdates:Object.freeze([]),libraryFallbacks:resolution.fallbacks });
        try{await activate(resolution.source, workspace.getSnapshot().version,resolution.links);}
        catch(error){
          if(!libraryChanged)throw error;
          workspace.replaceDocument(document.source);pendingDocumentControls=savedControls;pendingDocumentAnimations=savedAnimations;
          await activate(document.source,workspace.getSnapshot().version,savedLinks);
          update({libraryDirty:false,libraryFallbacks:Object.freeze([...resolution.fallbacks,...savedLinks.map(link=>({componentId:link.componentId,resolvedRevision:link.resolvedRevision,message:`Update failed; using saved revision. ${error instanceof Error?error.message:String(error)}`}))])});
        }
        return result;
      });
    },
    checkLibraryUpdates(){return exclusive(async()=>{const checked=await checkLibraryLinks(workspace.getSnapshot().source,libraryLinks,async id=>{if(!ports.readLibraryComponent)throw Error('The component library is unavailable');return ports.readLibraryComponent(id);});update({libraryUpdates:checked.updates,libraryFallbacks:checked.fallbacks});return checked;});},
    applyLibraryUpdates(){return exclusive(()=>buildLinked(sessionSource(),workspace.getSnapshot().version));},
    forkLibraryComponent(componentId:string){if(state.busy||workspace.getSnapshot().busy)throw Error('Studio is busy');const forked=forkLink(workspace.getSnapshot().source,libraryLinks,componentId);libraryLinks=forked.links;update({libraryDirty:true,libraryUpdates:Object.freeze(state.libraryUpdates.filter(item=>item.componentId!==componentId)),libraryFallbacks:Object.freeze(state.libraryFallbacks.filter(item=>item.componentId!==componentId))});},
  };
  function sessionSource(){return structuredClone(workspace.getSnapshot().source);}
}
