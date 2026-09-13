import test from 'node:test';
import assert from 'node:assert/strict';
import { A,B,C,D,U,h,h2,h3,hash,uuid,image,signal,clone,node,edge,metadata,basic,diamond,fanout512 } from './graph-fixtures.ts';
import type { NodeId, EdgeId, ComponentId } from '../../packages/runtime-contracts/src/identities.ts';
import type { ExecutionPlan } from '../../packages/runtime-contracts/src/graph.ts';

// Compiled by the unchanged project tsconfig, never invoked at runtime.
function readonlyTypeAssertions(node:NodeId,edge:EdgeId,component:ComponentId,plan:ExecutionPlan) {
  // @ts-expect-error Different graph namespaces cannot substitute for one another.
  const badNode:NodeId=edge;
  // @ts-expect-error NodeId likewise cannot substitute for EdgeId.
  const badEdge:EdgeId=node;
  // @ts-expect-error Existing component identity retains its distinct brand.
  const badComponent:ComponentId=node;
  // @ts-expect-error Existing component IDs are not graph node IDs.
  const badExisting:NodeId=component;
  // @ts-expect-error Plan arrays are deeply readonly.
  plan.nodes.push(plan.nodes[0]!);
  // @ts-expect-error Nested source paths are readonly.
  plan.nodes[0]!.inputs[0]!.source.nodePath[0]=node;
  // @ts-expect-error Nested component metadata remains readonly.
  plan.definitions[h]!.metadata.lifecycle.reset='seed';
  // @ts-expect-error ControlSchema nested entries remain readonly.
  plan.definitions[h]!.metadata.controls[0]!.default=1;
  void [badNode,badEdge,badComponent,badExisting];
}
void readonlyTypeAssertions;
const validation = await import('../../packages/runtime/src/graph/validate.ts').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return undefined;throw error;});
const planning = await import('../../packages/runtime/src/graph/plan.ts').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return undefined;throw error;});
assert.ok(validation,'C03a requires a graph validator implementation');
assert.ok(planning,'C03a requires a dependency planner implementation');
const {validateGraph}=validation, {planGraph}=planning;
test('a single image source plans one node and no runtime state',()=>{
  const f=basic();const p=planGraph(validateGraph(f.graph,f.definitions));
  assert.deepEqual(p,{version:1,nodes:[{nodePath:[A],definitionHash:h,inputs:[]}],definitions:f.definitions,finalOutput:{nodePath:[A],portId:'image'}});
});
test('diamond order is stable under reordering, shared producers are planned once and unused nodes prune',()=>{
  const f=diamond(), v=validateGraph(f.graph,f.definitions), p=planGraph(v);
  assert.deepEqual(p.nodes.map(n=>n.nodePath),[[A],[B],[C],[D]]);
  assert.deepEqual(p.nodes[3]!.inputs,[{portId:'left',source:{nodePath:[B],portId:'value'}},{portId:'right',source:{nodePath:[C],portId:'value'}}]);
  assert.equal(p.nodes.filter(n=>n.nodePath[0]===A).length,1);assert.ok(!p.nodes.some(n=>n.nodePath[0]===U));
  assert.deepEqual(Object.keys(p.definitions),[hash(1),h2,h3]);
  f.graph.nodes.reverse();f.graph.edges.reverse();const reordered=validateGraph(f.graph,f.definitions);assert.deepEqual(reordered,v);assert.deepEqual(planGraph(reordered),p);
  const again=planGraph(v);assert.deepEqual(again,p);assert.notEqual(again,p);assert.notEqual(again.definitions,p.definitions);assert.notEqual(again.definitions[h2]!.metadata,p.definitions[h2]!.metadata);
  assert.throws(()=>{(p.nodes[3]!.inputs[0]!.source.nodePath as any)[0]=U;},TypeError);
  assert.throws(()=>planGraph(clone(v)),/Expected validated graph/);assert.throws(()=>planGraph({graph:v.graph,definitions:v.definitions}),/Expected validated graph/);
});
test('parallel port edges count one node pair but preserve both planned inputs',()=>{
  const f=clone({graph:{version:1,nodes:[node(B,h2),node(A)],edges:[edge(2,A,'value',B,'right'),edge(1,A,'value',B,'left')],finalOutput:{nodeId:B,portId:'image'}},definitions:{[h]:{kind:'code',metadata:metadata({},{value:signal})},[h2]:{kind:'code',metadata:metadata({left:signal,right:signal})}}});
  const p=planGraph(validateGraph(f.graph,f.definitions));assert.deepEqual(p.nodes.map(n=>n.nodePath),[[A],[B]]);assert.deepEqual(p.nodes[1]!.inputs,[{portId:'left',source:{nodePath:[A],portId:'value'}},{portId:'right',source:{nodePath:[A],portId:'value'}}]);
});
test('exact closure hash controls lookup while repeated catalog keys and definitions retain separate nodes',()=>{
  const f=diamond();const p=planGraph(validateGraph(f.graph,f.definitions));assert.equal(p.nodes[1]!.definitionHash,p.nodes[2]!.definitionHash);
  f.definitions[h2]!.metadata={...f.definitions[h2]!.metadata,key:'renamed/catalog'};
  const renamed=planGraph(validateGraph(f.graph,f.definitions));assert.deepEqual(renamed.nodes,p.nodes);assert.equal(renamed.definitions[h2]!.metadata.key,'renamed/catalog');
});
test('shared UUID syntax preserves uppercase, nil, max and case-distinct node identities',()=>{
  for(const id of ['AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA','00000000-0000-0000-0000-000000000000','ffffffff-ffff-ffff-ffff-ffffffffffff']){
    const f=basic();f.graph.nodes[0]!.id=id;f.graph.finalOutput.nodeId=id;assert.equal(planGraph(validateGraph(f.graph,f.definitions)).nodes[0]!.nodePath[0],id);
    const e=diamond();e.graph.edges[0]!.id=id;assert.ok(validateGraph(e.graph,e.definitions).graph.edges.some(edge=>edge.id===id));
  }
  const upper='AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', lower=upper.toLowerCase();
  const f=clone({graph:{version:1,nodes:[node(lower,h2),node(upper)],edges:[{...edge(1,upper,'value',lower,'in'),id:upper}],finalOutput:{nodeId:lower,portId:'image'}},definitions:{[h]:{kind:'code',metadata:metadata({},{value:signal})},[h2]:{kind:'code',metadata:metadata({in:signal})}}});
  const p=planGraph(validateGraph(f.graph,f.definitions));assert.deepEqual(p.nodes.map(n=>n.nodePath),[[upper],[lower]]);assert.equal(p.nodes[1]!.inputs[0]!.source.nodePath[0],upper);
  const large=fanout512();assert.equal(planGraph(validateGraph(large.graph,large.definitions)).nodes.length,17);
});
test('Kahn selection uses the smallest exact available ID after each predecessor completes',()=>{
  // B becomes ready only after A. It must then precede already-ready C.
  const f=diamond();f.graph.edges=f.graph.edges.filter(e=>e.to.nodeId!==C);f.graph.nodes.find(n=>n.id===C)!.definitionHash=hash(1);
  const p=planGraph(validateGraph(f.graph,f.definitions));assert.deepEqual(p.nodes.map(n=>n.nodePath),[[A],[B],[C],[D]]);
});
