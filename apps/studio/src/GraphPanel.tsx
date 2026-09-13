import {useMemo,useRef,useState} from 'react';
import {Button} from '@mui/material';
import type {RuntimeView} from './service-client.ts';
import type {NodePath} from '../../../packages/runtime-contracts/src/graph.ts';

export const nodeKey=(path:NodePath)=>JSON.stringify(path);
export function compositionNodes(runtime:RuntimeView|null){
  const profile=runtime?.composition;
  if(!profile)return [];
  return profile.nodes.map(node=>{
    const metadata=profile.definitions[node.definitionHash]!.metadata;
    const siblings=profile.nodes.filter(row=>row.definitionHash===node.definitionHash);
    const index=siblings.findIndex(row=>nodeKey(row.nodePath)===nodeKey(node.nodePath));
    return {...node,metadata,label:metadata.label+(siblings.length>1?` ${index+1}`:'')};
  });
}
export function GraphPanel({runtime,selected,onSelect}:{runtime:RuntimeView|null;selected:string|null;onSelect:(path:NodePath|null)=>void}){
  const nodes=useMemo(()=>compositionNodes(runtime),[runtime?.composition]);
  const viewport=useRef<HTMLDivElement>(null);
  const [view,setView]=useState({x:24,y:40,zoom:1});
  const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  const profile=runtime?.composition;
  const root=profile?.definitions[profile.graph.rootDefinitionHash];
  const body=root?.kind==='graph'?root.body:null;
  const output=body?.outputBindings[profile!.graph.outputPort];
  const width=Math.max(240,nodes.length*250-30),height=180;
  function fit(){const box=viewport.current?.getBoundingClientRect();if(!box)return;const zoom=Math.max(.2,Math.min(1,(box.width-48)/width,(box.height-48)/height));setView({x:(box.width-width*zoom)/2,y:Math.max(24,(box.height-height*zoom)/2),zoom});}
  function zoom(factor:number){setView(current=>({...current,zoom:Math.max(.2,Math.min(2,current.zoom*factor))}));}
  return <section className="graph-panel" aria-label="Composition graph">
    <div className="graph-toolbar"><Button onClick={()=>onSelect(null)} aria-pressed={selected===null}>Composition controls</Button>
      <Button onClick={()=>zoom(1/1.2)} aria-label="Zoom out">−</Button><span>{Math.round(view.zoom*100)}%</span>
      <Button onClick={()=>zoom(1.2)} aria-label="Zoom in">+</Button><Button onClick={fit}>Fit</Button></div>
    {!runtime?<p className="hint">Build a visual to see its composition.</p>:!body?<p className="hint">This visual has no component graph. Adjust its controls in Inspector.</p>:
    <div className="graph-viewport" ref={viewport} aria-label="Graph canvas" onWheel={event=>{if(event.ctrlKey){event.preventDefault();zoom(event.deltaY<0?1.1:1/1.1);}}}
      onPointerDown={event=>{if(event.button!==0||(event.target as HTMLElement).closest('button'))return;drag.current={x:event.clientX,y:event.clientY,left:view.x,top:view.y};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{if(drag.current){const start=drag.current;setView(current=>({...current,x:start.left+event.clientX-start.x,y:start.top+event.clientY-start.y}));}}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <div className="graph-content" style={{width,height,transform:`translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}>
        <svg className="graph-wires" width={width} height={height} aria-label="Node connections">
          {body.edges.map(edge=>{const from=nodes.findIndex(node=>node.nodePath[0]===edge.from.nodeId),to=nodes.findIndex(node=>node.nodePath[0]===edge.to.nodeId);return <g key={edge.id}><title>{nodes[from]?.label} {edge.from.portId} to {nodes[to]?.label} {edge.to.portId}</title><path d={`M ${from*250+220} 82 C ${from*250+235} 82,${to*250-15} 82,${to*250} 82`}/></g>;})}
        </svg>
        {nodes.map((node,index)=><button type="button" className="graph-node" key={nodeKey(node.nodePath)} style={{left:index*250}} aria-pressed={selected===nodeKey(node.nodePath)} onClick={()=>onSelect(node.nodePath)}>
          <strong>{node.label}</strong><span className="graph-node-kind">{Object.keys(node.metadata.inputs).length?'Effect':'Source'}</span>
          <span className="graph-ports"><span>{Object.entries(node.metadata.inputs).map(([id,port])=><span key={id}>● {port.label}</span>)}</span><span>{Object.entries(node.metadata.outputs).map(([id,port])=><span key={id}>{port.label} ●</span>)}</span></span>
          {output&&output.nodeId===node.nodePath[0]&&<span className="graph-final-output">Final output · {output.portId}</span>}
        </button>)}
      </div>
    </div>}
    {body&&<p className="graph-hint">Select a node to adjust its controls. Drag the background to pan.</p>}
  </section>;
}
