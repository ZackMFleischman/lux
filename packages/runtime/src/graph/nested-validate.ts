import { nodeIdSchema, edgeIdSchema } from '../../../runtime-contracts/src/identities.ts';
import { hashSchema } from '../../../runtime-contracts/src/index.ts';
import { normalizeComponentMetadata } from '../../../runtime-contracts/src/components.mjs';
import type { ComponentMetadata, InitialPortType } from '../../../runtime-contracts/src/components.mjs';
import { defaultControlValues, validateControlPatch } from '../../../runtime-contracts/src/parameters.mjs';
import type { ControlValues, ControlSchema } from '../../../runtime-contracts/src/parameters.mjs';
import type { PortRef, GraphEdge, NodePath } from '../../../runtime-contracts/src/graph.ts';
import { nestedGraphLimits as limits } from '../../../runtime-contracts/src/nested-graph.ts';
import type { NestedNode, NestedDefinition, NestedDefinitions, GraphBody, LocalControlRef, ValidatedNestedGraph, ExpandedControlRef } from '../../../runtime-contracts/src/nested-graph.ts';

const authenticated=new WeakSet<object>();
const encoder=new TextEncoder(), stringify=JSON.stringify;
export const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function comparePaths(a:NodePath,b:NodePath):number {
  for(let i=0;i<Math.min(a.length,b.length);i++){const c=compare(a[i]!,b[i]!);if(c)return c;}return a.length-b.length;
}
export const pathKey=(path:NodePath)=>stringify(path);
export function invalid(path:string,rule:string):never {
  const bounded=(s:string,n:number)=>s.length>n?`${s.slice(0,n-3)}...`:s;
  const location=bounded(path,384);
  throw Object.assign(new Error(`${location}: ${bounded(rule,380)}`),{code:'INVALID_NESTED_GRAPH',path:location});
}
export function freeze<T>(value:T):T {
  if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;
}
export function checked<T>(fn:()=>T,path:string):T {
  try{return fn();}catch(error){invalid(path,error instanceof Error&&'code' in error?error.message.slice(0,300):'invalid identity or metadata');}
}
export function record(value:unknown,path:string,fields?:readonly string[]):Record<string,unknown> {
  if(value===null||typeof value!=='object'||Array.isArray(value))invalid(path,'expected record');
  const row=value as Record<string,unknown>;
  if(fields){for(const k of Object.keys(row))if(!fields.includes(k))invalid(path,'unsupported field');for(const k of fields)if(!Object.hasOwn(row,k))invalid(path,`missing field ${k}`);}return row;
}
export function bytes(value:unknown):number{return encoder.encode(stringify(value)).byteLength;}
/** Publication guard shared by the admitted DTO and detached execution plan. */
export function publish<T>(value:T,path:string):T {
  if(bytes(value)>limits.outputBytes)invalid(path,'output byte budget exceeded');return freeze(value);
}
type Inspected={array:boolean;entries:[string,unknown][]};

