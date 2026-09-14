import {validateControlAnimationBindings} from '../../../../packages/runtime-contracts/src/control-animation.mjs';
const freeze=Object.freeze,stringify=JSON.stringify,isFiniteNumber=Number.isFinite,sin=Math.sin,abs=Math.abs,min=Math.min,max=Math.max,PI=Math.PI;
const key=path=>stringify(path);
const finite=(value,label)=>{if(!isFiniteNumber(value))throw Error(`Invalid animation ${label}`);return value;};

export function normalizeControlAnimations(input,profile){
 const bindings=validateControlAnimationBindings(input),nodes=new Map(profile.nodes.map(node=>[key(node.nodePath),node])),issues=[];
 bindings.forEach((raw,index)=>{
  const node=nodes.get(key(raw.nodePath));let issue;
  if(!node)issue='Animation target is no longer available.';
  else if(node.definitionHash!==raw.definitionHash||node.schemaHash!==raw.schemaHash)issue='Animated control changed and is incompatible with this binding.';
  else if(!node.schema.some(control=>control.id===raw.controlId))issue='Animated control is no longer available.';
  if(issue)issues.push(freeze({index,nodePath:freeze([...raw.nodePath]),controlId:raw.controlId,message:issue}));
 });
 return freeze({bindings,issues:freeze(issues)});
}

function wave(shape,cycle){
 if(shape==='sine')return sin(2*PI*cycle);
 if(shape==='triangle')return 1-4*abs(cycle-.5);
 if(shape==='saw')return 2*cycle-1;
 return cycle<.5?1:-1;
}

export function animatedControlValue(base,definition,binding,timeSeconds){
 if(!binding?.enabled)return base;
 const cycle=((finite(timeSeconds,'time')/binding.periodSeconds+binding.phase)%1+1)%1;
 return min(definition.max,max(definition.min,base+binding.amount*wave(binding.shape,cycle)));
}

export function createControlAnimationEvaluator(profile,base,normalized){
 let current=normalized;
 let entries=new Map(normalized.bindings.map(binding=>[`${key(binding.nodePath)}:${binding.controlId}`,{binding,anchorTime:0,frozenElapsed:0}]));
 const elapsed=(entry,timeSeconds)=>entry.frozenElapsed+(entry.binding.enabled?max(0,timeSeconds-entry.anchorTime):0);
 function replace(next,timeSeconds){
  finite(timeSeconds,'time');const previous=entries,nextEntries=new Map();
  for(const binding of next.bindings){const id=`${key(binding.nodePath)}:${binding.controlId}`,before=previous.get(id);let anchorTime=timeSeconds,frozenElapsed=0;
   if(before){const atChange=elapsed(before,timeSeconds);if(binding.enabled){if(before.binding.enabled){anchorTime=before.anchorTime;frozenElapsed=before.frozenElapsed;}else frozenElapsed=before.frozenElapsed;}else frozenElapsed=atChange;}
   nextEntries.set(id,{binding,anchorTime,frozenElapsed});
  }
  current=next;entries=nextEntries;
 }
 function restart(path,controlId,timeSeconds){const id=`${key(path)}:${controlId}`,entry=entries.get(id);if(entry){finite(timeSeconds,'time');entries.set(id,{binding:entry.binding,anchorTime:timeSeconds,frozenElapsed:0});}}
  function nodeValues(path,timeSeconds){
   const values={...base.nodeValues(path)},node=profile.nodes.find(row=>key(row.nodePath)===key(path));
   if(!node)return freeze(values);
  const issueKeys=new Set(current.issues.map(issue=>`${key(issue.nodePath)}:${issue.controlId}`));
  for(const definition of node.schema){const id=`${key(path)}:${definition.id}`,entry=entries.get(id);if(entry&&!issueKeys.has(id))values[definition.id]=animatedControlValue(values[definition.id],definition,entry.binding,elapsed(entry,timeSeconds));}
  return freeze(values);
 }
 function values(timeSeconds){
  const values={...base.values()};
  for(const definition of profile.publicControls){const targets=profile.publicControlBindings[definition.id],target=targets?.length===1&&targets[0]?.active?targets[0]:undefined;if(target)values[definition.id]=nodeValues(target.nodePath,timeSeconds)[target.controlId];}
  return freeze(values);
 }
 return freeze({nodeValues,values,replace,restart,bindings:()=>current.bindings,issues:()=>current.issues});
}
