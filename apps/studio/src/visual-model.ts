import type {RuntimeView} from './service-client.ts';
import {LEGACY_CONTROL_SCHEMA,LEGACY_CONTROL_SCHEMA_HASH} from './controls/control-state.ts';
import type {NodePath} from '../../../packages/runtime-contracts/src/graph.ts';
import type {ComponentMetadata} from '../../../packages/runtime-contracts/src/components.mjs';

export const nodeKey=(path:NodePath)=>JSON.stringify(path);
/** [] names only the direct compatibility occurrence, never a graph root selection. */
export function visualSelection(runtime:RuntimeView|null,path:NodePath|null):NodePath|null{return path?.length===0&&runtime?.sdkVersion==='0.4.0'?null:path;}
type Profile=NonNullable<RuntimeView['composition']>;
function profileOccurrence(profile:Profile,path:NodePath){let definitionHash=profile.graph.rootDefinitionHash;
  for(const nodeId of path){const definition=profile.definitions[definitionHash];if(definition?.kind!=='graph')return undefined;const node=definition.body.nodes.find(row=>row.id===nodeId);if(!node)return undefined;definitionHash=node.definitionHash;}
  const definition=profile.definitions[definitionHash];return definition?{nodePath:[...path] as NodePath,definitionHash,definition,metadata:definition.metadata}:undefined;
}
/** View-only compatibility occurrence. Never add this row to persisted graph state. */
function directOccurrence(runtime:RuntimeView){
 const schema=runtime.controlSchema??LEGACY_CONTROL_SCHEMA,definitionHash=runtime.controlSchemaHash??LEGACY_CONTROL_SCHEMA_HASH;
 const metadata:ComponentMetadata={declarationVersion:1,key:'lux/direct-visual',label:'Visual',description:'Direct visual component',tags:[],inputs:{},outputs:{image:{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Final image'}},controls:schema,controlDescriptions:Object.fromEntries(schema.filter(control=>control.description).map(control=>[control.id,control.description!])),lifecycle:{state:'stateful',reset:'seed'}};
 return {nodePath:[] as NodePath,definitionHash,definition:{kind:'code' as const,metadata},metadata};
}
export function compositionOccurrence(runtime:RuntimeView|null,path:NodePath){return runtime?.composition?profileOccurrence(runtime.composition,path):runtime&&runtime.sdkVersion!=='0.4.0'&&path.length===0?directOccurrence(runtime):undefined;}
function children(profile:Profile,focus:NodePath){const definition=profileOccurrence(profile,focus)?.definition;if(definition?.kind!=='graph')return [];
  return definition.body.nodes.map(node=>{const child=profile.definitions[node.definitionHash]!,nodePath=[...focus,node.id] as NodePath,siblings=definition.body.nodes.filter(row=>row.definitionHash===node.definitionHash),index=siblings.findIndex(row=>row.id===node.id);return {...node,nodePath,definition:child,metadata:child.metadata,label:child.metadata.label+(siblings.length>1?` ${index+1}`:'')};});}
export function compositionNodes(runtime:RuntimeView|null){const profile=runtime?.composition;if(!profile){const occurrence=compositionOccurrence(runtime,[]);return occurrence?[{...occurrence,id:'',controlDefaults:{},label:occurrence.metadata.label}]:[];}const current=profile,result:ReturnType<typeof children>=[];function visit(path:NodePath){for(const node of children(current,path)){result.push(node);if(node.definition.kind==='graph')visit(node.nodePath);}}visit([]);return result;}
export function orderedChildren(profile: Profile, focus: NodePath) {
  const nodes = children(profile, focus);
  const definition = profileOccurrence(profile, focus)?.definition;
  if (definition?.kind !== 'graph') return nodes;
  const remaining = new Set(nodes.map(node => node.id));
  const ordered: typeof nodes = [];
  while (remaining.size) {
    const next = nodes.find(node => remaining.has(node.id) && !definition.body.edges.some(edge => edge.to.nodeId === node.id && remaining.has(edge.from.nodeId)));
    if (!next) return nodes;
    ordered.push(next);
    remaining.delete(next.id);
  }
  return ordered;
}
export function compositionControlTarget(runtime:RuntimeView|null,path:NodePath,controlId:string){let occurrence=compositionOccurrence(runtime,path),targetPath=[...path] as NodePath,targetControl=controlId;
  while(occurrence?.definition.kind==='graph'){const refs=occurrence.definition.body.controlBindings[targetControl];if(refs?.length!==1)return undefined;targetPath=[...targetPath,refs[0]!.nodeId];targetControl=refs[0]!.controlId;occurrence=compositionOccurrence(runtime,targetPath);}
  return occurrence?.definition.kind==='code'&&occurrence.metadata.controls.some(control=>control.id===targetControl)?{nodePath:targetPath,controlId:targetControl}:undefined;
}
/** The same guarded identity used by base controls and modulation bindings. */
export function visualControlNode(runtime:RuntimeView,path:NodePath){
 if(runtime.sdkVersion==='0.4.0')return runtime.nodeControls?.nodes.find(node=>nodeKey(node.nodePath)===nodeKey(path));
 if(path.length)return undefined;
 const schemaHash=runtime.controlSchemaHash??LEGACY_CONTROL_SCHEMA_HASH;
 return {nodePath:[] as NodePath,definitionHash:schemaHash,schemaHash,schema:runtime.controlSchema??LEGACY_CONTROL_SCHEMA,values:runtime.controls??{intensity:runtime.intensity!}};
}
export function compositionNodeLabel(runtime:RuntimeView|null,path:NodePath){if(!path.length)return compositionOccurrence(runtime,[])?.metadata.label??'Composition';const parent=path.slice(0,-1) as NodePath;return runtime?.composition?children(runtime.composition,parent).find(node=>nodeKey(node.nodePath)===nodeKey(path))?.label??compositionOccurrence(runtime,path)?.metadata.label??'Component':'Component';}