/** Descriptor-only complete preflight. No caller property reads or serialization. */
export function snapshot(values:readonly unknown[], names:readonly string[], byteLimit:number=limits.rawBytes,wrapped=true):unknown[] {
  const seen=new WeakSet<object>(), inspected=new WeakMap<object,Inspected>();let count=0,total=wrapped?values.length+1:0;
  const add=(n:number,p:string)=>{total+=n;if(total>byteLimit)invalid(p,'raw JSON byte budget exceeded');};
  function stringBytes(s:string,p:string){if(s.length>byteLimit)invalid(p,'raw string byte bound exceeded');if(/[\uD800-\uDFFF]/u.test(s))invalid(p,'expected well-formed Unicode');return encoder.encode(stringify(s)).byteLength;}
  function length(v:unknown,p:string,max:number):number{
    if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype)invalid(p,'expected plain dense array');
    const d=Object.getOwnPropertyDescriptor(v,'length');if(!d||!Object.hasOwn(d,'value')||!Number.isSafeInteger(d.value)||d.value<0)invalid(p,'expected own array length');if(d.value>max)invalid(p,`at most ${max} raw array values`);return d.value;
  }
  // Check every raw body count ahead of its descendants, even an unused body.
  function bodyCounts(v:unknown,p:string){
    if(v===null||typeof v!=='object')return;
    for(const [key,max] of [['nodes',limits.nodesPerBody],['edges',limits.edgesPerBody]] as const){const d=Object.getOwnPropertyDescriptor(v,key);if(d&&Object.hasOwn(d,'value'))length(d.value,`${p}.${key}`,max);}
    let targets=0;
    for(const key of ['inputBindings','controlBindings','outputBindings']){
      const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value')||d.value===null||typeof d.value!=='object')continue;
      const keys=Reflect.ownKeys(d.value);if(keys.length>limits.bindingTargetsPerBody)invalid(p,'raw binding target budget exceeded');
      for(const k of keys){const t=Object.getOwnPropertyDescriptor(d.value,k);if(!t||!Object.hasOwn(t,'value'))continue;targets+=key==='outputBindings'?1:length(t.value,`${p}.${key}`,limits.bindingTargetsPerBody);if(targets>limits.bindingTargetsPerBody)invalid(p,'raw binding target budget exceeded');}
    }
  }
  function inspect(v:unknown,p:string,depth:number):void{
    if(depth>limits.rawDepth)invalid(p,'raw depth exceeds 16');if(++count>limits.rawValues)invalid(p,'raw value budget exceeded');
    if(v===null){add(4,p);return;}if(typeof v==='string'){add(stringBytes(v,p),p);return;}if(typeof v==='boolean'){add(v?4:5,p);return;}if(typeof v==='number'){if(!Number.isFinite(v))invalid(p,'expected finite number');add(stringify(v).length,p);return;}if(typeof v!=='object')invalid(p,'expected JSON data');
    if(seen.has(v))invalid(p,'cycles and repeated aliases unsupported');seen.add(v);
    const array=Array.isArray(v), proto=Object.getPrototypeOf(v);if(array?proto!==Array.prototype:proto!==null&&proto!==Object.prototype)invalid(p,'expected plain data container');
    const n=array?length(v,p,p==='overrides'?limits.overrides:limits.rawValues):0,keys=Reflect.ownKeys(v);
    if(keys.length>(array?n+1:p==='definitions'?limits.definitions:limits.rawValues))invalid(p,'raw property count exceeded');if(array&&keys.length!==n+1)invalid(p,'expected dense array');
    const entries:[string,unknown][]=[];add(2,p);
    for(const k of array?Array.from({length:n},(_,i)=>String(i)):keys){
      if(typeof k!=='string')invalid(p,'expected string data key');const d=Object.getOwnPropertyDescriptor(v,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))invalid(p,'expected enumerable own data property');
      if(entries.length)add(1,p);if(!array)add(stringBytes(k,p)+1,p);entries.push([k,d.value]);inspect(d.value,`${p}.${k.length<=96?k:'[field]'}`,depth+1);
    }
    inspected.set(v,{array,entries});
  }
  for(let i=0;i<values.length;i++)if(names[i]==='definitions'){
    const catalog=values[i];if(catalog===null||typeof catalog!=='object')continue;
    const keys=Reflect.ownKeys(catalog);if(keys.length>limits.definitions)invalid('definitions','at most128 raw definitions');
    for(const key of keys){
      const d=Object.getOwnPropertyDescriptor(catalog,key);if(!d||!Object.hasOwn(d,'value')||d.value===null||typeof d.value!=='object')continue;
      const body=Object.getOwnPropertyDescriptor(d.value,'body');if(body&&Object.hasOwn(body,'value'))bodyCounts(body.value,'definitions.[body]');
    }
  }
  values.forEach((v,i)=>inspect(v,names[i]!,0));
  function copy(v:unknown):unknown{if(v===null||typeof v!=='object')return v;const r=inspected.get(v)!;return r.array?r.entries.map(([,x])=>copy(x)):Object.fromEntries(r.entries.map(([k,x])=>[k,copy(x)]));}
  return values.map(copy);
}
function matches(a:InitialPortType,b:InitialPortType):boolean{return a.kind==='signal'?b.kind==='signal'&&a.unit===b.unit&&a.clock===b.clock&&a.value===b.value:b.kind==='image'&&a.colorSpace===b.colorSpace&&a.alphaMode===b.alphaMode;}
function ref(v:unknown,p:string):PortRef{const r=record(v,p,['nodeId','portId']);if(typeof r.portId!=='string')invalid(p,'expected port ID');return {nodeId:checked(()=>nodeIdSchema.parse(r.nodeId),p),portId:r.portId};}
export function patch(schema:ControlSchema,v:unknown,p:string,empty=true):ControlValues {
  const r=record(v,p);if(Object.keys(r).length===0){if(!empty)invalid(p,'expected nonempty control patch');return {};}
  return checked(()=>validateControlPatch(schema,r),p);
}
function sameKeys(actual:object,expected:readonly string[],p:string){const keys=Object.keys(actual).sort(compare);if(keys.length!==expected.length||keys.some((k,i)=>k!==expected.slice().sort(compare)[i]))invalid(p,'binding keys must exactly equal metadata interface');}
function localBody(raw:unknown,metadata:ComponentMetadata,defs:NestedDefinitions,p:string):GraphBody {
  const r=record(raw,p,['nodes','edges','inputBindings','outputBindings','controlBindings']);
  if(!Array.isArray(r.nodes)||!r.nodes.length||!Array.isArray(r.edges))invalid(p,'expected nonempty nodes and edges array');
  const nodes:NestedNode[]=r.nodes.map((v,i)=>{const n=record(v,`${p}.nodes.${i}`,['id','definitionHash','controlDefaults']);const id=checked(()=>nodeIdSchema.parse(n.id),p),hash=checked(()=>hashSchema.parse(n.definitionHash),p);const d=defs[hash];if(!d)invalid(p,'missing definition hash');return {id,definitionHash:hash,controlDefaults:patch(d.metadata.controls,n.controlDefaults,p)};}).sort((a,b)=>compare(a.id,b.id));
  const byId=new Map(nodes.map(n=>[n.id,n]));if(byId.size!==nodes.length)invalid(p,'duplicate node ID');
  const lookup=(target:PortRef,direction:'inputs'|'outputs')=>{const n=byId.get(target.nodeId);if(!n)invalid(p,'missing immediate node');const ports=defs[n.definitionHash]!.metadata[direction];if(!Object.hasOwn(ports,target.portId))invalid(p,`missing ${direction} port`);return ports[target.portId]!.type;};
  const edges:GraphEdge[]=r.edges.map(v=>{const e=record(v,p,['id','from','to','delay']);if(e.delay!=='none')invalid(p,'only delay none supported');return {id:checked(()=>edgeIdSchema.parse(e.id),p),from:ref(e.from,p),to:ref(e.to,p),delay:'none' as const};}).sort((a,b)=>compare(a.id,b.id));
  if(new Set(edges.map(e=>e.id)).size!==edges.length)invalid(p,'duplicate edge ID');
  const writers=new Set<string>(),links:[string,string][]=[];
  const write=(to:PortRef)=>{const key=stringify([to.nodeId,to.portId]);if(writers.has(key))invalid(p,'input has duplicate writer');writers.add(key);};
  for(const e of edges){if(!matches(lookup(e.from,'outputs'),lookup(e.to,'inputs')))invalid(p,'port type mismatch');write(e.to);links.push([e.from.nodeId,e.to.nodeId]);}
  const inputRaw=record(r.inputBindings,p),outputRaw=record(r.outputBindings,p),controlRaw=record(r.controlBindings,p);
  sameKeys(inputRaw,Object.keys(metadata.inputs),p);sameKeys(outputRaw,Object.keys(metadata.outputs),p);sameKeys(controlRaw,metadata.controls.map(c=>c.id),p);
  if(!Object.keys(metadata.outputs).length)invalid(p,'graph must expose an output');
  const sortRefs=(a:PortRef,b:PortRef)=>compare(a.nodeId,b.nodeId)||compare(a.portId,b.portId);
  const inputBindings=Object.fromEntries(Object.keys(inputRaw).sort(compare).map(id=>{const targets=inputRaw[id];if(!Array.isArray(targets)||!targets.length)invalid(p,'input binding needs targets');const refs=targets.map(v=>ref(v,p)).sort(sortRefs);for(const t of refs){if(!matches(metadata.inputs[id]!.type,lookup(t,'inputs')))invalid(p,'input binding type mismatch');write(t);}return [id,refs];}));
  const outputBindings=Object.fromEntries(Object.keys(outputRaw).sort(compare).map(id=>{const t=ref(outputRaw[id],p);if(!matches(metadata.outputs[id]!.type,lookup(t,'outputs')))invalid(p,'output binding type mismatch');return [id,t];}));
  const controlWriters=new Set<string>();
  const controlBindings=Object.fromEntries(Object.keys(controlRaw).sort(compare).map(id=>{
    const targets=controlRaw[id],publicControl=metadata.controls.find(c=>c.id===id)!;if(!Array.isArray(targets)||!targets.length)invalid(p,'control binding needs targets');
    const refs:LocalControlRef[]=targets.map(v=>{const t=record(v,p,['nodeId','controlId']);if(typeof t.controlId!=='string')invalid(p,'expected control ID');return {nodeId:checked(()=>nodeIdSchema.parse(t.nodeId),p),controlId:t.controlId};}).sort((a,b)=>compare(a.nodeId,b.nodeId)||compare(a.controlId,b.controlId));
    for(const t of refs){const n=byId.get(t.nodeId),target=n&&defs[n.definitionHash]!.metadata.controls.find(c=>c.id===t.controlId);if(!target)invalid(p,'missing immediate control target');
      for(const k of ['type','changeCost','unit','min','max','step'] as const)if(Object.hasOwn(publicControl,k)!==Object.hasOwn(target,k)||publicControl[k]!==target[k])invalid(p,'control binding schema mismatch');
      const key=stringify([t.nodeId,t.controlId]);if(controlWriters.has(key))invalid(p,'duplicate control binding writer');controlWriters.add(key);
    }return [id,refs];
  }));
  for(const n of nodes)for(const id of Object.keys(defs[n.definitionHash]!.metadata.inputs))if(!writers.has(stringify([n.id,id])))invalid(p,`missing required input writer ${id}`);
  topological(nodes.map(n=>n.id),links,p);
  const body={nodes,edges,inputBindings,outputBindings,controlBindings};if(bytes(body)>limits.bodyBytes)invalid(p,'canonical body byte budget exceeded');return body;
}
export function topological(keys:readonly string[],links:readonly (readonly [string,string])[],p:string):string[]{
  const outgoing=new Map(keys.map(k=>[k,new Set<string>()])),degrees=new Map(keys.map(k=>[k,0]));
  for(const [from,to] of links){const destinations=outgoing.get(from)!;if(!destinations.has(to)){destinations.add(to);degrees.set(to,degrees.get(to)!+1);}}
  const ready=keys.filter(k=>degrees.get(k)===0),result:string[]=[];
  while(ready.length){ready.sort(compare);const k=ready.shift()!;result.push(k);for(const t of outgoing.get(k)!){const d=degrees.get(t)!-1;degrees.set(t,d);if(!d)ready.push(t);}}
  if(result.length!==keys.length)invalid(p,'same-step cycle');return result;
}
type Summary={levels:number;placements:number;leaves:number;edges:number;targets:number;controls:Record<string,number>;stateful:boolean};
function cardinalities(defs:NestedDefinitions):void{
  const done=new Map<string,Summary>(),active=new Set<string>();
  const add=(a:number,b:number,max:number)=>Math.min(max+1,a+b);
  function visit(hash:string):Summary{
    const cached=done.get(hash);if(cached)return cached;if(active.has(hash))invalid(hash,'recursive graph definition');active.add(hash);
    const d=defs[hash]!;let s:Summary;
    if(d.kind==='code')s={levels:0,placements:0,leaves:1,edges:Object.keys(d.metadata.inputs).length,targets:0,controls:Object.fromEntries(d.metadata.controls.map(c=>[c.id,1])),stateful:d.metadata.lifecycle.state==='stateful'};
    else{
      s={levels:1,placements:0,leaves:0,edges:0,targets:0,controls:{},stateful:false};const children=new Map(d.body.nodes.map(n=>[n.id,visit(n.definitionHash)]));
      for(const c of children.values()){s.levels=Math.max(s.levels,c.levels+1);s.placements=add(s.placements,c.placements+1,limits.expandedPlacements);s.leaves=add(s.leaves,c.leaves,limits.expandedLeaves);s.edges=add(s.edges,c.edges,limits.expandedEdges);s.targets=add(s.targets,c.targets,limits.expandedControlTargets);s.stateful ||= c.stateful;}
      for(const [id,refs] of Object.entries(d.body.controlBindings)){let count=0;for(const r of refs)count=add(count,children.get(r.nodeId)!.controls[r.controlId]!,limits.expandedControlTargets);s.controls[id]=count;s.targets=add(s.targets,count,limits.expandedControlTargets);}
      if(s.levels>limits.graphLevels)invalid(hash,'graph level budget exceeded');if(s.placements>limits.expandedPlacements)invalid(hash,'expanded placement budget exceeded');if(s.leaves>limits.expandedLeaves)invalid(hash,'expanded leaf budget exceeded');if(s.edges>limits.expandedEdges)invalid(hash,'expanded edge budget exceeded');if(s.targets>limits.expandedControlTargets)invalid(hash,'expanded control target budget exceeded');
      if(d.metadata.lifecycle.state!==(s.stateful?'stateful':'stateless'))invalid(hash,'graph lifecycle must match all descendant code');
    }
    active.delete(hash);done.set(hash,s);return s;
  }
  for(const hash of Object.keys(defs))visit(hash);
}

