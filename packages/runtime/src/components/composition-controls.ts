import {normalizeImageCompositionProfile} from '../../../runtime-contracts/src/composition-profile.mjs';
import type {ImageCompositionProfile} from '../../../runtime-contracts/src/composition-profile.mjs';
import {defaultControlValues,normalizeControlSchema,validateControlSnapshot,reconcileControlValues} from '../../../runtime-contracts/src/parameters.mjs';
import type {ControlMigration,ControlSchema,ControlValues} from '../../../runtime-contracts/src/parameters.mjs';
import type {NodePath} from '../../../runtime-contracts/src/graph.ts';
export type SavedNodeControls=Readonly<{nodes:readonly Readonly<{nodePath:NodePath;definitionHash:string;schema:ControlSchema;schemaHash:string;values:ControlValues}>[]}>;
const freeze=Object.freeze,stringify=JSON.stringify,ownKeys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf;
const arrayIsArray=Array.isArray,objectPrototype=Object.prototype,finite=Number.isFinite,defineProperty=Object.defineProperty,createObject=Object.create,RuntimeError=Error;
const RuntimeMap=Map,call=Function.prototype.call,arrayFind=call.bind(Array.prototype.find),arrayMap=call.bind(Array.prototype.map),arraySlice=call.bind(Array.prototype.slice);
const mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set),hasOwn=call.bind(Object.prototype.hasOwnProperty);
const key=(path:NodePath)=>stringify(path);
const migrationId=(path:NodePath,id:string)=>`${path.join('/')}:${id}`;
function preparedValues(schema:ControlSchema,input:unknown,complete:boolean):ControlValues {
 if(!input||typeof input!=='object'||arrayIsArray(input)||(prototype(input)!==objectPrototype&&prototype(input)!==null))throw new RuntimeError('Control values require a plain record');
 const keys=ownKeys(input);if(!complete&&!keys.length)throw new RuntimeError('Expected a nonempty control patch');
 const result=createObject(objectPrototype) as Record<string,ControlValues[string]>;
 for(let index=0;index<keys.length;index++){
  const id=keys[index];if(typeof id!=='string'||!arrayFind(schema,(row:ControlSchema[number])=>row.id===id))throw new RuntimeError(`Unknown control value ${typeof id==='string'?id.slice(0,64):'invalid key'}`);
 }
 for(let index=0;index<schema.length;index++){
  const control=schema[index]!,field=descriptor(input,control.id);
  if(!field?.enumerable||!hasOwn(field,'value')){if(complete)throw new RuntimeError(`Missing control value ${control.id}`);continue;}
  const value=field.value;let admitted:ControlValues[string];
  if(control.type==='number'){
   if(typeof value!=='number'||!finite(value)||value<control.min||value>control.max)throw new RuntimeError(`Invalid value for ${control.id}`);admitted=value===0?0:value;
  }else if(control.type==='boolean'){
   if(typeof value!=='boolean')throw new RuntimeError(`Invalid value for ${control.id}`);admitted=value;
  }else{
   if(typeof value!=='string')throw new RuntimeError(`Invalid value for ${control.id}`);let found=false;
   for(let optionIndex=0;optionIndex<control.options.length;optionIndex++)if(control.options[optionIndex]!.id===value){found=true;break;}
   if(!found)throw new RuntimeError(`Invalid value for ${control.id}`);admitted=value;
  }
  defineProperty(result,control.id,{value:admitted,enumerable:true});
 }
 return freeze(result);
}
export function createCompositionControlState(input:ImageCompositionProfile,saved?:SavedNodeControls){
 return prepareCompositionControlState(input)(saved);
}
/** Admit and snapshot the immutable graph once; each state still validates its values. */
export function prepareCompositionControlState(input:ImageCompositionProfile){
 const profile=normalizeImageCompositionProfile(input);
 return (saved?:SavedNodeControls)=>{
 const values=new RuntimeMap<string,ControlValues>(),changes:ControlMigration[]=[];
 for(let index=0;index<profile.nodes.length;index++){const node=profile.nodes[index]!;mapSet(values,key(node.nodePath),defaultControlValues(node.schema));}
 if(saved){
  if(!saved||typeof saved!=='object'||!Array.isArray(saved.nodes))throw Error('Invalid saved composition controls');
  const current=new Map(profile.nodes.map(node=>[key(node.nodePath),node])),seen=new Set<string>();
  for(const raw of saved.nodes){
   if(!raw||typeof raw!=='object'||!Array.isArray(raw.nodePath))throw Error('Invalid saved composition node');
   const path=key(raw.nodePath),node=current.get(path);if(seen.has(path))throw Error('Duplicate saved composition node');seen.add(path);
   const previousSchema=normalizeControlSchema(raw.schema),previousValues=validateControlSnapshot(previousSchema,raw.values);
   const reconciled=reconcileControlValues(previousSchema,previousValues,node?.schema??[]);
   if(node)values.set(path,reconciled.values);
   changes.push(...reconciled.changes.map(change=>Object.freeze({...change,id:migrationId(raw.nodePath,change.id)})));
  }
  for(const node of profile.nodes)if(!seen.has(key(node.nodePath))){const added=reconcileControlValues([],{},node.schema);changes.push(...added.changes.map(change=>Object.freeze({...change,id:migrationId(node.nodePath,change.id)})));}
 }
 const find=(path:NodePath)=>{const result=mapGet(values,key(path));if(!result)throw new RuntimeError('Unknown composition node path');return result;};
 const target=(id:string)=>{const targets=profile.publicControlBindings[id];if(!targets||targets.length!==1||!targets[0]?.active)throw new RuntimeError('Unsupported composition control binding');return targets[0];};
 function publicValues(){const result:Record<string,ControlValues[string]>={};for(let index=0;index<profile.publicControls.length;index++){const row=profile.publicControls[index]!,binding=target(row.id),value=find(binding.nodePath)[binding.controlId];if(value===undefined)throw new RuntimeError('Missing composition control value');result[row.id]=value;}return freeze(result);}
 return Object.freeze({
  values:publicValues,
  applyNode(path:NodePath,input:unknown,schemaHash:string){
   const node=arrayFind(profile.nodes,(row:ImageCompositionProfile['nodes'][number])=>key(row.nodePath)===key(path));
   if(!node)throw new RuntimeError('Unknown composition node path');
   if(node.schemaHash!==schemaHash)throw new RuntimeError('Composition node control schema changed');
   const patch=preparedValues(node.schema,input,false);
   mapSet(values,key(path),freeze({...find(path),...patch}));
  },
  apply(input:unknown){const next=preparedValues(profile.publicControls,input,true);for(let index=0;index<profile.publicControls.length;index++){const row=profile.publicControls[index]!,binding=target(row.id),value=next[row.id];if(value===undefined)throw new RuntimeError('Missing composition control value');const path=key(binding.nodePath),leaf:Record<string,ControlValues[string]>={...find(binding.nodePath),[binding.controlId]:value};mapSet(values,path,freeze(leaf));}},
  nodeValues(path:NodePath){return freeze({...find(path)});},
  changes(){return freeze(arraySlice(changes,0));},
  snapshot():SavedNodeControls{return freeze({nodes:freeze(arrayMap(profile.nodes,(node:ImageCompositionProfile['nodes'][number])=>freeze({nodePath:freeze(arraySlice(node.nodePath,0)),definitionHash:node.definitionHash,schema:node.schema,schemaHash:node.schemaHash,values:freeze({...find(node.nodePath)})})))});},
 });
 };
}
