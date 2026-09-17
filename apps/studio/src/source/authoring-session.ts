import { DEFAULT_OUTPUT, controlValuesSchema } from '../../../../packages/runtime-contracts/src/index.ts';
import type { SourceBundle, ControlValues, OutputSettings } from '../../../../packages/runtime-contracts/src/index.ts';
import type { Look, LookSummary, SaveLook } from '../../../../packages/core/src/look-store.ts';
import type { SceneDocument } from '../../../../packages/core/src/scene-file.ts';
import { createSceneDocument, verifySceneDocument, verifySavedControlSnapshot, verifySavedNodeControlSnapshot, validateSavedControlSnapshot, validateSavedNodeControlSnapshot, sceneControlSnapshot, sceneSourceHash, sceneHash } from '../../../../packages/core/src/scene-document.ts';
import type { SavedControlSnapshot, SavedNodeControlSnapshot } from '../../../../packages/core/src/scene-document.ts';
import type { SourceWorkspace } from './workspace.ts';
import {createStorySourceWorkspace} from './story-source-workspace.ts';
import type {StorySourceWorkspace} from './story-source-workspace.ts';
import { applyLibraryComponent, resolveLibraryComponent, checkLibraryLinks, forkLibraryComponent as forkLink, validateSceneLibraryLinks } from '../../../../packages/core/src/component-library.ts';
import type { LibraryComponent, SceneLibraryLink } from '../../../../packages/core/src/component-library.ts';
import {validateControlAnimationBindings} from '../../../../packages/runtime-contracts/src/control-animation.mjs';
import type {ControlAnimationBinding} from '../../../../packages/runtime-contracts/src/control-animation.mjs';
import {normalizeTempoSettings} from '../../../../packages/runtime-contracts/src/tempo.mjs';
import type {SceneTempoSettings} from '../../../../packages/runtime-contracts/src/tempo.mjs';
import {normalizeSceneStory} from '../../../../packages/runtime-contracts/src/story.mjs';
import type {SceneStoryV1,SceneStoryV2} from '../../../../packages/runtime-contracts/src/story.mjs';
import {createStorySceneDocumentV7,validateStorySceneDocumentV7,verifyStorySceneDocumentV7} from '../../../../packages/core/src/story-scene-v2.ts';
import type {StorySceneDocumentV7,StoryVisualSource} from '../../../../packages/core/src/story-scene-v2.ts';

type SavedControls=SavedControlSnapshot|SavedNodeControlSnapshot;

