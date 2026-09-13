import { normalizeComponentDeclaration } from '../../packages/runtime-contracts/src/components.mjs';
import type { InitialPortType, ComponentMetadata } from '../../packages/runtime-contracts/src/components.mjs';

export const A = '00000000-0000-4000-8000-000000000001';
export const B = '00000000-0000-4000-8000-000000000002';
export const C = '00000000-0000-4000-8000-000000000003';
export const D = '00000000-0000-4000-8000-000000000004';
export const U = '00000000-0000-4000-8000-000000000005';
export const h = 'a'.repeat(64), h2 = 'b'.repeat(64), h3 = 'c'.repeat(64);
export const image: InitialPortType = { kind:'image', colorSpace:'linear-srgb', alphaMode:'premultiplied' };
export const signal: InitialPortType = { kind:'signal', value:'number', unit:null, clock:'frame' };
export function clone<T>(value:T): T { return JSON.parse(JSON.stringify(value)); }
export function uuid(n:number): string { return `00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`; }
export function hash(n:number): string { return n.toString(16).padStart(64,'0'); }
export function metadata(inputs:Record<string,InitialPortType> = {}, outputs:Record<string,InitialPortType> = {image}, key='test/source'): ComponentMetadata {
  const ports = (types:Record<string,InitialPortType>) => Object.fromEntries(Object.entries(types).map(([id,type]) => [id,{type:clone(type),label:id,description:`Port ${id}`} ]));
  return normalizeComponentDeclaration({declarationVersion:1,key,label:'Fixture',description:'Graph metadata fixture',tags:[],inputs:ports(inputs),outputs:ports(outputs),controls:{},controlDescriptions:{},lifecycle:{state:'stateful',reset:'seed'}});
}
export const node = (id:string, definitionHash=h) => ({id,definitionHash});
export const edge = (id:number, from:string, output:string, to:string, input:string) => ({id:uuid(1000+id),from:{nodeId:from,portId:output},to:{nodeId:to,portId:input},delay:'none'});
export function basic() {
  return clone({graph:{version:1,nodes:[node(A)],edges:[] as ReturnType<typeof edge>[],finalOutput:{nodeId:A,portId:'image'}},definitions:{[h]:{kind:'code',metadata:metadata()}}});
}
export function diamond() {
  return clone({graph:{version:1,nodes:[node(U),node(D,h3),node(C,h2),node(B,h2),node(A,hash(1))],edges:[edge(4,C,'value',D,'right'),edge(3,B,'value',D,'left'),edge(2,A,'value',C,'in'),edge(1,A,'value',B,'in')],finalOutput:{nodeId:D,portId:'image'}},definitions:{[h]:{kind:'code',metadata:metadata()},[hash(1)]:{kind:'code',metadata:metadata({},{value:signal})},[h2]:{kind:'code',metadata:metadata({in:signal},{value:signal})},[h3]:{kind:'code',metadata:metadata({left:signal,right:signal})}}});
}
export function fanout512() {
  const inputs=Object.fromEntries(Array.from({length:16},(_,i)=>[`in${i}`,signal]));
  const graph={version:1,nodes:Array.from({length:64},(_,i)=>node(uuid(i+1),i<32?h:h2)),edges:[] as ReturnType<typeof edge>[],finalOutput:{nodeId:uuid(33),portId:'image'}};
  for(let consumer=0;consumer<32;consumer++)for(let port=0;port<16;port++)graph.edges.push(edge(consumer*16+port,uuid((consumer+port)%32+1),'value',uuid(consumer+33),`in${port}`));
  return clone({graph,definitions:{[h]:{kind:'code',metadata:metadata({},{value:signal})},[h2]:{kind:'code',metadata:metadata(inputs)}}});
}

/** Known-safe fixture builder: legal C01 text slots, exact UTF-8 JSON target. */
export function sizedMetadata(targetBytes:number): ComponentMetadata {
  const ports=Object.fromEntries(Array.from({length:16},(_,i)=>[`port${i}`,{type:clone(signal),label:`Port ${i}`,description:'x'}]));
  const controls=Object.fromEntries(Array.from({length:32},(_,i)=>[`control${i}`,{type:'number',label:`Control ${i}`,min:0,max:1,default:0}]));
  const descriptions=Object.fromEntries(Object.keys(controls).map(id=>[id,'x']));
  const result=clone(normalizeComponentDeclaration({declarationVersion:1,key:'test/padded',label:'Padded',description:'x',tags:[],inputs:clone(ports),outputs:clone(ports),controls,controlDescriptions:descriptions,lifecycle:{state:'stateful',reset:'seed'}}));
  const slots:[any,string][]=[[result,'description'],...Object.values(result.inputs).map(port=>[port,'description'] as [any,string]),...Object.values(result.outputs).map(port=>[port,'description'] as [any,string]),...Object.keys(result.controlDescriptions).map(id=>[result.controlDescriptions,id] as [any,string])];
  let remaining=targetBytes-new TextEncoder().encode(JSON.stringify(result)).byteLength;
  if(remaining<0)throw Error('Fixture target below baseline');
  for(const [record,key] of slots){
    const extra=Math.min(remaining,2047), total=extra+1;
    // A remainder of 3 at the maximum would make 513 code points: use a
    // three-byte character instead, keeping every description at <=512.
    const fours=Math.floor(total/4), tail=total%4;
    record[key]='😀'.repeat(fours)+(tail===3?'界':tail===2?'é':tail===1?'x':'');
    remaining-=extra;
  }
  if(remaining!==0)throw Error('Fixture target exceeds legal description capacity');
  return result;
}
