import {useEffect,useState} from 'react';
import {Alert,Button,Chip} from '@mui/material';
import type {ComponentLibraryClient} from '../library-client.ts';
import type {LibraryComponent,LibraryComponentSummary,SceneLibraryLink} from '../../../../packages/core/src/component-library.ts';

type Update=Readonly<{componentId:string;name:string;resolvedRevision:number;availableRevision:number}>;
type Fallback=Readonly<{componentId:string;resolvedRevision:number;message:string}>;
export function LibraryPanel({client,links,updates,fallbacks,refreshKey=0,onApplyUpdates,onFork,onError}:{client:ComponentLibraryClient;links:readonly SceneLibraryLink[];updates:readonly Update[];fallbacks:readonly Fallback[];refreshKey?:number;onApplyUpdates():Promise<void>;onFork(id:string):void;onError(reason:unknown):void}){
 const [items,setItems]=useState<readonly LibraryComponentSummary[]>([]),[selected,setSelected]=useState<LibraryComponent|null>(null),[file,setFile]=useState(''),[message,setMessage]=useState('');
 async function load(){try{const next=await client.list();setItems(next);if(selected&&!next.some(item=>item.id===selected.id))setSelected(null);}catch(reason){onError(reason);}}
 useEffect(()=>{void load();},[refreshKey]);
 async function inspect(id:string){try{const value=await client.read(id);setSelected(value);setFile(value.source.entry);setMessage('');}catch(reason){onError(reason);}}
 async function copy(){if(!selected)return;try{await client.copyRequest(selected.id);setMessage('Agent request copied.');}catch(reason){onError(reason);}}
 async function apply(){try{await onApplyUpdates();await load();}catch(reason){onError(reason);}}
 const names=new Map(items.map(item=>[item.id,item.name]));
 return <section className="library-panel" aria-label="Shared component library">
  <header className="library-heading"><div><h2>Library</h2><p>Reusable components stored by this Studio profile.</p></div><Button onClick={()=>void load()}>Refresh</Button></header>
  {updates.map(update=><Alert key={update.componentId} severity="info"><strong>{update.name}</strong> revision {update.availableRevision} is available. This scene uses revision {update.resolvedRevision}. <Button onClick={()=>void apply()}>Apply update</Button></Alert>)}
  {fallbacks.map(fallback=><Alert key={`${fallback.componentId}-${fallback.message}`} severity="warning">Using saved revision {fallback.resolvedRevision} for {names.get(fallback.componentId)??fallback.componentId}. {fallback.message}</Alert>)}
  <div className="library-content"><nav aria-label="Library components">
   {items.length===0?<p className="hint">No shared components yet. An agent can create one with Lux MCP.</p>:items.map(item=><Button key={item.id} className="library-entry" aria-pressed={selected?.id===item.id} onClick={()=>void inspect(item.id)}><span><strong>{item.name}</strong><Chip size="small" label={`r${item.revision}`}/></span><small>{item.description}</small></Button>)}
  </nav><div className="library-source">
   {selected?<><div className="library-source-heading"><div><h3>{selected.name}</h3><p>{selected.description}</p></div><Button onClick={()=>void copy()}>Copy agent request</Button></div>
    <div className="library-files" role="navigation" aria-label="Component source files">{Object.keys(selected.source.files).map(path=><Button key={path} aria-pressed={file===path} onClick={()=>setFile(path)}>{path}</Button>)}</div>
    <pre tabIndex={0} aria-label={`${file} source`}><code>{selected.source.files[file]}</code></pre></>:<p className="hint">Select a component to read its source.</p>}
  </div></div>
  {links.length>0&&<section className="library-links"><h3>Linked in this scene</h3>{links.map(link=><div key={link.componentId}><span>{names.get(link.componentId)??link.componentId} · revision {link.resolvedRevision}</span><Button onClick={()=>onFork(link.componentId)}>Fork {names.get(link.componentId)??link.componentId}</Button></div>)}</section>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
