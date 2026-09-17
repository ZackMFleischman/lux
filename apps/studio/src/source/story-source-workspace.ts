import type {SourceBundle} from '../../../../packages/runtime-contracts/src/index.ts';
import {equalSource} from './source-equality.ts';
import {createSourceWorkspace} from './workspace.ts';
import type {SourceSnapshot,SourceWorkspace} from './workspace.ts';

export type StorySourceWorkspaceEntry=Readonly<{id:string;source:SourceBundle}>;
export type StorySourceWorkspaceSnapshot=Readonly<{
  selectedVisualId:string;visualIds:readonly string[];version:number;dirty:boolean;busy:boolean;
  sources:readonly Readonly<{id:string;snapshot:SourceSnapshot}>[];
}>;
export type StorySourceWorkspace=Readonly<{
  selectedWorkspace:SourceWorkspace;
  getSnapshot():StorySourceWorkspaceSnapshot;
  subscribe(listener:()=>void):()=>void;
  select(visualId:string):void;
  snapshot(visualId:string):SourceSnapshot;
  markSaved(expectedVersion:number):void;
  markAccepted(expectedVersion:number):Promise<void>;
  replaceVisuals(entries:readonly StorySourceWorkspaceEntry[],selectedVisualId:string,expectedVersion:number,activate:(entries:readonly StorySourceWorkspaceEntry[])=>Promise<void>):Promise<void>;
}>;

const stableId=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/,reserved=new Set(['constructor','prototype','__proto__']);
function catalog(entries:readonly StorySourceWorkspaceEntry[]){
  if(!Array.isArray(entries)||entries.length<1||entries.length>8)throw Error('Story source workspace requires 1–8 visuals');
  const result=new Map<string,SourceWorkspace>();
  for(const entry of entries){
    if(!entry||typeof entry.id!=='string'||!stableId.test(entry.id)||reserved.has(entry.id))throw Error('Invalid Story visual ID');
    if(result.has(entry.id))throw Error(`Duplicate Story visual ID ${entry.id}`);
    if(entry.source.sdkVersion!=='0.2.0')throw Error(`Story visual ${entry.id} requires SDK 0.2.0 source`);
    result.set(entry.id,createSourceWorkspace(entry.source));
  }
  return result;
}

