const freeze=Object.freeze,keys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf;
const objectPrototype=Object.prototype,finite=Number.isFinite,safe=Number.isSafeInteger;
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
export function normalizeAudioBandSnapshot(input){
 const raw=plain(input,['generation','sequence','available','level','bass','mids','highs'],'Invalid audio band snapshot');
 if(!safe(raw.generation)||raw.generation<0||!safe(raw.sequence)||raw.sequence<0||typeof raw.available!=='boolean')invalid('Invalid audio band snapshot');
 const result={generation:raw.generation,sequence:raw.sequence,available:raw.available};
 for(const band of bands){const value=raw[band];if(!finite(value)||value<0||value>1||(!raw.available&&value!==0))invalid('Invalid audio band snapshot');result[band]=value===0?0:value;}
 return freeze(result);
}

