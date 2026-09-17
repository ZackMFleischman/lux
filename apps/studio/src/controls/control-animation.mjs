import {validateControlAnimationBindings} from '../../../../packages/runtime-contracts/src/control-animation.mjs';
import {normalizeAudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
const freeze=Object.freeze,stringify=JSON.stringify,isFiniteNumber=Number.isFinite,sin=Math.sin,abs=Math.abs,min=Math.min,max=Math.max,exp=Math.exp,PI=Math.PI,RuntimeError=Error;
const RuntimeMap=Map,RuntimeSet=Set,call=Function.prototype.call;
const arrayFind=call.bind(Array.prototype.find),arraySome=call.bind(Array.prototype.some),arrayPush=call.bind(Array.prototype.push);
const mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set),setAdd=call.bind(Set.prototype.add),setHas=call.bind(Set.prototype.has);
const key=path=>stringify(path);
const finite=(value,label)=>{if(!isFiniteNumber(value))throw new RuntimeError(`Invalid animation ${label}`);return value;};

function random01(value){let hash=2166136261;for(let index=0;index<value.length;index++){hash^=value.charCodeAt(index);hash=Math.imul(hash,16777619);}return (hash>>>0)/4294967296;}
export function controlVariationValue(base,definition,binding,instanceKey){
 if(!binding?.enabled)return base;
 if(!((typeof instanceKey==='string'&&instanceKey.length<=256)||(typeof instanceKey==='number'&&Number.isSafeInteger(instanceKey))))throw new RuntimeError('Invalid variation instance key');
 const typedInstanceKey=`${typeof instanceKey}:${instanceKey}`,identity=`${key(binding.nodePath)}:${binding.controlId}:${typedInstanceKey}`,uniform=salt=>random01(`${identity}:${salt}`);
 let unit;
 if(binding.distribution==='spread'){const sequence=typeof instanceKey==='number'?(instanceKey+1)*0.6180339887498949:uniform(0);unit=((sequence%1)+1)%1;}
 else if(binding.distribution==='centered')unit=(uniform(0)+uniform(1)+uniform(2))/3;
 else unit=uniform(0);
 return min(definition.max,max(definition.min,base+binding.amount*(2*unit-1)));
}

