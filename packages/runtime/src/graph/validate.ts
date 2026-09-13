import { nodeIdSchema, edgeIdSchema } from '../../../runtime-contracts/src/identities.ts';
import { hashSchema } from '../../../runtime-contracts/src/index.ts';
import { normalizeComponentMetadata, canonicalComponentMetadataJson } from '../../../runtime-contracts/src/components.mjs';
import type { InitialPortType } from '../../../runtime-contracts/src/components.mjs';
import { graphLimits } from '../../../runtime-contracts/src/graph.ts';
import type { FlatGraph, GraphNode, GraphEdge, PortRef, ResolvedDefinitions, ResolvedDefinition, ValidatedGraph } from '../../../runtime-contracts/src/graph.ts';

const authenticated = new WeakSet<object>();
const stringify = JSON.stringify;
const encoder = new TextEncoder();
const compare = (a:string,b:string) => a<b?-1:a>b?1:0;
function invalid(path:string, rule:string): never {
  throw Object.assign(new Error(`${path}: ${rule}`.slice(0,768)), {code:'INVALID_GRAPH',path});
}
type Inspected = { array:boolean; entries:readonly (readonly [string,unknown])[] };

// Descriptor records retain references only until the synchronous copy pass.
// No caller container is serialized or read through ordinary property access.
function snapshot(graph:unknown, definitions:unknown): [unknown,unknown] {
  const seen = new WeakSet<object>(), inspected = new WeakMap<object,Inspected>();
  let values=0, bytes=3; // two-element wrapper: [,]
  function add(amount:number,path:string) { bytes+=amount; if(bytes>graphLimits.rawBytes)invalid(path,'raw JSON byte budget exceeded'); }
  function stringBytes(value:string,path:string): number {
    if(value.length>graphLimits.rawBytes)invalid(path,'raw string byte bound exceeded');
    // In Unicode mode a valid surrogate pair is one non-surrogate code point.
    if(/[\uD800-\uDFFF]/u.test(value))invalid(path,'expected well-formed Unicode data');
    return encoder.encode(stringify(value)).byteLength;
  }
  function arrayLength(value:unknown,path:string,maximum:number): number {
    if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)invalid(path,'expected plain dense array');
    const descriptor=Object.getOwnPropertyDescriptor(value,'length');
    if(!descriptor||!Object.hasOwn(descriptor,'value')||!Number.isSafeInteger(descriptor.value)||descriptor.value<0)invalid(path,'expected own array length');
    if(descriptor.value>maximum)invalid(path,`at most ${maximum} raw array values`);
    return descriptor.value;
  }
  function inspect(value:unknown,path:string,depth:number): void {
    if(depth>graphLimits.rawDepth)invalid(path,'raw depth exceeds 16');
    if(++values>graphLimits.rawValues)invalid(path,'raw value budget exceeded');
    if(value===null){add(4,path);return;}
    if(typeof value==='string'){add(stringBytes(value,path),path);return;}
    if(typeof value==='boolean'){add(value?4:5,path);return;}
    if(typeof value==='number'){if(!Number.isFinite(value))invalid(path,'expected finite data number');add(stringify(value).length,path);return;}
    if(typeof value!=='object')invalid(path,'expected JSON data value');
    if(seen.has(value))invalid(path,'cycles and repeated data aliases are unsupported');
    seen.add(value);
    const array=Array.isArray(value), prototype=Object.getPrototypeOf(value);
    if(array?prototype!==Array.prototype:prototype!==null&&prototype!==Object.prototype)invalid(path,'expected plain data container');
    const length=array?arrayLength(value,path,path==='graph.nodes'?graphLimits.nodes:path==='graph.edges'?graphLimits.edges:graphLimits.rawValues):0;
    const keys=Reflect.ownKeys(value);
    const maximum=path==='definitions'?graphLimits.definitions:graphLimits.rawValues;
    if(keys.length>(array?length+1:maximum))invalid(path,array?'unexpected array properties':`at most ${maximum} raw properties`);
    if(array&&keys.length!==length+1)invalid(path,'expected dense array');
    const entries:[string,unknown][]=[];
    add(2,path);
    if(array){
      for(let i=0;i<length;i++){
        const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
        if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))invalid(path,'expected dense own data array');
        entries.push([String(i),descriptor.value]);
        if(i)add(1,path);
        inspect(descriptor.value,`${path}[${i}]`,depth+1);
      }
      // Exact key count plus all indexed descriptors proves there are no extras.
    }else{
      for(const key of keys){
        if(typeof key!=='string')invalid(path,'expected string data keys');
        const descriptor=Object.getOwnPropertyDescriptor(value,key);
        if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))invalid(path,'expected enumerable own data properties');
        if(entries.length)add(1,path);
        add(stringBytes(key,path)+1,path);
        entries.push([key,descriptor.value]);
        const childPath=`${path}.${key.length<=96?key:'[field]'}`;
        inspect(descriptor.value,childPath,depth+1);
      }
    }
    inspected.set(value,{array,entries});
  }
  // Read raw root counts ahead of member traversal, including unreachable data.
  if(graph!==null&&typeof graph==='object')for(const [field,max] of [['nodes',graphLimits.nodes],['edges',graphLimits.edges]] as const){
    const descriptor=Object.getOwnPropertyDescriptor(graph,field);
    if(descriptor&&Object.hasOwn(descriptor,'value'))arrayLength(descriptor.value,`graph.${field}`,max);
  }
  if(definitions!==null&&typeof definitions==='object'&&Reflect.ownKeys(definitions).length>graphLimits.definitions)invalid('definitions','at most 128 raw properties');
  inspect(graph,'graph',0);inspect(definitions,'definitions',0);
  function copy(value:unknown): unknown {
    if(value===null||typeof value!=='object')return value;
    const record=inspected.get(value)!;
    return record.array?record.entries.map(([,child])=>copy(child)):Object.fromEntries(record.entries.map(([key,child])=>[key,copy(child)]));
  }
  return [copy(graph),copy(definitions)];
}

