import { normalizeComponentDeclaration } from '../../packages/runtime-contracts/src/components.mjs';
import { clone, uuid, hash, image, signal, edge } from './graph-fixtures.ts';
export { clone, uuid, hash, image, signal, edge };
export const control = (value=1) => ({type:'number',label:'Gain',min:0,max:10,default:value,step:0.5});
export function meta(inputs:any={}, outputs:any={image}, controls:any={}) {
  const ports=(types:any)=>Object.fromEntries(Object.entries(types).map(([id,type])=>[id,{type,label:id,description:id}]));
  return normalizeComponentDeclaration(clone({declarationVersion:1,key:'test/nested',label:'Nested',description:'Fixture',tags:[],inputs:ports(inputs),outputs:ports(outputs),controls,controlDescriptions:Object.fromEntries(Object.keys(controls).map(id=>[id,id])),lifecycle:{state:'stateless',reset:'seed'}}));
}
export const node=(n:number,h:number,controlDefaults:any={})=>({id:uuid(n),definitionHash:hash(h),controlDefaults});
export const ref=(n:number,portId='image')=>({nodeId:uuid(n),portId});
export const cref=(n:number,controlId='gain')=>({nodeId:uuid(n),controlId});
export function graphDef(nodes:any[], edges:any[]=[], inputs:any={}, outputs:any={image:ref(1)}, controls:any={}, metadata=meta()) {
  return {kind:'graph',metadata,body:{nodes,edges,inputBindings:inputs,outputBindings:outputs,controlBindings:controls}};
}
export function basic():any {
  return clone({graph:{version:2,rootDefinitionHash:hash(1),outputPort:'image'},definitions:{[hash(1)]:graphDef([node(1,2)]),[hash(2)]:{kind:'code',metadata:meta()}}});
}
export function twins():any {
  return clone({graph:{version:2,rootDefinitionHash:hash(1),outputPort:'a'},definitions:{
    [hash(1)]:graphDef([node(1,2,{gain:4}),node(2,2,{gain:7})],[],{},{a:ref(1),b:ref(2)},{gain:[cref(1)]},meta({},{a:image,b:image},{gain:control(5)})),
    [hash(2)]:graphDef([node(3,3,{gain:2})],[],{},{image:ref(3)},{gain:[cref(3)]},meta({},{image},{gain:control(3)})),
    [hash(3)]:{kind:'code',metadata:meta({},{image},{gain:control(1)})}
  }});
}
export function chain(levels:number):any {
  const definitions:any={[hash(levels+1)]:{kind:'code',metadata:meta()}};
  for(let i=levels;i>=1;i--)definitions[hash(i)]=graphDef([node(1,i+1)]);
  return clone({graph:{version:2,rootDefinitionHash:hash(1),outputPort:'image'},definitions});
}
export function leaves(count:number):any {
  const definitions:any={[hash(2)]:{kind:'code',metadata:meta()}}, rootNodes:any[]=[];
  for(let i=0,remaining=count;remaining>0;i++){
    const n=Math.min(128,remaining);remaining-=n;
    definitions[hash(3+i)]=graphDef(Array.from({length:n},(_,j)=>node(j+1,2)));
    rootNodes.push(node(i+1,3+i));
  }
  definitions[hash(1)]=graphDef(rootNodes);
  return clone({graph:{version:2,rootDefinitionHash:hash(1),outputPort:'image'},definitions});
}
export function fanout(extra=false):any {
  const ports=Object.fromEntries(Array.from({length:16},(_,i)=>[`p${i}`,signal]));
  const producer=graphDef([node(1,3)],[],{},Object.fromEntries(Object.keys(ports).map(id=>[id,ref(1,id)])),{},meta({},ports));
  const consumer=graphDef(Array.from({length:64},(_,i)=>node(i+1,5)),[],Object.fromEntries(Object.keys(ports).map(id=>[id,Array.from({length:64},(_,i)=>ref(i+1,id))])),{image:ref(1)},{},meta(ports));
  const nodes=[node(1,2),...Array.from({length:4},(_,i)=>node(i+2,4))];
  const edges=Array.from({length:64},(_,i)=>edge(i,uuid(1),`p${i%16}`,uuid(2+Math.floor(i/16)),`p${i%16}`));
  if(extra){nodes.push(node(6,6));edges.push(edge(65,uuid(1),'p0',uuid(6),'p0'));}
  return clone({graph:{version:2,rootDefinitionHash:hash(1),outputPort:'image'},definitions:{[hash(1)]:graphDef(nodes,edges,{},{image:ref(2)}),[hash(2)]:producer,[hash(3)]:{kind:'code',metadata:meta({},ports)},[hash(4)]:consumer,[hash(5)]:{kind:'code',metadata:meta(ports)},[hash(6)]:{kind:'code',metadata:meta({p0:signal})}}});
}
export function placements(extra=false):any {
  const defs:any={[hash(9)]:{kind:'code',metadata:meta()}};
  defs[hash(8)]=graphDef([node(1,9)]);defs[hash(7)]=graphDef([node(1,8)]);defs[hash(6)]=graphDef([node(1,7)]);
  defs[hash(3)]=graphDef(Array.from({length:128},(_,i)=>node(i+1,i<(extra?3:4)?7:6)));
  defs[hash(4)]=graphDef(Array.from({length:128},(_,i)=>node(i+1,6)));
  defs[hash(1)]=graphDef([node(1,3),node(2,4),node(3,4),node(4,4)]);
  return clone({graph:{version:2,rootDefinitionHash:hash(1),outputPort:'image'},definitions:defs});
}
export function controlFanout(extra=false):any {
  const controls=Object.fromEntries(Array.from({length:16},(_,i)=>[`c${i}`,control()]));
  const group=graphDef(Array.from({length:64},(_,i)=>node(i+1,3)),[],{},{image:ref(1)},Object.fromEntries(Object.keys(controls).map(id=>[id,Array.from({length:64},(_,i)=>cref(i+1,id))])),meta({},{image},controls));
  const root=graphDef(Array.from({length:8},(_,i)=>node(i+1,2)),[],{},{image:ref(1)},Object.fromEntries(Object.keys(controls).map(id=>[id,Array.from({length:8},(_,i)=>cref(i+1,id))])),meta({},{image},controls));
  const result:any=clone({graph:{version:2,rootDefinitionHash:hash(1),outputPort:'image'},definitions:{[hash(1)]:root,[hash(2)]:group,[hash(3)]:{kind:'code',metadata:meta({},{image},controls)}}});
  if(extra){
    const variant=clone(group);variant.metadata=meta({},{image},{...controls,extra:control()});variant.body.controlBindings.extra=[cref(1,'extra')];variant.body.nodes[0]!.definitionHash=hash(5);
    result.definitions[hash(4)]=variant;result.definitions[hash(5)]={kind:'code',metadata:meta({},{image},{...controls,extra:control()})};result.definitions[hash(1)].body.nodes[0].definitionHash=hash(4);
  }
  return result;
}
export function sizedBody(target:number):any {
  const ids=Array.from({length:32},(_,i)=>`c${String(i).padStart(2,'0')}${'x'.repeat(61)}`);
  const controls=Object.fromEntries(ids.map(id=>[id,control(0)]));
  const body=graphDef(Array.from({length:128},(_,i)=>node(i+1,2))).body;
  let remaining=target-Buffer.byteLength(JSON.stringify(body));
  for(const n of body.nodes)for(const id of ids){const cost=id.length+4+(Object.keys(n.controlDefaults).length?1:0);if(cost<=remaining){n.controlDefaults[id]=0;remaining-=cost;}}
  for(const n of body.nodes)for(const id of Object.keys(n.controlDefaults))if(remaining){n.controlDefaults[id]=10;remaining--;}
  if(remaining!==0||Buffer.byteLength(JSON.stringify(body))!==target)throw Error('Body fixture size not constructible');
  return clone({graph:{version:2,rootDefinitionHash:hash(1),outputPort:'image'},definitions:{[hash(1)]:{kind:'graph',metadata:meta(),body},[hash(2)]:{kind:'code',metadata:meta({},{image},controls)}}});
}
