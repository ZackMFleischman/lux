import {normalizeImageCompositionProfile} from '../../../runtime-contracts/src/composition-profile.mjs';
import type {ImageCompositionProfile} from '../../../runtime-contracts/src/composition-profile.mjs';
import {defaultControlValues,normalizeControlSchema,validateControlSnapshot,canonicalControlSchemaJson} from '../../../runtime-contracts/src/parameters.mjs';
import type {ControlSchema,ControlValues} from '../../../runtime-contracts/src/parameters.mjs';
import type {NodePath} from '../../../runtime-contracts/src/graph.ts';
export type SavedNodeControls=Readonly<{nodes:readonly Readonly<{nodePath:NodePath;definitionHash:string;schema:ControlSchema;schemaHash:string;values:ControlValues}>[]}>;
const key=(path:NodePath)=>JSON.stringify(path);
export function createCompositionControlState(input:ImageCompositionProfile,saved?:SavedNodeControls){
 const profile=normalizeImageCompositionProfile(input),values=new Map<string,ControlValues>();
 for(const node of profile.nodes)values.set(key(node.nodePath),defaultControlValues(node.schema));
 if(saved){if(!saved||typeof saved!=='object'||!Array.isArray(saved.nodes))throw Error('Invalid saved composition controls');const current=new Map(profile.nodes.map(node=>[key(node.nodePath),node]));const seen=new Set<string>();for(const raw of saved.nodes){if(!raw||typeof raw!=='object'||!Array.isArray(raw.nodePath))throw Error('Invalid saved composition node');const path=key(raw.nodePath),node=current.get(path);if(seen.has(path))throw Error('Duplicate saved composition node');seen.add(path);if(!node||raw.definitionHash!==node.definitionHash||raw.schemaHash!==node.schemaHash||canonicalControlSchemaJson(normalizeControlSchema(raw.schema))!==canonicalControlSchemaJson(node.schema))continue;values.set(path,validateControlSnapshot(node.schema,raw.values));}}
 const find=(path:NodePath)=>{const result=values.get(key(path));if(!result)throw Error('Unknown composition node path');return result;};
 const target=(id:string)=>{const targets=profile.publicControlBindings[id];if(!targets||targets.length!==1||!targets[0]?.active)throw Error('Unsupported composition control binding');return targets[0];};
 function publicValues(){const result:Record<string,number>={};for(const row of profile.publicControls){const binding=target(row.id),value=find(binding.nodePath)[binding.controlId];if(value===undefined)throw Error('Missing composition control value');result[row.id]=value;}return Object.freeze(result);}
 return Object.freeze({
  values:publicValues,
  apply(input:unknown){const next=validateControlSnapshot(profile.publicControls,input);for(const row of profile.publicControls){const binding=target(row.id),value=next[row.id];if(value===undefined)throw Error('Missing composition control value');const path=key(binding.nodePath),leaf:Record<string,number>={...find(binding.nodePath),[binding.controlId]:value};values.set(path,Object.freeze(leaf));}},
  nodeValues(path:NodePath){return Object.freeze({...find(path)});},
  snapshot():SavedNodeControls{return Object.freeze({nodes:Object.freeze(profile.nodes.map(node=>Object.freeze({nodePath:Object.freeze([...node.nodePath]),definitionHash:node.definitionHash,schema:node.schema,schemaHash:node.schemaHash,values:Object.freeze({...find(node.nodePath)})})))});},
 });
}
