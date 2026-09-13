import type { NodeId } from '../../../runtime-contracts/src/identities.ts';
import type { ExecutionPlan, PlannedNode, ResolvedDefinitions, ValidatedGraph } from '../../../runtime-contracts/src/graph.ts';
import { normalizeComponentMetadata } from '../../../runtime-contracts/src/components.mjs';
import { isValidatedGraph } from './validate.ts';

const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function planGraph(value:ValidatedGraph): ExecutionPlan {
  if(!isValidatedGraph(value))throw new TypeError('Expected validated graph');
  const {graph,definitions}=value;
  const byId=new Map(graph.nodes.map(node=>[node.id,node] as const));
  const incoming=new Map(graph.nodes.map(node=>[node.id,graph.edges.filter(edge=>edge.to.nodeId===node.id)] as const));
  const reachable=new Set<NodeId>(), pending=[graph.finalOutput.nodeId];
  while(pending.length){const id=pending.pop()!;if(reachable.has(id))continue;reachable.add(id);for(const edge of incoming.get(id)!)pending.push(edge.from.nodeId);}
  const outgoing=new Map([...reachable].map(id=>[id,new Set<NodeId>()] as const));
  const indegrees=new Map<NodeId,number>([...reachable].map(id=>[id,0]));
  for(const edge of graph.edges){
    if(!reachable.has(edge.to.nodeId))continue;
    const destinations=outgoing.get(edge.from.nodeId)!;
    if(!destinations.has(edge.to.nodeId)){destinations.add(edge.to.nodeId);indegrees.set(edge.to.nodeId,indegrees.get(edge.to.nodeId)!+1);}
  }
  const ready=[...reachable].filter(id=>indegrees.get(id)===0), nodes:PlannedNode[]=[];
  while(ready.length){
    ready.sort(compare);const id=ready.shift()!, node=byId.get(id)!;
    const inputs=incoming.get(id)!.slice().sort((a,b)=>compare(a.to.portId,b.to.portId)).map(edge=>Object.freeze({portId:edge.to.portId,source:Object.freeze({nodePath:Object.freeze([edge.from.nodeId]),portId:edge.from.portId})}));
    nodes.push(Object.freeze({nodePath:Object.freeze([id]),definitionHash:node.definitionHash,inputs:Object.freeze(inputs)}));
    for(const destination of outgoing.get(id)!){const count=indegrees.get(destination)!-1;indegrees.set(destination,count);if(count===0)ready.push(destination);}
  }
  // Re-normalization of trusted frozen metadata detaches every nested field.
  // Definitions remain exact closure hashes, never catalog-key deduplication.
  const used:ResolvedDefinitions=Object.freeze(Object.fromEntries([...new Set(nodes.map(node=>node.definitionHash))].sort(compare).map(hash=>[hash,Object.freeze({kind:'code' as const,metadata:normalizeComponentMetadata(definitions[hash]!.metadata)})])));
  return Object.freeze({version:1,nodes:Object.freeze(nodes),definitions:used,finalOutput:Object.freeze({nodePath:Object.freeze([graph.finalOutput.nodeId]),portId:graph.finalOutput.portId})});
}