export function workCounter():()=>void{let count=0;return ()=>{if(++count>limits.resolutionSteps)invalid('expansion','resolution work budget exceeded');};}
export type Address={nodePath:NodePath;portId:string};
export type Occurrence={path:NodePath;hash:string;children:Map<string,Occurrence>;controls:Record<string,ExpandedControlRef[]>};
export type ExpandedLeaf={path:NodePath;hash:string;values:Record<string,number>};
export type Expansion={root:Occurrence;occurrences:Map<string,Occurrence>;leaves:Map<string,ExpandedLeaf>;edges:{from:Address;to:Address}[]};
/** All callers supply admitted data whose complete catalog cardinalities passed. */
export function expand(defs:NestedDefinitions,rootHash:string,charge:()=>void):Expansion{
  const occurrences=new Map<string,Occurrence>(),leaves=new Map<string,ExpandedLeaf>(),edges:{from:Address;to:Address}[]=[],writers=new Set<string>();
  const targetKey=(a:Address)=>stringify([a.nodePath,a.portId]);
  function input(o:Occurrence,id:string):Address[]{
    charge();const d=defs[o.hash]!;if(d.kind==='code')return [{nodePath:o.path,portId:id}];
    const result:Address[]=[];for(const r of d.body.inputBindings[id]!){charge();result.push(...input(o.children.get(r.nodeId)!,r.portId));}return result;
  }
  function output(o:Occurrence,id:string):Address{
    charge();const d=defs[o.hash]!;if(d.kind==='code')return {nodePath:o.path,portId:id};const r=d.body.outputBindings[id]!;charge();return output(o.children.get(r.nodeId)!,r.portId);
  }
  function apply(o:Occurrence,values:ControlValues){for(const [id,value] of Object.entries(values))for(const t of o.controls[id]!){charge();leaves.get(pathKey(t.nodePath))!.values[t.controlId]=value;}}
  function place(hash:string,path:NodePath):Occurrence{
    charge();const d=defs[hash]!,o:Occurrence={path,hash,children:new Map(),controls:{}};occurrences.set(pathKey(path),o);
    if(d.kind==='code'){
      leaves.set(pathKey(path),{path,hash,values:{...defaultControlValues(d.metadata.controls)}});
      for(const c of d.metadata.controls)o.controls[c.id]=[{nodePath:path,controlId:c.id}];
    }else{
      for(const n of d.body.nodes){const child=place(n.definitionHash,[...path,n.id]);o.children.set(n.id,child);apply(child,n.controlDefaults);}
      const bound=new Set<string>();
      for(const [id,refs] of Object.entries(d.body.controlBindings)){
        const targets:ExpandedControlRef[]=[];for(const r of refs){charge();for(const target of o.children.get(r.nodeId)!.controls[r.controlId]!){charge();const key=stringify([target.nodePath,target.controlId]);if(bound.has(key))invalid(pathKey(path),'expanded control writers overlap');bound.add(key);targets.push(target);}}
        o.controls[id]=targets.sort((a,b)=>comparePaths(a.nodePath,b.nodePath)||compare(a.controlId,b.controlId));
      }
      apply(o,defaultControlValues(d.metadata.controls));
      for(const e of d.body.edges){const from=output(o.children.get(e.from.nodeId)!,e.from.portId);for(const to of input(o.children.get(e.to.nodeId)!,e.to.portId)){charge();const key=targetKey(to);if(writers.has(key))invalid(pathKey(path),'expanded input duplicate writer');writers.add(key);edges.push({from,to});}}
    }return o;
  }
  const root=place(rootHash,[]),d=defs[rootHash]!;
  // An abstract standalone graph input is a writer, not a fabricated resource.
  for(const id of Object.keys(d.metadata.inputs))for(const target of input(root,id)){charge();const key=targetKey(target);if(writers.has(key))invalid('expansion','expanded boundary duplicate writer');writers.add(key);}
  for(const leaf of leaves.values())for(const id of Object.keys(defs[leaf.hash]!.metadata.inputs))if(!writers.has(targetKey({nodePath:leaf.path,portId:id})))invalid('expansion','missing expanded input writer');
  for(const e of edges){const a=leaves.get(pathKey(e.from.nodePath))!,b=leaves.get(pathKey(e.to.nodePath))!;if(!matches(defs[a.hash]!.metadata.outputs[e.from.portId]!.type,defs[b.hash]!.metadata.inputs[e.to.portId]!.type))invalid('expansion','expanded port type mismatch');}
  topological([...leaves.keys()],edges.map(e=>[pathKey(e.from.nodePath),pathKey(e.to.nodePath)]),'expansion');
  return {root,occurrences,leaves,edges};
}
export function resolveOutput(defs:NestedDefinitions,o:Occurrence,id:string,charge:()=>void):Address{
  charge();const d=defs[o.hash]!;if(d.kind==='code')return {nodePath:o.path,portId:id};const r=d.body.outputBindings[id]!;charge();return resolveOutput(defs,o.children.get(r.nodeId)!,r.portId,charge);
}
export function validateNestedGraph(graph:unknown,definitions:unknown):ValidatedNestedGraph{
  const [g,ds]=snapshot([graph,definitions],['graph','definitions']);const r=record(g,'graph',['version','rootDefinitionHash','outputPort']);if(r.version!==2)invalid('graph','expected version 2');const hash=checked(()=>hashSchema.parse(r.rootDefinitionHash),'graph');if(typeof r.outputPort!=='string')invalid('graph','expected output port');
  const rows=record(ds,'definitions'),defs:Record<string,NestedDefinition>={},rawBodies=new Map<string,unknown>();let metadataBytes=0,bodyBytes=0;
  for(const key of Object.keys(rows).sort(compare)){
    checked(()=>hashSchema.parse(key),'definitions');const row=record(rows[key],key);if(row.kind!=='code'&&row.kind!=='graph')invalid(key,'expected code or graph kind');record(row,key,row.kind==='code'?['kind','metadata']:['kind','metadata','body']);
    const metadata=checked(()=>normalizeComponentMetadata(row.metadata),key);metadataBytes+=bytes(metadata);if(metadataBytes>limits.metadataBytes)invalid(key,'aggregate metadata byte budget exceeded');
    // All metadata must be present before local cross-definition validation.
    defs[key]=row.kind==='code'?{kind:'code',metadata}:{kind:'graph',metadata,body:undefined as unknown as GraphBody};if(row.kind==='graph')rawBodies.set(key,row.body);
  }
  for(const [key,raw] of rawBodies){const metadata=defs[key]!.metadata,body=localBody(raw,metadata,defs,key);bodyBytes+=bytes(body);if(bodyBytes>limits.allBodyBytes)invalid(key,'aggregate body byte budget exceeded');defs[key]={kind:'graph',metadata,body};}
  const root=defs[hash];if(!root||root.kind!=='graph')invalid('graph','root must name a graph definition');if(Object.keys(root.metadata.inputs).length)invalid('graph','root public inputs must be empty');if(!Object.hasOwn(root.metadata.outputs,r.outputPort)||root.metadata.outputs[r.outputPort]!.type.kind!=='image')invalid('graph','root selected output must be image');
  cardinalities(defs);const charge=workCounter();for(const [key,d] of Object.entries(defs))if(d.kind==='graph')expand(defs,key,charge);
  const result:ValidatedNestedGraph=publish({graph:{version:2 as const,rootDefinitionHash:hash,outputPort:r.outputPort},definitions:defs},'graph');authenticated.add(result);return result;
}
export function isValidatedNestedGraph(v:unknown):v is ValidatedNestedGraph{return v!==null&&typeof v==='object'&&authenticated.has(v);}
