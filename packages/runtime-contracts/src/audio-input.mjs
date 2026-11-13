const freeze=Object.freeze,keys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf;
const objectPrototype=Object.prototype,finite=Number.isFinite,safe=Number.isSafeInteger;
const arrayIsArray=Array.isArray,ArrayCtor=Array;
export const audioSpectrumBins=128;
const zeroMagnitudes=freeze(ArrayCtor(audioSpectrumBins).fill(0));
const bands=new Set(['level','bass','mids','highs']);
function invalid(message){throw new Error(message);}
function plain(input,fields,message){
 if(!input||typeof input!=='object'||Array.isArray(input)||(prototype(input)!==objectPrototype&&prototype(input)!==null)||keys(input).length!==fields.length)invalid(message);
 const result=Object.create(null);for(const field of fields){const value=descriptor(input,field);if(!value?.enumerable||!Object.hasOwn(value,'value'))invalid(message);result[field]=value.value;}return result;
}
export function normalizeAudioAnalyzerConfig(input){
 const raw=plain(input,['version','fftSize','minDecibels','maxDecibels'],'Invalid audio analyzer configuration'),{version,fftSize,minDecibels,maxDecibels}=raw;
 if(version!==1||fftSize!==2048||!finite(minDecibels)||!finite(maxDecibels)||minDecibels< -120||minDecibels> -40||maxDecibels< -80||maxDecibels>0||maxDecibels-minDecibels<10)invalid('Invalid audio analyzer configuration');
 return freeze({version:1,fftSize:2048,minDecibels:minDecibels===0?0:minDecibels,maxDecibels:maxDecibels===0?0:maxDecibels});
}
export function normalizeAudioInputConfiguration(input){
 const raw=plain(input,['logicalInputId','analyzer'],'Invalid audio input configuration');if(raw.logicalInputId!=='primary-audio')invalid('Invalid logical audio input');
 return freeze({logicalInputId:'primary-audio',analyzer:normalizeAudioAnalyzerConfig(raw.analyzer)});
}
export function normalizeAudioBandSource(input){
 const raw=plain(input,['kind','logicalInputId','band','analyzer'],'Invalid audio band source');if(raw.kind!=='audio-band')invalid('Invalid audio band source');
 if(raw.logicalInputId!=='primary-audio')invalid('Invalid logical audio input');if(!bands.has(raw.band))invalid('Invalid audio band');
 const configuration=normalizeAudioInputConfiguration({logicalInputId:raw.logicalInputId,analyzer:raw.analyzer});
 return freeze({kind:'audio-band',logicalInputId:configuration.logicalInputId,band:raw.band,analyzer:configuration.analyzer});
}
export function normalizeAudioKickSource(input){
 const raw=plain(input,['kind','logicalInputId','analyzer'],'Invalid audio kick source');if(raw.kind!=='audio-kick')invalid('Invalid audio kick source');
 if(raw.logicalInputId!=='primary-audio')invalid('Invalid logical audio input');
 const configuration=normalizeAudioInputConfiguration({logicalInputId:raw.logicalInputId,analyzer:raw.analyzer});
 return freeze({kind:'audio-kick',logicalInputId:configuration.logicalInputId,analyzer:configuration.analyzer});
}
export function normalizeAudioBandSnapshot(input){
 const hasSpectrum=input&&typeof input==='object'&&Object.hasOwn(input,'spectrum');
 const raw=plain(input,['generation','sequence','available','level','bass','mids','highs','kickSequence','kickStrength',...(hasSpectrum?['spectrum']:[])],'Invalid audio band snapshot');
 if(!safe(raw.generation)||raw.generation<0||!safe(raw.sequence)||raw.sequence<0||!safe(raw.kickSequence)||raw.kickSequence<0||typeof raw.available!=='boolean')invalid('Invalid audio band snapshot');
 const result={generation:raw.generation,sequence:raw.sequence,available:raw.available};
 for(const band of bands){const value=raw[band];if(!finite(value)||value<0||value>1||(!raw.available&&value!==0))invalid('Invalid audio band snapshot');result[band]=value===0?0:value;}
 if(!finite(raw.kickStrength)||raw.kickStrength<0||raw.kickStrength>1||(!raw.available&&(raw.kickSequence!==0||raw.kickStrength!==0))||(raw.kickSequence===0&&raw.kickStrength!==0))invalid('Invalid audio band snapshot');
 if(hasSpectrum)result.spectrum=normalizeAudioSpectrum(raw.spectrum,raw.available);
 result.kickSequence=raw.kickSequence;result.kickStrength=raw.kickStrength===0?0:raw.kickStrength;
 return freeze(result);
}

export function normalizeAudioSpectrum(input,available=true){
 const raw=plain(input,['sampleRate','fftSize','scale','minFrequency','maxFrequency','magnitudes'],'Invalid audio spectrum');
 if(!finite(raw.sampleRate)||raw.sampleRate<8000||raw.sampleRate>384000||raw.fftSize!==2048||raw.scale!=='log'||raw.minFrequency!==20||raw.maxFrequency!==raw.sampleRate/2||!arrayIsArray(raw.magnitudes)||raw.magnitudes.length!==audioSpectrumBins)invalid('Invalid audio spectrum');
 const magnitudes=[];for(let index=0;index<audioSpectrumBins;index++){const property=descriptor(raw.magnitudes,String(index));if(!property||!Object.hasOwn(property,'value')||!finite(property.value)||property.value<0||property.value>1||(!available&&property.value!==0))invalid('Invalid audio spectrum');magnitudes[index]=property.value===0?0:property.value;}
 return freeze({sampleRate:raw.sampleRate,fftSize:2048,scale:'log',minFrequency:20,maxFrequency:raw.maxFrequency,magnitudes:freeze(magnitudes)});
}
export function createAudioSpectrumFrameState(){
 const zero=(generation=0,sequence=0)=>freeze({available:false,generation,sequence,sampleRate:0,fftSize:2048,scale:'log',minFrequency:20,maxFrequency:0,magnitudes:zeroMagnitudes});
 let generation=-1,sequence=-1,latest=zero(),displayed=latest,sampled=false,resetPending=false;
 return freeze({
  apply(input){const snapshot=normalizeAudioBandSnapshot(input);if(snapshot.generation<generation||(snapshot.generation===generation&&snapshot.sequence<=sequence))return false;generation=snapshot.generation;sequence=snapshot.sequence;latest=snapshot.available&&snapshot.spectrum?freeze({available:true,generation,sequence,...snapshot.spectrum}):zero(generation,sequence);return true;},
  frame(playing){if(resetPending){resetPending=false;return displayed;}if(playing||!sampled||!latest.available)displayed=latest;sampled=true;return displayed;},
  reset(){displayed=zero(generation,sequence);sampled=true;resetPending=true;},
 });
}