type SavedFile = { token: string; name: string };
type Ports = {
  submit(source: SourceBundle, options?: {savedControls?:SavedControls;savedControlAnimations?:readonly ControlAnimationBinding[];savedTempo?:SceneTempoSettings;output?:OutputSettings;story?:SceneStoryV1|null}): Promise<void>;
  submitDocument?(document:StorySceneDocumentV7):Promise<void>;
  selectVisual?(visualId:string):void;
  acceptedDocument?(): SceneDocument;
  saveLook?(request: SaveLook): Promise<LookSummary>;
  readLook?(id: string): Promise<Look>;
  lookThumbnail?(document: SceneDocument): Promise<string | undefined>;
  save(request: { token?: string; saveAs: boolean; document: SceneDocument }): Promise<SavedFile | null>;
  savePath?(request:{path:string;document:SceneDocument;overwrite:boolean}):Promise<SavedFile|null>;
  getControls?(): ControlValues;
  getOutput?(): OutputSettings;
  getControlSnapshot?(): SavedControls | null;
  getControlAnimations?():readonly ControlAnimationBinding[];
  getTempo?():SceneTempoSettings;
  settleControls?():Promise<void>;
  open?(): Promise<(SavedFile & { document: unknown }) | null>;
  openPath?(path:string):Promise<(SavedFile & {document:unknown})|null>;
  /** Legacy port retained for fixture compatibility; controls now enter submit before activation. */
  applyControls?(controls: ControlValues): Promise<void>;
  export?(request: { name: string; document: SceneDocument }): Promise<{ path: string; releaseId: string; runtimeId: string } | null>;
  readLibraryComponent?(id: string, revision?: number): Promise<LibraryComponent>;
};
/** Coordinates whole-document I/O. File and runtime authority remain in the injected ports. */
export function createAuthoringSession(workspace: SourceWorkspace, ports: Ports) {
  let token: string | undefined;
  type LibraryUpdate=Readonly<{componentId:string;name:string;resolvedRevision:number;availableRevision:number}>;
  type LibraryFallback=Readonly<{componentId:string;resolvedRevision:number;message:string}>;
  type SessionState=Readonly<{busy:boolean;runtimeControlsAvailable:boolean;name:string;controlsDirty:boolean;libraryDirty:boolean;libraryUpdates:readonly LibraryUpdate[];libraryFallbacks:readonly LibraryFallback[];activeWorkspace:SourceWorkspace;storySourceCatalog:StorySourceWorkspace|null}>;
  let state:SessionState=Object.freeze({busy:false,runtimeControlsAvailable:true,name:'Untitled',controlsDirty:false,libraryDirty:false,libraryUpdates:Object.freeze([]),libraryFallbacks:Object.freeze([]),activeWorkspace:workspace,storySourceCatalog:null});
  let controlsVersion = 0;
  let libraryLinks:readonly SceneLibraryLink[]=Object.freeze([]);
  let story:SceneStoryV1|null=null;
  let retainStoryVersion=false;
  // An opened document retains its own values until its visual activates.
  // The previous preview can remain alive when the new source is invalid.
  let pendingDocumentControls: SavedControls | null = null;
  let pendingDocumentAnimations:readonly ControlAnimationBinding[]|null=null;
  let pendingDocumentTempo:SceneTempoSettings|null=null;
  let storySourceCatalog:StorySourceWorkspace|null=null;
  let storyDocument:StorySceneDocumentV7|null=null;
  let draftVersion=workspace.getSnapshot().version,observedWorkspaceVersion=workspace.getSnapshot().version;
  const listeners = new Set<() => void>();
  function update(patch: Partial<typeof state>) { state = Object.freeze({ ...state, ...patch }); for (const listener of listeners) listener(); }
  async function exclusive<T>(operation: () => Promise<T>,runtimeControlsAvailable=false): Promise<T> {
    if (state.busy || state.activeWorkspace.getSnapshot().busy) throw Error('Studio is busy');
    update({ busy: true,runtimeControlsAvailable });
    try { return await operation(); } finally { update({ busy: false,runtimeControlsAvailable:true }); }
  }
  function localDraftVersion(){return storySourceCatalog?.getSnapshot().version??workspace.getSnapshot().version;}
  function currentDraftVersion(){const local=localDraftVersion();if(local!==observedWorkspaceVersion){draftVersion+=local>observedWorkspaceVersion?local-observedWorkspaceVersion:1;observedWorkspaceVersion=local;}return draftVersion;}
  function requireDraftVersion(expected:number){if(!Number.isSafeInteger(expected)||expected!==currentDraftVersion())throw Error('Editor changed; read its source again');}
  function advanceDocumentMode(){draftVersion++;observedWorkspaceVersion=localDraftVersion();}
  function storySource(source:SourceBundle):StoryVisualSource['source']{if(source.sdkVersion!=='0.2.0')throw Error('Story visuals require SDK 0.2.0 source');return source as StoryVisualSource['source'];}
  function acceptedStoryDocument(){const accepted=ports.acceptedDocument?.();return accepted?.version===7?validateStorySceneDocumentV7(accepted):storyDocument;}
  function assembledStoryDocument(){
    if(!storySourceCatalog||!storyDocument)throw Error('Story v7 document is unavailable');
    const base=acceptedStoryDocument()??storyDocument,byId=new Map(base.visuals.map(row=>[row.id,row]));
    const visuals=storySourceCatalog.getSnapshot().visualIds.map(id=>{const cached=byId.get(id);if(!cached)throw Error(`Accepted controls are unavailable for Story visual ${id}`);return Object.freeze({...cached,source:storySource(structuredClone(storySourceCatalog!.snapshot(id).source))});});
    return createStorySceneDocumentV7(visuals,base.settings,base.tempo,base.story);
  }
  async function installStoryDocument(document:StorySceneDocumentV7,selectedVisualId?:string){
    const selected=document.visuals.some(row=>row.id===selectedVisualId)?selectedVisualId!:document.story.normalVisualId;
    const catalog=createStorySourceWorkspace(document.visuals.map(row=>({id:row.id,source:row.source})),selected);
    await catalog.markAccepted(catalog.getSnapshot().version);
    storySourceCatalog=catalog;storyDocument=document;libraryLinks=Object.freeze([]);story=null;retainStoryVersion=false;
    pendingDocumentControls=null;pendingDocumentAnimations=null;pendingDocumentTempo=null;
    advanceDocumentMode();
    update({activeWorkspace:catalog.selectedWorkspace,storySourceCatalog:catalog,libraryDirty:false,libraryUpdates:Object.freeze([]),libraryFallbacks:Object.freeze([])});
    ports.selectVisual?.(selected);
  }
  function installLegacyMode(){if(!storySourceCatalog)return;storySourceCatalog=null;storyDocument=null;advanceDocumentMode();update({activeWorkspace:workspace,storySourceCatalog:null});}
  async function submitStoryDocument(documentInput:unknown,expectedVersion:number,selectedVisualId?:string){
    requireDraftVersion(expectedVersion);if(!ports.submitDocument)throw Error('Whole-document Story build is unavailable');
    const candidate=await verifyStorySceneDocumentV7(documentInput);requireDraftVersion(expectedVersion);
    const selected=candidate.visuals.some(row=>row.id===selectedVisualId)?selectedVisualId!:candidate.story.normalVisualId;
    let promoted:StorySceneDocumentV7=candidate;
    const activate=async()=>{await ports.submitDocument!(candidate);const accepted=ports.acceptedDocument?.();promoted=accepted?.version===7?await verifyStorySceneDocumentV7(accepted):candidate;};
    if(storySourceCatalog){
      const catalog=storySourceCatalog;await catalog.replaceVisuals(candidate.visuals.map(row=>({id:row.id,source:row.source})),selected,catalog.getSnapshot().version,async()=>activate());
      storyDocument=promoted;libraryLinks=Object.freeze([]);story=null;retainStoryVersion=false;pendingDocumentControls=null;pendingDocumentAnimations=null;pendingDocumentTempo=null;
      update({activeWorkspace:catalog.selectedWorkspace,storySourceCatalog:catalog,libraryDirty:false,libraryUpdates:Object.freeze([]),libraryFallbacks:Object.freeze([])});ports.selectVisual?.(selected);
    }else{
      const base=workspace.getSnapshot();await workspace.submit(base.source,base.version,async()=>activate());await installStoryDocument(promoted,selected);
    }
    return promoted;
  }
  type LegacySubmitOptions=NonNullable<Parameters<Ports['submit']>[1]>;
  async function submitLegacySource(source:SourceBundle,expectedVersion:number,options:LegacySubmitOptions){
    requireDraftVersion(expectedVersion);
    const catalog=storySourceCatalog;
    if(catalog){
      const snapshot=catalog.getSnapshot(),entries=snapshot.sources.map(row=>({id:row.id,source:row.snapshot.source}));
      await catalog.replaceVisuals(entries,snapshot.selectedVisualId,snapshot.version,async()=>{
        requireDraftVersion(expectedVersion);
        const baseVersion=workspace.getSnapshot().version;
        await workspace.submit(source,baseVersion,admitted=>ports.submit(admitted,options));
        workspace.markSaved(workspace.getSnapshot().version);
        installLegacyMode();
      });
      return;
    }
    const workspaceVersion=workspace.getSnapshot().version;
    await workspace.submit(source,workspaceVersion,admitted=>ports.submit(admitted,options));
    workspace.markSaved(workspace.getSnapshot().version);
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
  async function activate(source: SourceBundle, expectedVersion: number,nextLinks:readonly SceneLibraryLink[]=libraryLinks,output?:OutputSettings,nextStory:SceneStoryV1|null=story) {
    const openedControls=pendingDocumentControls;
    await workspace.submit(source, expectedVersion, admitted => ports.submit(admitted,
      {story:nextStory,...(pendingDocumentControls?{savedControls:pendingDocumentControls}:{}),...(pendingDocumentAnimations?{savedControlAnimations:pendingDocumentAnimations}:{}),...(pendingDocumentTempo?{savedTempo:pendingDocumentTempo}:{}),...(output?{output}:{})}));
    libraryLinks=validateSceneLibraryLinks(nextLinks);
    story=nextStory;
    retainStoryVersion=source.sdkVersion==='0.2.0'&&(retainStoryVersion||story!==null);
    pendingDocumentControls = null;
    pendingDocumentAnimations=null;
    pendingDocumentTempo=null;
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
      try{next=applyLibraryComponent(next.source,next.links,await resolveLibraryComponent(await ports.readLibraryComponent(row.componentId),(id,revision)=>ports.readLibraryComponent!(id,revision)),row.mountPath);}
      catch(error){if(!existing)throw error;fallbacks.push({componentId:existing.componentId,resolvedRevision:existing.resolvedRevision,message:error instanceof Error?error.message:String(error)});}
    }
    return {source:next.source,links:next.links,fallbacks:Object.freeze(fallbacks)};
  }
  async function buildLinked(source:SourceBundle,expectedVersion:number,requested?:readonly Readonly<{componentId:string;mountPath:string}>[],requestedStory?:SceneStoryV1|null){
    const nextStory=requestedStory===undefined?story:requestedStory===null?null:normalizeSceneStory(requestedStory);
    if(nextStory&&source.sdkVersion!=='0.2.0')throw Error('Story scenes require SDK 0.2.0 source');
    const previousLinks=libraryLinks,resolution=await resolveLinked(source,previousLinks,requested);
    const changed=JSON.stringify(previousLinks)!==JSON.stringify(resolution.links)||JSON.stringify(story)!==JSON.stringify(nextStory);
    try{await activate(resolution.source,expectedVersion,resolution.links,undefined,nextStory);update({libraryDirty:state.libraryDirty||changed,libraryUpdates:Object.freeze([]),libraryFallbacks:resolution.fallbacks});}
    catch(error){const revised=resolution.links.some(link=>previousLinks.some(before=>before.componentId===link.componentId&&before.resolvedRevision!==link.resolvedRevision));
      if(revised)update({libraryFallbacks:Object.freeze([...resolution.fallbacks,{componentId:resolution.links.find(link=>previousLinks.some(before=>before.componentId===link.componentId&&before.resolvedRevision!==link.resolvedRevision))!.componentId,resolvedRevision:previousLinks.find(before=>resolution.links.some(link=>link.componentId===before.componentId&&link.resolvedRevision!==before.resolvedRevision))!.resolvedRevision,message:`Update failed; using saved revision. ${error instanceof Error?error.message:String(error)}`}])});
      throw error;
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    read() {
      if(storySourceCatalog){const source=structuredClone(storySourceCatalog.selectedWorkspace.getSnapshot().source),document=assembledStoryDocument();return {source,document:structuredClone(document),draftVersion:currentDraftVersion(),libraryLinks:Object.freeze([]),story:null};}
      const snapshot=workspace.getSnapshot(),source=structuredClone(snapshot.source);return {source,document:null,draftVersion:currentDraftVersion(),libraryLinks:structuredClone(libraryLinks),story:structuredClone(story)};
    },
    controlsChanged() { if (pendingDocumentControls) return; controlsVersion++; update({ controlsDirty: true }); },
    build(source: SourceBundle, expectedVersion: number,requested?:readonly Readonly<{componentId:string;mountPath:string}>[],requestedStory?:SceneStoryV1|null) {
      return exclusive(()=>{requireDraftVersion(expectedVersion);if(storySourceCatalog)throw Error('Scene v7 requires a whole document build');return buildLinked(source,workspace.getSnapshot().version,requested,requestedStory);},true);
    },
    buildDocument(document:StorySceneDocumentV7,expectedVersion:number){return exclusive(()=>submitStoryDocument(document,expectedVersion,storySourceCatalog?.getSnapshot().selectedVisualId),true);},
    selectVisual(visualId:string){if(!storySourceCatalog)throw Error('Story source selection requires Scene v7');storySourceCatalog.select(visualId);ports.selectVisual?.(visualId);update({activeWorkspace:storySourceCatalog.selectedWorkspace,storySourceCatalog});},
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
        const expectedVersion=currentDraftVersion();
        const look = await ports.readLook(id);
        const document = await verifySceneDocument(look.document);
        requireDraftVersion(expectedVersion);
        if(document.version===7){await submitStoryDocument(document,currentDraftVersion(),storySourceCatalog?.getSnapshot().selectedVisualId);token=undefined;storySourceCatalog!.markSaved(storySourceCatalog!.getSnapshot().version);update({name:look.name,controlsDirty:false,libraryDirty:false,libraryUpdates:[],libraryFallbacks:[]});return look;}
        if (document.version === 5 && document.libraryLinks.length) throw Error('This look is not a frozen snapshot');
        const savedControls = await sceneControlSnapshot(document);
        requireDraftVersion(expectedVersion);
        const savedControlAnimations = document.controlAnimations ?? [];
        await submitLegacySource(document.source,expectedVersion,{savedControls,savedControlAnimations,savedTempo:document.tempo, output: document.settings,story:document.version===6?document.story??null:null});
        token = undefined;
        libraryLinks = Object.freeze([]);
        story=document.version===6?document.story??null:null;retainStoryVersion=document.version===6;
        pendingDocumentControls = null;
        pendingDocumentAnimations = null;
        pendingDocumentTempo=null;
        workspace.markSaved(workspace.getSnapshot().version);
        update({name: look.name, controlsDirty: false, libraryDirty: false, libraryUpdates: [], libraryFallbacks: []});
        return look;
      });
    },
    exportSource(name: string) {
      return exclusive(async () => {
        if(storySourceCatalog)throw Error('Resolume export does not support multi-visual Story playback yet');
        if (!ports.export) throw Error('Export is unavailable');
        const snapshot = workspace.getSnapshot(), source = structuredClone(snapshot.source);
        await activate(source, snapshot.version);
        return ports.export({ name, document: createSceneDocument(source, { ...DEFAULT_OUTPUT }, await documentControls(source,true),libraryLinks,validateControlAnimationBindings(ports.getControlAnimations?.()??[]),normalizeTempoSettings(ports.getTempo?.()),story,retainStoryVersion) });
      });
    },
    save(saveAs = false) {
      return exclusive(async () => {
        if(storySourceCatalog){
          await ports.settleControls?.();currentDraftVersion();const controlVersion=controlsVersion,catalogVersion=storySourceCatalog.getSnapshot().version,document=assembledStoryDocument();
          const result=await ports.save({token,saveAs,document});
          if(result){token=result.token;if(storySourceCatalog.getSnapshot().version===catalogVersion)storySourceCatalog.markSaved(catalogVersion);storyDocument=document;update({name:result.name,controlsDirty:controlsVersion!==controlVersion,libraryDirty:false});}
          return result;
        }
        const snapshot = workspace.getSnapshot(), controlVersion = controlsVersion;
        const source=structuredClone(snapshot.source);
        const document = createSceneDocument(source, ports.getOutput?.()??{ ...DEFAULT_OUTPUT }, await documentControls(source),libraryLinks,validateControlAnimationBindings(pendingDocumentAnimations??ports.getControlAnimations?.()??[]),normalizeTempoSettings(pendingDocumentTempo??ports.getTempo?.()),story,retainStoryVersion);
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
        if(storySourceCatalog){
          requireDraftVersion(expectedVersion);const controlVersion=controlsVersion,catalogVersion=storySourceCatalog.getSnapshot().version,document=assembledStoryDocument(),result=await ports.savePath({path,document,overwrite});
          if(!result)return null;token=result.token;if(storySourceCatalog.getSnapshot().version===catalogVersion)storySourceCatalog.markSaved(catalogVersion);storyDocument=document;update({name:result.name,controlsDirty:controlsVersion!==controlVersion,libraryDirty:false});
          return {name:result.name,path,draftVersion:currentDraftVersion()};
        }
        requireDraftVersion(expectedVersion);const snapshot=workspace.getSnapshot();
        const controlVersion=controlsVersion,source=structuredClone(snapshot.source);
        const document=createSceneDocument(source,ports.getOutput?.()??{...DEFAULT_OUTPUT},await documentControls(source),libraryLinks,validateControlAnimationBindings(pendingDocumentAnimations??ports.getControlAnimations?.()??[]),normalizeTempoSettings(pendingDocumentTempo??ports.getTempo?.()),story,retainStoryVersion);
        const result=await ports.savePath({path,document,overwrite});
        if(!result)return null;
        token=result.token;workspace.markSaved(snapshot.version);update({name:result.name,controlsDirty:controlsVersion!==controlVersion,libraryDirty:false});
        return {name:result.name,path,draftVersion:currentDraftVersion()};
      });
    },
    openPath(path:string,expectedVersion:number) {
      return exclusive(async()=>{
        if(!ports.openPath)throw Error('Path open is unavailable');
        await ports.settleControls?.();
        requireDraftVersion(expectedVersion);
        const result=await ports.openPath(path);if(!result)return null;
        const document=await verifySceneDocument(result.document);
        requireDraftVersion(expectedVersion);
        if(document.version===7){await submitStoryDocument(document,expectedVersion,storySourceCatalog?.getSnapshot().selectedVisualId);token=result.token;storySourceCatalog!.markSaved(storySourceCatalog!.getSnapshot().version);update({name:result.name,controlsDirty:false,libraryDirty:false,libraryUpdates:Object.freeze([]),libraryFallbacks:Object.freeze([])});return {name:result.name,path,draftVersion:currentDraftVersion()};}
        if(document.settings.fps!==60||document.settings.seed!==0)throw Error('This build supports 60 fps with seed 0');
        const savedControls=await sceneControlSnapshot(document),savedAnimations=document.controlAnimations??Object.freeze([]),savedLinks=document.version===5?document.libraryLinks:Object.freeze([]);
        requireDraftVersion(expectedVersion);
        const resolution=await resolveLinked(document.source,savedLinks);
        requireDraftVersion(expectedVersion);
        await submitLegacySource(resolution.source,expectedVersion,{savedControls,savedControlAnimations:savedAnimations,savedTempo:document.tempo,output:document.settings,story:document.version===6?document.story??null:null});
        token=result.token;libraryLinks=resolution.links;story=document.version===6?document.story??null:null;retainStoryVersion=document.version===6;pendingDocumentControls=null;pendingDocumentAnimations=null;pendingDocumentTempo=null;
        update({name:result.name,controlsDirty:false,libraryDirty:JSON.stringify(resolution.links)!==JSON.stringify(savedLinks),libraryUpdates:Object.freeze([]),libraryFallbacks:resolution.fallbacks});
        return {name:result.name,path,draftVersion:currentDraftVersion()};
      });
    },
    open() {
      return exclusive(async () => {
        if (!ports.open) throw Error('Open is unavailable');
        const expectedVersion=currentDraftVersion();
        const result = await ports.open(); if (!result) return null;
        const document = await verifySceneDocument(result.document);
        requireDraftVersion(expectedVersion);
        if(document.version===7){await submitStoryDocument(document,currentDraftVersion(),storySourceCatalog?.getSnapshot().selectedVisualId);token=result.token;storySourceCatalog!.markSaved(storySourceCatalog!.getSnapshot().version);update({name:result.name,controlsDirty:false,libraryDirty:false,libraryUpdates:Object.freeze([]),libraryFallbacks:Object.freeze([])});return result;}
        if (document.settings.fps !== 60 || document.settings.seed !== 0)
          throw Error('This build supports 60 fps with seed 0');
        const savedControls=await sceneControlSnapshot(document);
        requireDraftVersion(expectedVersion);
        const savedAnimations=document.controlAnimations??Object.freeze([]);
        const savedLinks=document.version===5?document.libraryLinks:Object.freeze([]);
        const resolution=await resolveLinked(document.source,savedLinks);
        requireDraftVersion(expectedVersion);
        const libraryChanged=JSON.stringify(resolution.links)!==JSON.stringify(savedLinks);
        let acceptedSource=resolution.source,acceptedLinks=resolution.links,fallbacks=resolution.fallbacks;
        const options={savedControls,savedControlAnimations:savedAnimations,savedTempo:document.tempo,output:document.settings,story:document.version===6?document.story??null:null};
        try { await submitLegacySource(acceptedSource,expectedVersion,options); }
        catch(error) {
          if(!libraryChanged){if(!storySourceCatalog){requireDraftVersion(expectedVersion);const current=workspace.getSnapshot().source;if(document.source.entry===current.entry&&JSON.stringify(document.source)!==JSON.stringify(current))workspace.replaceDocument(document.source);}throw error;}
          requireDraftVersion(expectedVersion);await submitLegacySource(document.source,expectedVersion,options);
          acceptedSource=document.source;acceptedLinks=savedLinks;
          fallbacks=Object.freeze([...resolution.fallbacks,...savedLinks.map(link=>({componentId:link.componentId,resolvedRevision:link.resolvedRevision,message:`Update failed; using saved revision. ${error instanceof Error?error.message:String(error)}`}))]);
        }
        token=result.token;libraryLinks=acceptedLinks;story=document.version===6?document.story??null:null;retainStoryVersion=document.version===6;
        pendingDocumentControls=null;pendingDocumentAnimations=null;pendingDocumentTempo=null;
        const accepted=ports.getControlSnapshot?.();
        const normalized=accepted?(acceptedSource.sdkVersion==='0.4.0'?validateSavedNodeControlSnapshot(accepted):validateSavedControlSnapshot(accepted)):undefined;
        const controlsDirty=!!normalized&&JSON.stringify(normalized)!==JSON.stringify(savedControls);
        if(controlsDirty)controlsVersion++;
        update({name:result.name,controlsDirty,libraryDirty:JSON.stringify(acceptedLinks)!==JSON.stringify(savedLinks),libraryUpdates:Object.freeze([]),libraryFallbacks:fallbacks});
        return result;
      });
    },
    addSource(expectedVersion:number){return exclusive(async()=>{
      requireDraftVersion(expectedVersion);await ports.settleControls?.();
      if(!ports.acceptedDocument)throw Error('Adding a source requires an accepted document');
      const accepted=await verifySceneDocument(ports.acceptedDocument());let candidate:StorySceneDocumentV7,newVisualId:string;
      if(accepted.version===6){
        if(!accepted.story)throw Error('Add source requires an accepted Story definition');
        if(await sceneSourceHash(workspace.getSnapshot().source)!==await sceneSourceHash(accepted.source))throw Error('Build the source draft before adding another visual');
        const controls=validateSavedControlSnapshot(accepted.controls),animations=validateControlAnimationBindings(accepted.controlAnimations??[]),first='visual1';newVisualId='visual2';
        const converted:SceneStoryV2={version:2,normalVisualId:first,crossfadeSeconds:.35,
          beats:Object.freeze(accepted.story.beats.map(beat=>Object.freeze({...beat,visualId:first}))),
          sequence:Object.freeze(accepted.story.sequence.map(occurrence=>Object.freeze({...occurrence,visualId:first})))};
        candidate=createStorySceneDocumentV7([
          {id:first,source:storySource(accepted.source),controls,controlAnimations:animations},
          {id:newVisualId,source:storySource(accepted.source),controls,controlAnimations:animations},
        ],accepted.settings,accepted.tempo,converted);
      }else if(accepted.version===7){
        if(!storySourceCatalog)throw Error('Open the accepted Scene v7 document before adding a source');
        const acceptedById=new Map(accepted.visuals.map(row=>[row.id,row]));
        for(const row of storySourceCatalog.getSnapshot().sources){const saved=acceptedById.get(row.id);if(!saved||await sceneSourceHash(row.snapshot.source)!==await sceneSourceHash(saved.source))throw Error('Build every source draft before adding another visual');}
        let suffix=1;while(acceptedById.has(`visual${suffix}`))suffix++;newVisualId=`visual${suffix}`;
        const selected=acceptedById.get(storySourceCatalog.getSnapshot().selectedVisualId);if(!selected)throw Error('Selected accepted Story visual is unavailable');
        candidate=createStorySceneDocumentV7([...accepted.visuals,{...selected,id:newVisualId}],accepted.settings,accepted.tempo,accepted.story);
      }else throw Error('Add source requires an accepted Story scene');
      return submitStoryDocument(candidate,expectedVersion,newVisualId);
    });},
    checkLibraryUpdates(){return exclusive(async()=>{const checked=await checkLibraryLinks(workspace.getSnapshot().source,libraryLinks,async id=>{if(!ports.readLibraryComponent)throw Error('The component library is unavailable');return ports.readLibraryComponent(id);});update({libraryUpdates:checked.updates,libraryFallbacks:checked.fallbacks});return checked;});},
    applyLibraryUpdates(){return exclusive(()=>buildLinked(sessionSource(),workspace.getSnapshot().version));},
    forkLibraryComponent(componentId:string){if(state.busy||workspace.getSnapshot().busy)throw Error('Studio is busy');const forked=forkLink(workspace.getSnapshot().source,libraryLinks,componentId);libraryLinks=forked.links;update({libraryDirty:true,libraryUpdates:Object.freeze(state.libraryUpdates.filter(item=>item.componentId!==componentId)),libraryFallbacks:Object.freeze(state.libraryFallbacks.filter(item=>item.componentId!==componentId))});},
  };
  function sessionSource(){return structuredClone(workspace.getSnapshot().source);}
}
