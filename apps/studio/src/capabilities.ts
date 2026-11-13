import { parameterLimits } from '../../../packages/runtime-contracts/src/parameters.mjs';
// Emitted by the running app, independently of an adapter's installed checkout.
export const studioCapabilities = Object.freeze({ protocolVersion: 4,
  supportedSdkVersions: Object.freeze(['0.1.0', '0.2.0', '0.4.0']),
  codeDeclaredParameters: true, parameterKinds: Object.freeze(['number','boolean','enum']), maxParameterMetadataBytes: parameterLimits.metadataBytes,
  audioSpectrum: Object.freeze({frameField:'audioSpectrum',bins:128,scale:'log',fftSize:2048,readOnly:true}),
  audioInputControl: Object.freeze({enumerate:true,connect:true,disconnect:true}),
  controlAnimation: Object.freeze({guardedBindings:true,kinds:Object.freeze(['lfo','audio','kick','tempo','variation'])}),
  controlTriggers: Object.freeze({commandReceipts:true,pausedFrame:true,maxCommandIds:16384}),
  story: Object.freeze({version:1,rootSdkVersion:'0.2.0',sustained:true,timedDirectSeek:true,commandReceipts:true}),
  imageFormats: Object.freeze(['image/bmp', 'image/png', 'image/jpeg']), assetExport: true,
  sceneVersions: Object.freeze([1, 2, 3, 4,5,6]),controlVariation:Object.freeze({stableInstanceKeys:true,distributions:Object.freeze(['random','centered','spread'])}),tempo:Object.freeze({manual:true,tap:true,bpm:Object.freeze({min:20,max:300})}),
});

export function supportsStoryCapability(value:unknown):boolean{
  const story=(value as {story?:{version?:unknown;rootSdkVersion?:unknown;sustained?:unknown;timedDirectSeek?:unknown;commandReceipts?:unknown}}|null)?.story;
  return story?.version===1&&story.rootSdkVersion==='0.2.0'&&story.sustained===true&&story.timedDirectSeek===true&&story.commandReceipts===true;
}

export function supportsControlTriggersCapability(value:unknown):boolean{
  const capability=(value as {controlTriggers?:{commandReceipts?:unknown;pausedFrame?:unknown;maxCommandIds?:unknown}}|null)?.controlTriggers;
  return capability?.commandReceipts===true&&capability.pausedFrame===true&&capability.maxCommandIds===16384;
}

export function supportsManualTapTempoCapability(value:unknown):boolean{
  const capabilities=value as {protocolVersion?:unknown;tempo?:{manual?:unknown;tap?:unknown;bpm?:{min?:unknown;max?:unknown}}}|null;
  return Number.isSafeInteger(capabilities?.protocolVersion)&&Number(capabilities?.protocolVersion)>=3&&capabilities?.tempo?.manual===true&&capabilities.tempo.tap===true&&
    Number.isFinite(capabilities.tempo.bpm?.min)&&capabilities.tempo.bpm?.min===20&&Number.isFinite(capabilities.tempo.bpm?.max)&&capabilities.tempo.bpm?.max===300;
}
