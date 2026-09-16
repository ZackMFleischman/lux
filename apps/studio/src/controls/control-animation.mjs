import {validateControlAnimationBindings} from '../../../../packages/runtime-contracts/src/control-animation.mjs';
import {normalizeAudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
const freeze=Object.freeze,stringify=JSON.stringify,isFiniteNumber=Number.isFinite,sin=Math.sin,abs=Math.abs,min=Math.min,max=Math.max,PI=Math.PI,RuntimeError=Error;
const RuntimeMap=Map,RuntimeSet=Set,call=Function.prototype.call;
const arrayFind=call.bind(Array.prototype.find),arraySome=call.bind(Array.prototype.some),arrayPush=call.bind(Array.prototype.push);
const mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set),setAdd=call.bind(Set.prototype.add),setHas=call.bind(Set.prototype.has);
const key=path=>stringify(path);
const finite=(value,label)=>{if(!isFiniteNumber(value))throw new RuntimeError(`Invalid animation ${label}`);return value;};

export function normalizeControlAnimations(input,profile){
 const bindings=validateControlAnimationBindings(input),nodes=new RuntimeMap(),issues=[];
 for(let index=0;index<profile.nodes.length;index++){const node=profile.nodes[index];mapSet(nodes,key(node.nodePath),node);}
 let audioConfiguration;
 for(let index=0;index<bindings.length;index++){
  const raw=bindings[index],node=mapGet(nodes,key(raw.nodePath));let issue;
  if(!node)issue='Animation target is no longer available.';
  else if(node.definitionHash!==raw.definitionHash||node.schemaHash!==raw.schemaHash)issue='Animated control changed and is incompatible with this binding.';
  else if(!arraySome(node.schema,control=>control.id===raw.controlId))issue='Animated control is no longer available.';
  if(raw.kind==='audio'){
   const configuration=stringify([raw.source.logicalInputId,raw.source.analyzer]);
   if(audioConfiguration===undefined)audioConfiguration=configuration;else if(audioConfiguration!==configuration&&!issue)issue='Audio binding uses an unavailable input configuration.';
  }
  if(issue){const nodePath=[];for(let pathIndex=0;pathIndex<raw.nodePath.length;pathIndex++)arrayPush(nodePath,raw.nodePath[pathIndex]);arrayPush(issues,freeze({index,nodePath:freeze(nodePath),controlId:raw.controlId,message:issue}));}
 }
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
 let entries=new RuntimeMap();
 let audioSnapshot=normalizeAudioBandSnapshot({generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0});
 const createEntry=binding=>binding.kind==='audio'?{binding,filtered:0,lastTime:undefined}:{binding,anchorTime:0,frozenElapsed:0};
 for(let index=0;index<normalized.bindings.length;index++){const binding=normalized.bindings[index];mapSet(entries,`${key(binding.nodePath)}:${binding.controlId}`,createEntry(binding));}
 const elapsed=(entry,timeSeconds)=>entry.frozenElapsed+(entry.binding.enabled?max(0,timeSeconds-entry.anchorTime):0);
 function replace(next,timeSeconds){
  finite(timeSeconds,'time');const previous=entries,nextEntries=new RuntimeMap();
  for(let index=0;index<next.bindings.length;index++){const binding=next.bindings[index],id=`${key(binding.nodePath)}:${binding.controlId}`,before=mapGet(previous,id);let anchorTime=timeSeconds,frozenElapsed=0;
   if(binding.kind==='audio'){
    mapSet(nextEntries,id,before?.binding.kind==='audio'?{binding,filtered:before.filtered,lastTime:before.lastTime}:createEntry(binding));continue;
   }
   if(before&&before.binding.kind!=='audio'){const atChange=elapsed(before,timeSeconds);if(binding.enabled){if(before.binding.enabled){anchorTime=before.anchorTime;frozenElapsed=before.frozenElapsed;}else frozenElapsed=before.frozenElapsed;}else frozenElapsed=atChange;}
   mapSet(nextEntries,id,{binding,anchorTime,frozenElapsed});
  }
  current=next;entries=nextEntries;
 }
 function restart(path,controlId,timeSeconds){const id=`${key(path)}:${controlId}`,entry=mapGet(entries,id);if(entry){finite(timeSeconds,'time');mapSet(entries,id,entry.binding.kind==='audio'?{binding:entry.binding,filtered:0,lastTime:timeSeconds}:{binding:entry.binding,anchorTime:timeSeconds,frozenElapsed:0});}}
 function audioValue(entry,timeSeconds){
  const time=finite(timeSeconds,'time'),target=audioSnapshot.available?audioSnapshot[entry.binding.source.band]:0,previous=entry.filtered;
  const deltaMs=entry.lastTime===undefined?0:min(60000,max(0,(time-entry.lastTime)*1000));
  const tau=target>previous?entry.binding.attackMs:entry.binding.releaseMs,alpha=tau===0?1:-Math.expm1(-deltaMs/tau),filtered=previous+(target-previous)*alpha;
  entry.filtered=filtered;entry.lastTime=entry.lastTime===undefined?time:max(entry.lastTime,time);return filtered;
 }
  function nodeValues(path,timeSeconds){
   const values={...base.nodeValues(path)},node=arrayFind(profile.nodes,row=>key(row.nodePath)===key(path));
   if(!node)return freeze(values);
  const issueKeys=new RuntimeSet();for(let index=0;index<current.issues.length;index++){const issue=current.issues[index];setAdd(issueKeys,`${key(issue.nodePath)}:${issue.controlId}`);}
  for(let index=0;index<node.schema.length;index++){const definition=node.schema[index],id=`${key(path)}:${definition.id}`,entry=mapGet(entries,id);if(entry&&!setHas(issueKeys,id))values[definition.id]=entry.binding.kind==='audio'?(entry.binding.enabled?min(definition.max,max(definition.min,values[definition.id]+entry.binding.amount*audioValue(entry,timeSeconds))):values[definition.id]):animatedControlValue(values[definition.id],definition,entry.binding,elapsed(entry,timeSeconds));}
  return freeze(values);
 }
 function values(timeSeconds){
  const values={...base.values()};
  for(let index=0;index<profile.publicControls.length;index++){const definition=profile.publicControls[index],targets=profile.publicControlBindings[definition.id],target=targets?.length===1&&targets[0]?.active?targets[0]:undefined;if(target)values[definition.id]=nodeValues(target.nodePath,timeSeconds)[target.controlId];}
  return freeze(values);
 }
 function applyAudioSnapshot(input){const next=normalizeAudioBandSnapshot(input);if(next.generation<audioSnapshot.generation||(next.generation===audioSnapshot.generation&&next.sequence<=audioSnapshot.sequence))return false;audioSnapshot=next;return true;}
 return freeze({nodeValues,values,replace,restart,applyAudioSnapshot,bindings:()=>current.bindings,issues:()=>current.issues});
}
