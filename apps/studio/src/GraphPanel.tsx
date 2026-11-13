import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@mui/material';
import type {RuntimeView} from './service-client.ts';
import type {NodePath} from '../../../packages/runtime-contracts/src/graph.ts';

import {nodeKey,compositionOccurrence,compositionNodes,compositionNodeLabel,orderedChildren} from './visual-model.ts';
export {nodeKey,compositionOccurrence,compositionNodes,compositionControlTarget,compositionNodeLabel} from './visual-model.ts';

export function GraphPanel({runtime,selected,onSelect}:{runtime:RuntimeView|null;selected:string|null;onSelect:(path:NodePath|null)=>void}){
  const profile = runtime?.composition;
  const viewport = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<NodePath>([]);
  const [view, setView] = useState({ x: 24, y: 40, zoom: 1 });
  const viewRef = useRef(view);
  const [panning, setPanning] = useState(false);
  const suppressClick = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  function updateView(next: typeof view) {
    viewRef.current = next;
    setView(next);
  }
  const focusOccurrence=compositionOccurrence(runtime,focus),activeFocus=(focusOccurrence?.definition.kind==='graph'?focus:[]) as NodePath;
  useEffect(()=>{if(nodeKey(activeFocus)!==nodeKey(focus))setFocus(activeFocus);},[profile,focus,activeFocus]);
  const nodes=useMemo(()=>profile?orderedChildren(profile,activeFocus):compositionNodes(runtime),[profile,runtime?.controlSchema,runtime?.controlSchemaHash,runtime?.sceneName,nodeKey(activeFocus)]),definition=compositionOccurrence(runtime,activeFocus)?.definition,body=definition?.kind==='graph'?definition.body:null,output=body?.outputBindings.image;
  const selectedNode=nodes.find(node=>nodeKey(node.nodePath)===selected),canOpen=selectedNode?.definition.kind==='graph',width=Math.max(240,nodes.length*250-30),height=Math.max(180,190+(body?.edges.length??0)*12);
  function fit(){const box=viewport.current?.getBoundingClientRect();if(!box)return;const zoom=Math.max(.2,Math.min(1,(box.width-48)/width,(box.height-48)/height));updateView({x:(box.width-width*zoom)/2,y:Math.max(24,(box.height-height*zoom)/2),zoom});}
  function zoom(factor: number, point?: { x: number; y: number }) {
    const box = viewport.current?.getBoundingClientRect();
    if (!box) return false;
    const current = viewRef.current;
    const nextZoom = Math.max(.2, Math.min(2, current.zoom * factor));
    if (nextZoom === current.zoom) return false;
    const anchor = point ?? { x: box.width / 2, y: box.height / 2 };
    const ratio = nextZoom / current.zoom;
    updateView({ x: anchor.x - (anchor.x - current.x) * ratio, y: anchor.y - (anchor.y - current.y) * ratio, zoom: nextZoom });
    return true;
  }
  useEffect(() => {
    const canvas = viewport.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      const box = canvas.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
      const delta = Math.max(-1000, Math.min(1000, event.deltaY * unit));
      event.preventDefault();
      zoom(Math.exp(-delta * .002), { x: event.clientX - box.left, y: event.clientY - box.top });
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, [!!body]);
  function endPan(event: React.PointerEvent<HTMLDivElement>, cancel = false) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    drag.current = null;
    setPanning(false);
    suppressClick.current = !cancel && gesture.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && !gesture.moved) onSelect(null);
  }
  function enter(path:NodePath){if(compositionOccurrence(runtime,path)?.definition.kind==='graph'){setFocus([...path]);viewport.current?.focus({preventScroll:true});}}
  const crumbs=activeFocus.map((_,index)=>activeFocus.slice(0,index+1) as NodePath);
  function navigate(path:NodePath){setFocus([...path]);onSelect(path.length?path:null);viewport.current?.focus({preventScroll:true});}
  return <section className="graph-panel" aria-label="Composition graph" aria-keyshortcuts="Alt+ArrowUp" onKeyDown={event=>{
    if(event.defaultPrevented||event.nativeEvent.isComposing||event.key!=='ArrowUp'||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    event.preventDefault();
    event.stopPropagation();
    if(activeFocus.length)navigate(activeFocus.slice(0,-1) as NodePath);
    viewport.current?.focus({preventScroll:true});
  }}>
    <div className="graph-toolbar">
      <nav className="graph-breadcrumb" aria-label="Component breadcrumb" tabIndex={0} title="Alt+↑: up one level">{activeFocus.length?<Button onClick={()=>navigate([])}>Scene</Button>:<span aria-current="page">Scene</span>}{crumbs.map(path=><span key={nodeKey(path)}><span aria-hidden="true">›</span>{nodeKey(path)===nodeKey(activeFocus)?<span aria-current="page">{compositionNodeLabel(runtime,path)}</span>:<Button onClick={()=>navigate(path)}>{compositionNodeLabel(runtime,path)}</Button>}</span>)}</nav>
      {canOpen&&<Button onClick={()=>selectedNode&&enter(selectedNode.nodePath)}>View inside</Button>}
      <Button onClick={()=>zoom(1/1.2)} aria-label="Zoom out">−</Button><span>{Math.round(view.zoom*100)}%</span>
      <Button onClick={()=>zoom(1.2)} aria-label="Zoom in">+</Button><Button onClick={fit}>Fit</Button></div>
    {!runtime?<p className="hint">Build a visual to see its composition.</p>:
    <div className={`graph-viewport${panning ? ' graph-panning' : ''}`} ref={viewport} aria-label="Graph canvas" tabIndex={0}
      onPointerDown={event => {
        if (drag.current) return;
        suppressClick.current = false;
        if (event.button !== 0 || event.isPrimary === false || (event.target as Element).closest('button')) return;
        event.preventDefault();
        const current = viewRef.current;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: current.x, top: current.y, moved: false };
        setPanning(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const gesture = drag.current;
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        if (Math.hypot(dx, dy) > 4) gesture.moved = true;
        if (gesture.moved) updateView({ ...viewRef.current, x: gesture.left + dx, y: gesture.top + dy });
      }}
      onPointerUp={event => endPan(event)} onPointerCancel={event => endPan(event, true)} onLostPointerCapture={event => endPan(event, true)}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      <div className="graph-content" style={{width,height,transform:`translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}>
        <svg className="graph-wires" width={width} height={height} aria-label="Node connections">
          {body?.edges.map((edge, edgeIndex) => {
            const from = nodes.findIndex(node => node.id === edge.from.nodeId);
            const to = nodes.findIndex(node => node.id === edge.to.nodeId);
            const highlighted = selected === nodeKey(nodes[from]!.nodePath) || selected === nodeKey(nodes[to]!.nodePath);
            const fromX = from * 250 + 220, toX = to * 250;
            const fromY = 82 + Object.keys(nodes[from]!.metadata.outputs).indexOf(edge.from.portId) * 20;
            const toY = 82 + Object.keys(nodes[to]!.metadata.inputs).indexOf(edge.to.portId) * 20;
            // Route a branch beneath intervening nodes instead of hiding it behind them.
            const detour = Math.abs(to - from) > 1;
            const laneY = 166 + edgeIndex * 12;
            const path = detour
              ? `M ${fromX} ${fromY} C ${fromX + 18} ${fromY},${fromX + 18} ${laneY},${fromX + 30} ${laneY} L ${toX - 30} ${laneY} C ${toX - 18} ${laneY},${toX - 18} ${toY},${toX} ${toY}`
              : `M ${fromX} ${fromY} C ${fromX + 15} ${fromY},${toX - 15} ${toY},${toX} ${toY}`;
            return <g key={edge.id} className={`graph-connection${highlighted ? ' graph-connection-selected' : ''}`}>
              <title>{nodes[from]?.label} {edge.from.portId} to {nodes[to]?.label} {edge.to.portId}</title>
              <path d={path} />
              <polygon points={`${toX - 8},${toY - 4} ${toX - 2},${toY} ${toX - 8},${toY + 4}`} />
            </g>;
          })}
        </svg>
        {nodes.map((node,index)=><button type="button" className="graph-node" key={nodeKey(node.nodePath)} style={{left:index*250}} aria-pressed={selected===nodeKey(node.nodePath)} onClick={()=>onSelect(node.nodePath)} onDoubleClick={()=>enter(node.nodePath)} onKeyDown={event=>{if(event.key==='Enter'&&node.definition.kind==='graph'){event.preventDefault();onSelect(node.nodePath);enter(node.nodePath);}}}>
          <strong>{node.label}</strong><span className="graph-node-kind">{node.definition.kind==='graph'?'Component':Object.keys(node.metadata.inputs).length?'Effect':'Source'}</span>
          <span className="graph-ports">
            <span>{Object.entries(node.metadata.inputs).map(([id, port]) => <span className="graph-port graph-port-input" key={id} title={`${port.label} input`}>
              <span className="graph-port-anchor" aria-hidden="true" /><span>{port.label}</span>
            </span>)}</span>
            <span>{Object.entries(node.metadata.outputs).map(([id, port]) => <span className="graph-port graph-port-output" key={id} title={`${port.label} output`}>
              <span>{port.label}</span><span className="graph-port-anchor" aria-hidden="true" />
            </span>)}</span>
          </span>
          {(output?.nodeId===node.id||!profile)&&<span className="graph-final-output">Final output · image</span>}
        </button>)}
      </div>
    </div>}
  </section>;
}
