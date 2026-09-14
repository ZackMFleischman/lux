import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@mui/material';
import type {RuntimeView} from './service-client.ts';
import type {NodePath} from '../../../packages/runtime-contracts/src/graph.ts';

export const nodeKey=(path:NodePath)=>JSON.stringify(path);
type Profile=NonNullable<RuntimeView['composition']>;
function profileOccurrence(profile:Profile,path:NodePath){let definitionHash=profile.graph.rootDefinitionHash;
  for(const nodeId of path){const definition=profile.definitions[definitionHash];if(definition?.kind!=='graph')return undefined;const node=definition.body.nodes.find(row=>row.id===nodeId);if(!node)return undefined;definitionHash=node.definitionHash;}
  const definition=profile.definitions[definitionHash];return definition?{nodePath:[...path] as NodePath,definitionHash,definition,metadata:definition.metadata}:undefined;
}
export function compositionOccurrence(runtime:RuntimeView|null,path:NodePath){return runtime?.composition?profileOccurrence(runtime.composition,path):undefined;}
function children(profile:Profile,focus:NodePath){const definition=profileOccurrence(profile,focus)?.definition;if(definition?.kind!=='graph')return [];
  return definition.body.nodes.map(node=>{const child=profile.definitions[node.definitionHash]!,nodePath=[...focus,node.id] as NodePath,siblings=definition.body.nodes.filter(row=>row.definitionHash===node.definitionHash),index=siblings.findIndex(row=>row.id===node.id);return {...node,nodePath,definition:child,metadata:child.metadata,label:child.metadata.label+(siblings.length>1?` ${index+1}`:'')};});}