function record(value:unknown,path:string,fields?:readonly string[]): Record<string,unknown> {
  if(value===null||typeof value!=='object'||Array.isArray(value))invalid(path,'expected data record');
  const result=value as Record<string,unknown>;
  if(fields){
    for(const key of Object.keys(result))if(!fields.includes(key))invalid(path,'unsupported field');
    for(const key of fields)if(!Object.hasOwn(result,key))invalid(path,`missing field ${key}`);
  }
  return result;
}
function checked<T>(operation:()=>T,path:string): T {
  try{return operation();}catch(error){
    // Existing metadata policy reports a bounded rule; never serialize raw input
    // or Zod issue arrays containing caller data.
    const rule=error instanceof Error&&'code' in error?error.message.slice(0,300):'invalid UUID or definition hash syntax';
    invalid(path,rule);
  }
}
function portRef(value:unknown,path:string): PortRef {
  const raw=record(value,path,['nodeId','portId']);
  if(typeof raw.portId!=='string')invalid(path,'expected port name');
  return Object.freeze({nodeId:checked(()=>nodeIdSchema.parse(raw.nodeId),path),portId:raw.portId});
}
function matches(a:InitialPortType,b:InitialPortType): boolean {
  return a.kind==='signal'?b.kind==='signal'&&a.value===b.value&&a.clock===b.clock&&a.unit===b.unit:
    b.kind==='image'&&a.colorSpace===b.colorSpace&&a.alphaMode===b.alphaMode;
}