export function normalizeControlAnimations(input,profile){
 const bindings=validateControlAnimationBindings(input),nodes=new RuntimeMap(),issues=[];
 for(let index=0;index<profile.nodes.length;index++){const node=profile.nodes[index];mapSet(nodes,key(node.nodePath),node);}
 let audioConfiguration;
 for(let index=0;index<bindings.length;index++){
  const raw=bindings[index],node=mapGet(nodes,key(raw.nodePath));let issue;
  if(!node)issue='Animation target is no longer available.';
  else if(node.definitionHash!==raw.definitionHash||node.schemaHash!==raw.schemaHash)issue='Animated control changed and is incompatible with this binding.';
  else if(!arraySome(node.schema,control=>control.id===raw.controlId))issue='Animated control is no longer available.';
  if(raw.kind==='audio'||raw.kind==='kick'){
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
export function tempoControlValue(base,definition,binding,beatPosition){
 if(!binding?.enabled)return base;
 const cycle=((finite(beatPosition,'beat position')/binding.beatsPerCycle+binding.phase)%1+1)%1;
 return min(definition.max,max(definition.min,base+binding.amount*wave(binding.shape,cycle)));
}

export function createControlAnimationEvaluator(profile,base,normalized){
 let current=normalized;
 let entries=new RuntimeMap();
 let audioSnapshot=normalizeAudioBandSnapshot({generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0});
 const createEntry=binding=>binding.kind==='audio'?{binding,filtered:0,lastTime:undefined}:binding.kind==='kick'?{binding,phase:'idle',phaseStart:0,startValue:0,peak:0,lastTrigger:undefined,observedGeneration:audioSnapshot.generation,observedKickSequence:audioSnapshot.kickSequence,wasAvailable:audioSnapshot.available}:binding.kind==='tempo'||binding.kind==='variation'?{binding}:{binding,anchorTime:0,frozenElapsed:0};
 for(let index=0;index<normalized.bindings.length;index++){const binding=normalized.bindings[index];mapSet(entries,`${key(binding.nodePath)}:${binding.controlId}`,createEntry(binding));}
 const elapsed=(entry,timeSeconds)=>entry.frozenElapsed+(entry.binding.enabled?max(0,timeSeconds-entry.anchorTime):0);
 function replace(next,timeSeconds){
  finite(timeSeconds,'time');const previous=entries,nextEntries=new RuntimeMap();
  for(let index=0;index<next.bindings.length;index++){const binding=next.bindings[index],id=`${key(binding.nodePath)}:${binding.controlId}`,before=mapGet(previous,id);let anchorTime=timeSeconds,frozenElapsed=0;
   if(binding.kind==='audio'){
    mapSet(nextEntries,id,before?.binding.kind==='audio'?{binding,filtered:before.filtered,lastTime:before.lastTime}:createEntry(binding));continue;
   }
   if(binding.kind==='kick'){
    const entry=before?.binding.kind==='kick'?{...before,binding}:createEntry(binding);
    if(!binding.enabled||!before?.binding.enabled){entry.phase='idle';entry.startValue=0;entry.peak=0;entry.observedGeneration=audioSnapshot.generation;entry.observedKickSequence=audioSnapshot.kickSequence;}
    mapSet(nextEntries,id,entry);continue;
   }
   if(binding.kind==='tempo'||binding.kind==='variation'){mapSet(nextEntries,id,{binding});continue;}
   if(before&&before.binding.kind!=='audio'&&before.binding.kind!=='kick'&&before.binding.kind!=='tempo'&&before.binding.kind!=='variation'){const atChange=elapsed(before,timeSeconds);if(binding.enabled){if(before.binding.enabled){anchorTime=before.anchorTime;frozenElapsed=before.frozenElapsed;}else frozenElapsed=before.frozenElapsed;}else frozenElapsed=atChange;}
   mapSet(nextEntries,id,{binding,anchorTime,frozenElapsed});
  }
  current=next;entries=nextEntries;
 }
 function restart(path,controlId,timeSeconds){const id=`${key(path)}:${controlId}`,entry=mapGet(entries,id);if(entry){finite(timeSeconds,'time');if(entry.binding.kind==='tempo'||entry.binding.kind==='variation')return;mapSet(entries,id,entry.binding.kind==='audio'?{binding:entry.binding,filtered:0,lastTime:timeSeconds}:entry.binding.kind==='kick'?{...createEntry(entry.binding),observedGeneration:audioSnapshot.generation,observedKickSequence:audioSnapshot.kickSequence}:{binding:entry.binding,anchorTime:timeSeconds,frozenElapsed:0});}}
 function audioValue(entry,timeSeconds){
  const time=finite(timeSeconds,'time'),target=audioSnapshot.available?audioSnapshot[entry.binding.source.band]:0,previous=entry.filtered;
  const deltaMs=entry.lastTime===undefined?0:min(60000,max(0,(time-entry.lastTime)*1000));
  const tau=target>previous?entry.binding.attackMs:entry.binding.releaseMs,alpha=tau===0?1:-Math.expm1(-deltaMs/tau),filtered=previous+(target-previous)*alpha;
  entry.filtered=filtered;entry.lastTime=entry.lastTime===undefined?time:max(entry.lastTime,time);return filtered;
 }
 const exponentialSpan=1-exp(-5);
 function envelopeProgress(value,shape){const bounded=min(1,max(0,value));return shape==='linear'?bounded:(1-exp(-5*bounded))/exponentialSpan;}
 function envelopeAt(entry,timeSeconds){
  if(entry.phase==='idle')return 0;
  const elapsedMs=max(0,(timeSeconds-entry.phaseStart)*1000);
  if(entry.phase==='release'){
   if(entry.binding.releaseMs===0||elapsedMs>=entry.binding.releaseMs){entry.phase='idle';return 0;}
   return entry.startValue*(1-envelopeProgress(elapsedMs/entry.binding.releaseMs,entry.binding.envelope));
  }
  if(elapsedMs<=entry.binding.attackMs){if(entry.binding.attackMs===0)return entry.peak;return entry.startValue+(entry.peak-entry.startValue)*envelopeProgress(elapsedMs/entry.binding.attackMs,entry.binding.envelope);}
  const releaseElapsed=elapsedMs-entry.binding.attackMs;
  if(entry.binding.releaseMs===0||releaseElapsed>=entry.binding.releaseMs){entry.phase='idle';return 0;}
  return entry.peak*(1-envelopeProgress(releaseElapsed/entry.binding.releaseMs,entry.binding.envelope));
 }
 function kickValue(entry,timeSeconds){
  const time=finite(timeSeconds,'time');let value=envelopeAt(entry,time);
  if(!audioSnapshot.available){
   if(entry.wasAvailable&&value>0){entry.phase='release';entry.phaseStart=time;entry.startValue=value;value=envelopeAt(entry,time);}
   entry.wasAvailable=false;entry.observedGeneration=audioSnapshot.generation;entry.observedKickSequence=audioSnapshot.kickSequence;return value;
  }
  entry.wasAvailable=true;
  const unseen=audioSnapshot.generation>entry.observedGeneration||(audioSnapshot.generation===entry.observedGeneration&&audioSnapshot.kickSequence>entry.observedKickSequence);
  if(unseen){
   entry.observedGeneration=audioSnapshot.generation;entry.observedKickSequence=audioSnapshot.kickSequence;
   const threshold=.5-.45*entry.binding.sensitivity,lastTrigger=entry.lastTrigger;
   if(audioSnapshot.kickSequence>0&&audioSnapshot.kickStrength>=threshold&&(lastTrigger===undefined||(time-lastTrigger)*1000>=entry.binding.retriggerMs)){
    value=envelopeAt(entry,time);entry.phase='trigger';entry.phaseStart=time;entry.startValue=value;entry.peak=audioSnapshot.kickStrength;entry.lastTrigger=time;value=envelopeAt(entry,time);
   }
  }
  return value;
 }
  function nodeValues(path,timeSeconds,beatPosition=0){
   const values={...base.nodeValues(path)},node=arrayFind(profile.nodes,row=>key(row.nodePath)===key(path));
   if(!node)return freeze(values);
  const issueKeys=new RuntimeSet();for(let index=0;index<current.issues.length;index++){const issue=current.issues[index];setAdd(issueKeys,`${key(issue.nodePath)}:${issue.controlId}`);}
  for(let index=0;index<node.schema.length;index++){const definition=node.schema[index],id=`${key(path)}:${definition.id}`,entry=mapGet(entries,id);if(entry&&!setHas(issueKeys,id)&&entry.binding.kind!=='variation')values[definition.id]=entry.binding.kind==='audio'?(entry.binding.enabled?min(definition.max,max(definition.min,values[definition.id]+entry.binding.amount*audioValue(entry,timeSeconds))):values[definition.id]):entry.binding.kind==='kick'?(entry.binding.enabled?min(definition.max,max(definition.min,values[definition.id]+entry.binding.amount*kickValue(entry,timeSeconds))):values[definition.id]):entry.binding.kind==='tempo'?tempoControlValue(values[definition.id],definition,entry.binding,beatPosition):animatedControlValue(values[definition.id],definition,entry.binding,elapsed(entry,timeSeconds));}
  return freeze(values);
 }
 function sample(path,controlId,instanceKey,timeSeconds,beatPosition=0){
  const node=arrayFind(profile.nodes,row=>key(row.nodePath)===key(path)),definition=node&&arrayFind(node.schema,row=>row.id===controlId),id=`${key(path)}:${controlId}`,entry=mapGet(entries,id);
  if(!definition)throw new RuntimeError('Unknown variation control');
  const baseValue=nodeValues(path,timeSeconds,beatPosition)[controlId];
  return entry?.binding.kind==='variation'&&!arraySome(current.issues,issue=>`${key(issue.nodePath)}:${issue.controlId}`===id)?controlVariationValue(baseValue,definition,entry.binding,instanceKey):baseValue;
 }
 function values(timeSeconds,beatPosition=0){
  const values={...base.values()};
  for(let index=0;index<profile.publicControls.length;index++){const definition=profile.publicControls[index],targets=profile.publicControlBindings[definition.id],target=targets?.length===1&&targets[0]?.active?targets[0]:undefined;if(target)values[definition.id]=nodeValues(target.nodePath,timeSeconds,beatPosition)[target.controlId];}
  return freeze(values);
 }
 function forEachKickEntry(visit){for(let index=0;index<current.bindings.length;index++){const binding=current.bindings[index];if(binding.kind==='kick'){const entry=mapGet(entries,`${key(binding.nodePath)}:${binding.controlId}`);if(entry)visit(entry);}}}
 function fenceAudioEvents(){forEachKickEntry(entry=>{entry.observedGeneration=audioSnapshot.generation;entry.observedKickSequence=audioSnapshot.kickSequence;});}
 function applyAudioSnapshot(input,state){const next=normalizeAudioBandSnapshot(input);if(next.generation<audioSnapshot.generation||(next.generation===audioSnapshot.generation&&next.sequence<=audioSnapshot.sequence))return false;audioSnapshot=next;if(state?.playing===false)fenceAudioEvents();forEachKickEntry(entry=>{if(!entry.binding.enabled){entry.observedGeneration=next.generation;entry.observedKickSequence=next.kickSequence;}});return true;}
 return freeze({nodeValues,values,sample,replace,restart,applyAudioSnapshot,fenceAudioEvents,bindings:()=>current.bindings,issues:()=>current.issues});
}