export function createStorySourceWorkspace(initial:readonly StorySourceWorkspaceEntry[],initialSelectedVisualId=initial[0]?.id??''):StorySourceWorkspace{
  let workspaces=catalog(initial),selectedVisualId=initialSelectedVisualId,version=0,replacing=false,presentationSequence=0;
  if(!workspaces.has(selectedVisualId))throw Error('Unknown selected Story visual');
  const listeners=new Set<()=>void>(),subscriptions=new Map<string,()=>void>(),last=new Map<string,SourceSnapshot>(),presentation=new Map<string,{local:number;key:number}>();
  let current:StorySourceWorkspaceSnapshot,selectedCurrent:SourceSnapshot;
  const selected=()=>{const workspace=workspaces.get(selectedVisualId);if(!workspace)throw Error('Unknown selected Story visual');return workspace;};
  const hasBusyChild=()=>[...workspaces.values()].some(workspace=>workspace.getSnapshot().busy);
  function presentationKey(id:string,snapshot:SourceSnapshot){const prior=presentation.get(id);if(prior&&prior.local===snapshot.documentKey)return prior.key;const row={local:snapshot.documentKey,key:++presentationSequence};presentation.set(id,row);return row.key;}
  function selectedSnapshot(){const snapshot=selected().getSnapshot();return Object.freeze({...snapshot,version,documentKey:presentationKey(selectedVisualId,snapshot),busy:replacing||hasBusyChild()});}
  function aggregate(){const sources=Object.freeze([...workspaces].map(([id,workspace])=>Object.freeze({id,snapshot:workspace.getSnapshot()})));return Object.freeze({selectedVisualId,visualIds:Object.freeze(sources.map(row=>row.id)),version,dirty:sources.some(row=>row.snapshot.dirty),busy:replacing||sources.some(row=>row.snapshot.busy),sources});}
  function refresh(){current=aggregate();selectedCurrent=selectedSnapshot();for(const listener of listeners)listener();}
  function attach(){
    for(const [id,workspace] of workspaces){
      last.set(id,workspace.getSnapshot());
      subscriptions.set(id,workspace.subscribe(()=>{const before=last.get(id)!,next=workspace.getSnapshot();last.set(id,next);if(!equalSource(before.source,next.source)||before.documentKey!==next.documentKey)version++;refresh();}));
    }
  }
  function detach(){for(const unsubscribe of subscriptions.values())unsubscribe();subscriptions.clear();last.clear();}
  attach();current=aggregate();selectedCurrent=selectedSnapshot();
  const requireVersion=(expected:number)=>{if(!Number.isSafeInteger(expected)||expected!==version)throw Error('Story source document changed; read it again');};
  const requireEditable=()=>{if(replacing)throw Error('Story source workspace is busy');};
  const requireChildrenIdle=()=>{if(hasBusyChild())throw Error('Story source workspace is busy');};
  const selectedWorkspace:SourceWorkspace={
    getSnapshot:()=>selectedCurrent,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    edit(path,text){requireEditable();selected().edit(path,text);},addFile(path,text){requireEditable();selected().addFile(path,text);},openFile(path){selected().openFile(path);},closeFile(path){selected().closeFile(path);},
    markSaved(expected){requireEditable();requireVersion(expected);const workspace=selected();workspace.markSaved(workspace.getSnapshot().version);},
    replaceDocument(source){requireEditable();selected().replaceDocument(source);},
    replaceDocumentAsync(source,worker,timeout){requireEditable();return selected().replaceDocumentAsync(source,worker,timeout);},
    editAssetsAsync(assets,expected,worker,timeout){requireEditable();requireVersion(expected);const workspace=selected();return workspace.editAssetsAsync(assets,workspace.getSnapshot().version,worker,timeout);},
    undoReplacement(){requireEditable();selected().undoReplacement();},
    submit(source,expected,activate){requireEditable();requireVersion(expected);const workspace=selected();return workspace.submit(source,workspace.getSnapshot().version,activate);},
  };
  async function markRunning(set:Map<string,SourceWorkspace>){for(const workspace of set.values()){const snapshot=workspace.getSnapshot();await workspace.submit(snapshot.source,snapshot.version,async()=>{});}}
  return Object.freeze({
    selectedWorkspace,getSnapshot:()=>current,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    select(id){if(!workspaces.has(id))throw Error('Unknown Story visual');if(id===selectedVisualId)return;selectedVisualId=id;refresh();},
    snapshot(id){const workspace=workspaces.get(id);if(!workspace)throw Error('Unknown Story visual');return workspace.getSnapshot();},
    markSaved(expected){requireEditable();requireVersion(expected);for(const workspace of workspaces.values())workspace.markSaved(workspace.getSnapshot().version);},
    async markAccepted(expected){requireEditable();requireChildrenIdle();requireVersion(expected);replacing=true;refresh();try{await markRunning(workspaces);}finally{replacing=false;refresh();}},
    async replaceVisuals(entries,nextSelected,expected,activate){
      requireEditable();requireChildrenIdle();requireVersion(expected);const staged=catalog(entries);if(!staged.has(nextSelected))throw Error('Unknown selected Story visual');
      const admitted=Object.freeze([...staged].map(([id,workspace])=>Object.freeze({id,source:workspace.getSnapshot().source})));
      replacing=true;refresh();
      try{await activate(admitted);await markRunning(staged);detach();workspaces=staged;selectedVisualId=nextSelected;presentation.clear();attach();version++;}
      finally{replacing=false;refresh();}
    },
  });
}
