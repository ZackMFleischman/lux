const freeze=Object.freeze,keys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf,finite=Number.isFinite;
const objectPrototype=Object.prototype,hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty),RuntimeError=Error;
export const TEMPO_BPM_MIN=20,TEMPO_BPM_MAX=300;
export const DEFAULT_TEMPO_SETTINGS=freeze({bpm:120});
export function normalizeTempoSettings(input=DEFAULT_TEMPO_SETTINGS){
 if(!input||typeof input!=='object'||Array.isArray(input)||(prototype(input)!==objectPrototype&&prototype(input)!==null)||keys(input).length!==1)throw new RuntimeError('Invalid scene tempo');
 const bpmDescriptor=descriptor(input,'bpm');if(!bpmDescriptor?.enumerable||!hasOwn(bpmDescriptor,'value'))throw new RuntimeError('Invalid scene tempo');
 const bpm=bpmDescriptor.value;if(!finite(bpm)||bpm<TEMPO_BPM_MIN||bpm>TEMPO_BPM_MAX)throw new RuntimeError('Scene tempo is outside its supported range');
 return freeze({bpm:bpm===0?0:bpm});
}
