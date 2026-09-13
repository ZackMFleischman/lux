import {normalizeImageCompositionProfile} from '../../../runtime-contracts/src/composition-profile.mjs';
import type {ImageCompositionProfile} from '../../../runtime-contracts/src/composition-profile.mjs';
import {defaultControlValues,normalizeControlSchema,validateControlSnapshot,validateControlPatch,reconcileControlValues} from '../../../runtime-contracts/src/parameters.mjs';
import type {ControlMigration,ControlSchema,ControlValues} from '../../../runtime-contracts/src/parameters.mjs';
import type {NodePath} from '../../../runtime-contracts/src/graph.ts';
export type SavedNodeControls=Readonly<{nodes:readonly Readonly<{nodePath:NodePath;definitionHash:string;schema:ControlSchema;schemaHash:string;values:ControlValues}>[]}>;
const key=(path:NodePath)=>JSON.stringify(path);
const migrationId=(path:NodePath,id:string)=>`${path.join('/')}:${id}`;
export function createCompositionControlState(input:ImageCompositionProfile,saved?:SavedNodeControls){
 const profile=normalizeImageCompositionProfile(input),values=new Map<string,ControlValues>(),changes:ControlMigration[]=[];
 for(const node of profile.nodes)values.set(key(node.nodePath),defaultControlValues(node.schema));
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
 const find=(path:NodePath)=>{const result=values.get(key(path));if(!result)throw Error('Unknown composition node path');return result;};
 const target=(id:string)=>{const targets=profile.publicControlBindings[id];if(!targets||targets.length!==1||!targets[0]?.active)throw Error('Unsupported composition control binding');return targets[0];};
 function publicValues(){const result:Record<string,number>={};for(const row of profile.publicControls){const binding=target(row.id),value=find(binding.nodePath)[binding.controlId];if(value===undefined)throw Error('Missing composition control value');result[row.id]=value;}return Object.freeze(result);}
 return Object.freeze({
  values:publicValues,
  applyNode(path:NodePath,input:unknown,schemaHash:string){
   const node=profile.nodes.find(row=>key(row.nodePath)===key(path));
   if(!node)throw Error('Unknown composition node path');
   if(node.schemaHash!==schemaHash)throw Error('Composition node control schema changed');
   const patch=validateControlPatch(node.schema,input);
   values.set(key(path),Object.freeze({...find(path),...patch}));
  },
  apply(input:unknown){const next=validateControlSnapshot(profile.publicControls,input);for(const row of profile.publicControls){const binding=target(row.id),value=next[row.id];if(value===undefined)throw Error('Missing composition control value');const path=key(binding.nodePath),leaf:Record<string,number>={...find(binding.nodePath),[binding.controlId]:value};values.set(path,Object.freeze(leaf));}},
  nodeValues(path:NodePath){return Object.freeze({...find(path)});},
  changes(){return Object.freeze([...changes]);},
  snapshot():SavedNodeControls{return Object.freeze({nodes:Object.freeze(profile.nodes.map(node=>Object.freeze({nodePath:Object.freeze([...node.nodePath]),definitionHash:node.definitionHash,schema:node.schema,schemaHash:node.schemaHash,values:Object.freeze({...find(node.nodePath)})})))});},
 });
}
