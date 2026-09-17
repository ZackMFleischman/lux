// Pure Story metadata policy. Source capability, persisted Scene definition,
// runtime transport and UI selection remain distinct contracts.
export const storyLimits=Object.freeze({beats:128,occurrences:1024,id:128,label:160});
const reserved=new Set(['constructor','prototype','__proto__']);

function invalid(path,message){throw Object.assign(new Error(`${path}: ${message}`),{code:'INVALID_STORY',path});}
function record(input,path,fields){
 if(!input||typeof input!=='object'||Array.isArray(input))invalid(path,'expected a plain data record');
 const prototype=Object.getPrototypeOf(input);if(prototype!==null&&prototype!==Object.prototype)invalid(path,'expected a plain data record');
 const result=Object.create(null);
 for(const key of Reflect.ownKeys(input)){
  const descriptor=Object.getOwnPropertyDescriptor(input,key);
  if(typeof key!=='string'||!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))invalid(path,'expected enumerable own data properties');
  if(fields&&!fields.includes(key))invalid(path,`unsupported field ${key.slice(0,80)}`);
  result[key]=descriptor.value;
 }
 if(fields)for(const key of fields)if(!Object.hasOwn(result,key))invalid(path,`missing field ${key}`);
 return result;
}
function dense(input,path,maximum){
 if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype)invalid(path,'expected a plain array');
 const length=Object.getOwnPropertyDescriptor(input,'length')?.value;
 if(!Number.isSafeInteger(length)||length>maximum||Reflect.ownKeys(input).length!==length+1)invalid(path,`expected at most ${maximum.toLocaleString('en-US')} dense entries`);
 const result=[];
 for(let index=0;index<length;index++){
  const descriptor=Object.getOwnPropertyDescriptor(input,String(index));
  if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))invalid(path,'expected dense own data array elements');
  result.push(descriptor.value);
 }
 return result;
}
function stableId(value,path){
 if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)||reserved.has(value))invalid(path,'invalid Story ID');
 return value;
}
function label(value,path){
 if(typeof value!=='string'||!value.isWellFormed()||/[\u0000-\u001f\u007f-\u009f]/.test(value))invalid(path,'expected valid Unicode without control characters');
 const normalized=value.trim();if(!normalized||[...normalized].length>storyLimits.label)invalid(path,'expected 1–160 code points');return normalized;
}
function positive(value,path){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)invalid(path,'expected a finite positive number');return value;}
function capabilityBeat(id,input,path){
 const raw=record(input,path,['kind','seek']);
 if(raw.kind==='sustained'&&raw.seek==='none')return Object.freeze({id,kind:'sustained',seek:'none'});
 if(raw.kind==='timed'&&raw.seek==='direct')return Object.freeze({id,kind:'timed',seek:'direct'});
 invalid(path,'expected sustained/none or timed/direct capability');
}
function finishCapability(rows){
 if(rows.length<1||rows.length>storyLimits.beats)invalid('story.beats','expected 1–128 beat capabilities');
 return Object.freeze({version:1,beats:Object.freeze(rows)});
}

export function normalizeStoryCapabilityDeclaration(input){
 const raw=record(input,'story',['version','beats']);if(raw.version!==1)invalid('story.version','expected version 1');
 const beats=record(raw.beats,'story.beats'),ids=Object.keys(beats);
 return finishCapability(ids.map(id=>capabilityBeat(stableId(id,'story.beats'),beats[id],`story.beats.${id.slice(0,128)}`)));
}
export function normalizeStoryCapability(input){
 const raw=record(input,'storyCapability',['version','beats']);if(raw.version!==1)invalid('storyCapability.version','expected version 1');
 const rows=dense(raw.beats,'storyCapability.beats',storyLimits.beats),ids=new Set(),result=[];
 for(let index=0;index<rows.length;index++){
  const row=record(rows[index],`storyCapability.beats.${index}`,['id','kind','seek']),id=stableId(row.id,`storyCapability.beats.${index}.id`);
  if(ids.has(id))invalid('storyCapability.beats',`duplicate beat ID ${id}`);ids.add(id);
  result.push(capabilityBeat(id,{kind:row.kind,seek:row.seek},`storyCapability.beats.${index}`));
 }
 return finishCapability(result);
}
export function canonicalStoryCapabilityJson(input){return JSON.stringify(normalizeStoryCapability(input));}

function timing(input,path){
 const base=record(input,path);
 if(base.kind==='sustained'){
  record(base,path,['kind']);return Object.freeze({kind:'sustained'});
 }
 if(base.kind==='timed'){
  record(base,path,['kind','durationSeconds']);return Object.freeze({kind:'timed',durationSeconds:positive(base.durationSeconds,`${path}.durationSeconds`)});
 }
 invalid(path,'expected sustained or timed beat timing');
}
function follow(input,path){
 const base=record(input,path);
 if(base.kind==='manual'){
  record(base,path,['kind']);return Object.freeze({kind:'manual'});
 }
 if(base.kind==='after'){
  record(base,path,['kind','seconds']);return Object.freeze({kind:'after',seconds:positive(base.seconds,`${path}.seconds`)});
 }
 invalid(path,'expected manual or after follow policy');
}
export function normalizeSceneStory(input){
 const raw=record(input,'story',['version','beats','sequence']);if(raw.version!==1)invalid('story.version','expected version 1');
 const beatRows=dense(raw.beats,'story.beats',storyLimits.beats);if(!beatRows.length)invalid('story.beats','expected 1–128 beats');
 const beatIds=new Set(),beats=[];
 for(let index=0;index<beatRows.length;index++){
  const path=`story.beats.${index}`,row=record(beatRows[index],path,['id','label','timing']),id=stableId(row.id,`${path}.id`);
  if(beatIds.has(id))invalid('story.beats',`duplicate beat ID ${id}`);beatIds.add(id);
  beats.push(Object.freeze({id,label:label(row.label,`${path}.label`),timing:timing(row.timing,`${path}.timing`)}));
 }
 const occurrenceRows=dense(raw.sequence,'story.sequence',storyLimits.occurrences),occurrenceIds=new Set(),sequence=[];
 for(let index=0;index<occurrenceRows.length;index++){
  const path=`story.sequence.${index}`,row=record(occurrenceRows[index],path,['id','beatId','follow']),id=stableId(row.id,`${path}.id`),beatId=stableId(row.beatId,`${path}.beatId`);
  if(occurrenceIds.has(id))invalid('story.sequence',`duplicate occurrence ID ${id}`);occurrenceIds.add(id);
  if(!beatIds.has(beatId))invalid(`${path}.beatId`,`unknown beat ID ${beatId}`);
  sequence.push(Object.freeze({id,beatId,follow:follow(row.follow,`${path}.follow`)}));
 }
 return Object.freeze({version:1,beats:Object.freeze(beats),sequence:Object.freeze(sequence)});
}
export function canonicalSceneStoryJson(input){return JSON.stringify(normalizeSceneStory(input));}
export function validateStoryAgainstCapability(storyInput,capabilityInput){
 const story=normalizeSceneStory(storyInput),capability=normalizeStoryCapability(capabilityInput),supported=new Map(capability.beats.map(beat=>[beat.id,beat]));
 for(const beat of story.beats){
  const declared=supported.get(beat.id);
  if(!declared)invalid(`story.beats.${beat.id}`,'beat is absent from the compiled Story capability');
  if(declared.kind!==beat.timing.kind)invalid(`story.beats.${beat.id}.timing`,'timing kind does not match the compiled Story capability');
 }
 return story;
}
