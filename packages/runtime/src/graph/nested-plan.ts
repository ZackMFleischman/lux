import type { NodePath, PlannedInput, ResolvedDefinitions } from '../../../runtime-contracts/src/graph.ts';
import { nodeIdSchema } from '../../../runtime-contracts/src/identities.ts';
import { normalizeComponentMetadata } from '../../../runtime-contracts/src/components.mjs';
import { nestedGraphLimits as limits } from '../../../runtime-contracts/src/nested-graph.ts';
import type { ValidatedNestedGraph, NodeControlOverride, NestedExecutionPlan, NestedPlannedNode, PublicControlTarget } from '../../../runtime-contracts/src/nested-graph.ts';
import { isValidatedNestedGraph, expand, workCounter, resolveOutput, pathKey, comparePaths, compare, snapshot, record, checked, patch, invalid, publish } from './nested-validate.ts';

export function planNestedGraph(value:ValidatedNestedGraph,overrides?:readonly NodeControlOverride[]):NestedExecutionPlan {
  if(!isValidatedNestedGraph(value))throw new TypeError('Expected validated nested graph');
  const raw=snapshot([overrides??[]],['overrides'],limits.overrideBytes,false)[0];if(!Array.isArray(raw))invalid('overrides','expected array');
  const charge=workCounter(),defs=value.definitions,expanded=expand(defs,value.graph.rootDefinitionHash,charge);
  const paths=new Set<string>(),writers=new Set<string>();
  for(const v of raw){
    const r=record(v,'overrides',['nodePath','values']);if(!Array.isArray(r.nodePath)||r.nodePath.length>limits.graphLevels)invalid('overrides','invalid node path');
    const path:NodePath=r.nodePath.map(id=>checked(()=>nodeIdSchema.parse(id),'overrides.nodePath')),key=pathKey(path);
    if(paths.has(key))invalid('overrides','duplicate override path');paths.add(key);const o=expanded.occurrences.get(key);if(!o)invalid('overrides','unknown node path');
    const values=patch(defs[o.hash]!.metadata.controls,r.values,'overrides.controls',false);
    for(const [id,n] of Object.entries(values))for(const t of o.controls[id]!){charge();const target=JSON.stringify([t.nodePath,t.controlId]);if(writers.has(target))invalid('overrides','explicit control writers overlap');writers.add(target);expanded.leaves.get(pathKey(t.nodePath))!.values[t.controlId]=n;}
  }
  const final=resolveOutput(defs,expanded.root,value.graph.outputPort,charge);
  const incoming=new Map([...expanded.leaves.keys()].map(k=>[k,[] as PlannedInput[]]));
  for(const e of expanded.edges)incoming.get(pathKey(e.to.nodePath))!.push({portId:e.to.portId,source:{nodePath:e.from.nodePath,portId:e.from.portId}});
  const reachable=new Set<string>(),pending=[pathKey(final.nodePath)];
  while(pending.length){const key=pending.pop()!;if(reachable.has(key))continue;reachable.add(key);for(const i of incoming.get(key)!)pending.push(pathKey(i.source.nodePath));}
  const outgoing=new Map([...reachable].map(k=>[k,new Set<string>()])),degrees=new Map([...reachable].map(k=>[k,0]));
  for(const e of expanded.edges){const to=pathKey(e.to.nodePath),from=pathKey(e.from.nodePath);if(!reachable.has(to))continue;const targets=outgoing.get(from)!;if(!targets.has(to)){targets.add(to);degrees.set(to,degrees.get(to)!+1);}}
  const ready=[...reachable].filter(k=>degrees.get(k)===0),nodes:NestedPlannedNode[]=[];
  const compareKeys=(a:string,b:string)=>comparePaths(expanded.leaves.get(a)!.path,expanded.leaves.get(b)!.path);
  while(ready.length){
    ready.sort(compareKeys);const key=ready.shift()!,leaf=expanded.leaves.get(key)!;
    nodes.push({nodePath:[...leaf.path],definitionHash:leaf.hash,inputs:incoming.get(key)!.sort((a,b)=>compare(a.portId,b.portId)).map(i=>({portId:i.portId,source:{nodePath:[...i.source.nodePath],portId:i.source.portId}})),initialControls:Object.fromEntries(defs[leaf.hash]!.metadata.controls.map(c=>[c.id,leaf.values[c.id]!]))});
    for(const to of outgoing.get(key)!){const n=degrees.get(to)!-1;degrees.set(to,n);if(!n)ready.push(to);}
  }
  const definitions:ResolvedDefinitions=Object.fromEntries([...new Set(nodes.map(n=>n.definitionHash))].sort(compare).map(h=>[h,{kind:'code' as const,metadata:normalizeComponentMetadata(defs[h]!.metadata)}]));
  const rootMetadata=normalizeComponentMetadata(defs[value.graph.rootDefinitionHash]!.metadata);
  const publicControlBindings:Record<string,PublicControlTarget[]>=Object.fromEntries(rootMetadata.controls.map(c=>[c.id,expanded.root.controls[c.id]!.map(t=>({nodePath:[...t.nodePath],controlId:t.controlId,active:reachable.has(pathKey(t.nodePath))}))]));
  const prunedNodePaths=[...expanded.leaves].filter(([key])=>!reachable.has(key)).map(([,leaf])=>[...leaf.path]).sort(comparePaths);
  const result:NestedExecutionPlan={version:2,nodes,definitions,finalOutput:{nodePath:[...final.nodePath],portId:final.portId},publicControls:rootMetadata.controls,publicControlBindings,prunedNodePaths};
  return publish(result,'plan');
}