export function validateGraph(graph:unknown,definitions:unknown): ValidatedGraph {
  const [graphCopy,definitionCopy]=snapshot(graph,definitions);
  const raw=record(graphCopy,'graph',['version','nodes','edges','finalOutput']);
  if(raw.version!==1)invalid('graph','expected version 1');
  if(!Array.isArray(raw.nodes)||raw.nodes.length===0)invalid('graph.nodes','expected at least one node');
  if(!Array.isArray(raw.edges))invalid('graph.edges','expected array');
  const definitionRows=record(definitionCopy,'definitions');
  let metadataBytes=0;
  const normalizedDefinitions:Record<string,ResolvedDefinition>={};
  for(const hash of Object.keys(definitionRows).sort(compare)){
    const path=`definitions.${hash.length<=64?hash:'[hash]'}`;
    checked(()=>hashSchema.parse(hash),path);
    const row=record(definitionRows[hash],path,['kind','metadata']);
    if(row.kind!=='code')invalid(path,'expected code definition kind');
    const metadata=checked(()=>normalizeComponentMetadata(row.metadata),path);
    metadataBytes+=encoder.encode(canonicalComponentMetadataJson(metadata)).byteLength;
    if(metadataBytes>graphLimits.definitionMetadataBytes)invalid(path,'normalized metadata aggregate exceeds 1 MiB');
    normalizedDefinitions[hash]=Object.freeze({kind:'code',metadata});
  }
  const resolved:ResolvedDefinitions=Object.freeze(normalizedDefinitions);
  const nodes:GraphNode[]=raw.nodes.map((value:unknown,i:number)=>{
    const path=`graph.nodes[${i}]`, row=record(value,path,['id','definitionHash']);
    return Object.freeze({id:checked(()=>nodeIdSchema.parse(row.id),path),definitionHash:checked(()=>hashSchema.parse(row.definitionHash),path)});
  }).sort((a,b)=>compare(a.id,b.id));
  const byId=new Map<string,GraphNode>();
  for(const n of nodes){
    if(byId.has(n.id))invalid(`node:${n.id}`,'duplicate node ID');
    if(!Object.hasOwn(resolved,n.definitionHash))invalid(`node:${n.id}`,'missing resolved definition hash');
    byId.set(n.id,n);
  }
  const edges:GraphEdge[]=raw.edges.map((value:unknown,i:number)=>{
    const path=`graph.edges[${i}]`, row=record(value,path,['id','from','to','delay']);
    if(row.delay!=='none')invalid(path,'only delay none is supported');
    return Object.freeze({id:checked(()=>edgeIdSchema.parse(row.id),path),from:portRef(row.from,path),to:portRef(row.to,path),delay:'none' as const});
  }).sort((a,b)=>compare(a.id,b.id));
  const edgeIds=new Set<string>(), writers=new Map<string,Set<string>>();
  const outgoing=new Map<string,Set<string>>(nodes.map(n=>[n.id,new Set<string>()]));
  const indegrees=new Map<string,number>(nodes.map(n=>[n.id,0]));
  for(const e of edges){
    const path=`edge:${e.id}`;
    if(edgeIds.has(e.id))invalid(path,'duplicate edge ID');edgeIds.add(e.id);
    const from=byId.get(e.from.nodeId), to=byId.get(e.to.nodeId);
    if(!from||!to)invalid(path,'missing endpoint node');
    const outputs=resolved[from.definitionHash]!.metadata.outputs, inputs=resolved[to.definitionHash]!.metadata.inputs;
    if(!Object.hasOwn(outputs,e.from.portId))invalid(path,'missing source output port');
    if(!Object.hasOwn(inputs,e.to.portId))invalid(path,'missing destination input port');
    if(!matches(outputs[e.from.portId]!.type,inputs[e.to.portId]!.type))invalid(path,'port type mismatch');
    const written=writers.get(to.id)??new Set<string>();
    if(written.has(e.to.portId))invalid(path,'destination input has more than one writer');
    written.add(e.to.portId);writers.set(to.id,written);
    const destinations=outgoing.get(from.id)!;
    if(!destinations.has(to.id)){destinations.add(to.id);indegrees.set(to.id,indegrees.get(to.id)!+1);}
  }
  const finalOutput=portRef(raw.finalOutput,'graph.finalOutput'), finalNode=byId.get(finalOutput.nodeId);
  if(!finalNode)invalid('graph.finalOutput','missing output node');
  const outputs=resolved[finalNode.definitionHash]!.metadata.outputs;
  if(!Object.hasOwn(outputs,finalOutput.portId))invalid('graph.finalOutput','missing output port');
  if(outputs[finalOutput.portId]!.type.kind!=='image')invalid('graph.finalOutput','expected final image output');
  for(const n of nodes)for(const port of Object.keys(resolved[n.definitionHash]!.metadata.inputs)){
    if(!writers.get(n.id)?.has(port))invalid(`node:${n.id}`,`missing required input ${port}`);
  }
  const ready:string[]=nodes.filter(n=>indegrees.get(n.id)===0).map(n=>n.id);let visited=0;
  while(ready.length){ready.sort(compare);const id=ready.shift()!;visited++;
    for(const destination of outgoing.get(id)!){const remaining=indegrees.get(destination)!-1;indegrees.set(destination,remaining);if(remaining===0)ready.push(destination);}
  }
  if(visited!==nodes.length)invalid(`node:${nodes.find(n=>indegrees.get(n.id)!>0)!.id}`,'same-step cycle');
  const normalized:FlatGraph=Object.freeze({version:1,nodes:Object.freeze(nodes),edges:Object.freeze(edges),finalOutput});
  if(encoder.encode(stringify(normalized)).byteLength>graphLimits.graphBytes)invalid('graph','canonical graph exceeds 256 KiB');
  const result=Object.freeze({graph:normalized,definitions:resolved});authenticated.add(result);return result;
}

/** Local authenticity guard only; clones and deserialized values need admission. */
export function isValidatedGraph(value:unknown): value is ValidatedGraph {
  return value!==null&&typeof value==='object'&&authenticated.has(value);
}