export function compositionNodes(runtime:RuntimeView|null){const profile=runtime?.composition;if(!profile)return [];const current=profile,result:ReturnType<typeof children>=[];function visit(path:NodePath){for(const node of children(current,path)){result.push(node);if(node.definition.kind==='graph')visit(node.nodePath);}}visit([]);return result;}
export function compositionControlTarget(runtime:RuntimeView|null,path:NodePath,controlId:string){const profile=runtime?.composition;if(!profile)return undefined;let occurrence=compositionOccurrence(runtime,path),targetPath=[...path] as NodePath,targetControl=controlId;
  while(occurrence?.definition.kind==='graph'){const refs=occurrence.definition.body.controlBindings[targetControl];if(refs?.length!==1)return undefined;targetPath=[...targetPath,refs[0]!.nodeId];targetControl=refs[0]!.controlId;occurrence=compositionOccurrence(runtime,targetPath);}
  return occurrence?.definition.kind==='code'?{nodePath:targetPath,controlId:targetControl}:undefined;
}
export function compositionNodeLabel(runtime:RuntimeView|null,path:NodePath){if(!path.length)return compositionOccurrence(runtime,[])?.metadata.label??'Composition';const parent=path.slice(0,-1) as NodePath;return runtime?.composition?children(runtime.composition,parent).find(node=>nodeKey(node.nodePath)===nodeKey(path))?.label??compositionOccurrence(runtime,path)?.metadata.label??'Component':'Component';}
export function GraphPanel({runtime,selected,onSelect}:{runtime:RuntimeView|null;selected:string|null;onSelect:(path:NodePath|null)=>void}){
  const profile=runtime?.composition,viewport=useRef<HTMLDivElement>(null),[focus,setFocus]=useState<NodePath>([]),[view,setView]=useState({x:24,y:40,zoom:1}),drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  const focusOccurrence=compositionOccurrence(runtime,focus),activeFocus=(focusOccurrence?.definition.kind==='graph'?focus:[]) as NodePath;
  useEffect(()=>{if(nodeKey(activeFocus)!==nodeKey(focus))setFocus(activeFocus);},[profile,focus,activeFocus]);
  const nodes=useMemo(()=>profile?children(profile,activeFocus):[],[profile,nodeKey(activeFocus)]),definition=compositionOccurrence(runtime,activeFocus)?.definition,body=definition?.kind==='graph'?definition.body:null,output=body?.outputBindings.image;
  const selectedNode=nodes.find(node=>nodeKey(node.nodePath)===selected),canOpen=selectedNode?.definition.kind==='graph',width=Math.max(240,nodes.length*250-30),height=180;
  function fit(){const box=viewport.current?.getBoundingClientRect();if(!box)return;const zoom=Math.max(.2,Math.min(1,(box.width-48)/width,(box.height-48)/height));setView({x:(box.width-width*zoom)/2,y:Math.max(24,(box.height-height*zoom)/2),zoom});}
  function zoom(factor:number){setView(current=>({...current,zoom:Math.max(.2,Math.min(2,current.zoom*factor))}));}
  function enter(path:NodePath){if(compositionOccurrence(runtime,path)?.definition.kind==='graph')setFocus([...path]);}
  const parent=activeFocus.slice(0,-1) as NodePath,crumbs=activeFocus.map((_,index)=>activeFocus.slice(0,index+1) as NodePath);
  return <section className="graph-panel" aria-label="Composition graph">
    <div className="graph-toolbar"><Button onClick={()=>onSelect(null)} aria-pressed={selected===null}>Composition controls</Button>
      <nav className="graph-breadcrumb" aria-label="Component breadcrumb"><Button onClick={()=>setFocus([])}>{compositionNodeLabel(runtime,[])}</Button>{crumbs.map(path=><span key={nodeKey(path)}><span aria-hidden="true">›</span><Button aria-current={nodeKey(path)===nodeKey(activeFocus)?'page':undefined} onClick={()=>setFocus(path)}>{compositionNodeLabel(runtime,path)}</Button></span>)}</nav>
      {activeFocus.length>0&&<Button onClick={()=>setFocus(parent)} aria-label={`Back to ${compositionNodeLabel(runtime,parent)}`}>Back</Button>}
      <Button disabled={!canOpen} onClick={()=>selectedNode&&enter(selectedNode.nodePath)}>Open component</Button>
      <Button onClick={()=>zoom(1/1.2)} aria-label="Zoom out">−</Button><span>{Math.round(view.zoom*100)}%</span>
      <Button onClick={()=>zoom(1.2)} aria-label="Zoom in">+</Button><Button onClick={fit}>Fit</Button></div>
    {!runtime?<p className="hint">Build a visual to see its composition.</p>:!body?<p className="hint">This visual has no component graph. Adjust its controls in Inspector.</p>:
    <div className="graph-viewport" ref={viewport} aria-label="Graph canvas" onWheel={event=>{if(event.ctrlKey){event.preventDefault();zoom(event.deltaY<0?1.1:1/1.1);}}}
      onPointerDown={event=>{if(event.button!==0||(event.target as HTMLElement).closest('button'))return;drag.current={x:event.clientX,y:event.clientY,left:view.x,top:view.y};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{if(drag.current){const start=drag.current;setView(current=>({...current,x:start.left+event.clientX-start.x,y:start.top+event.clientY-start.y}));}}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <div className="graph-content" style={{width,height,transform:`translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}>
        <svg className="graph-wires" width={width} height={height} aria-label="Node connections">
          {body.edges.map(edge=>{const from=nodes.findIndex(node=>node.id===edge.from.nodeId),to=nodes.findIndex(node=>node.id===edge.to.nodeId);return <g key={edge.id}><title>{nodes[from]?.label} {edge.from.portId} to {nodes[to]?.label} {edge.to.portId}</title><path d={`M ${from*250+220} 82 C ${from*250+235} 82,${to*250-15} 82,${to*250} 82`}/></g>;})}
        </svg>
        {nodes.map((node,index)=><button type="button" className="graph-node" key={nodeKey(node.nodePath)} style={{left:index*250}} aria-pressed={selected===nodeKey(node.nodePath)} onClick={()=>onSelect(node.nodePath)} onDoubleClick={()=>enter(node.nodePath)} onKeyDown={event=>{if(event.key==='Enter'&&node.definition.kind==='graph'){event.preventDefault();onSelect(node.nodePath);enter(node.nodePath);}}}>
          <strong>{node.label}</strong><span className="graph-node-kind">{node.definition.kind==='graph'?'Component':Object.keys(node.metadata.inputs).length?'Effect':'Source'}</span>
          <span className="graph-ports"><span>{Object.entries(node.metadata.inputs).map(([id,port])=><span key={id}>● {port.label}</span>)}</span><span>{Object.entries(node.metadata.outputs).map(([id,port])=><span key={id}>{port.label} ●</span>)}</span></span>
          {output?.nodeId===node.id&&<span className="graph-final-output">Final output · {output.portId}</span>}
        </button>)}
      </div>
    </div>}
    {body&&<p className="graph-hint">Select a node to adjust its controls. Double-click a component to enter it. Drag the background to pan.</p>}
  </section>;
}
