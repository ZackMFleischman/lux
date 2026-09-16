import {createStudioAudioProvider} from './studio-audio-provider.mjs';
import type {AudioBandAnalyzer} from './audio-analysis.mjs';
import type {StudioAudioPermissionClient} from './audio-permission-client.ts';
import type {StudioAudioProvider,AudioFrameScheduler} from './studio-audio-provider.mjs';

type CaptureMediaDevices=Pick<MediaDevices,'getUserMedia'>;

export function createStudioAudioRuntime(options:Readonly<{
  permissions:StudioAudioPermissionClient;
  mediaDevices:CaptureMediaDevices;
  createContext():AudioContext;
  scheduler:AudioFrameScheduler;
  createAnalyzer?:(context:AudioContext,stream:MediaStream,config:Parameters<NonNullable<Parameters<typeof createStudioAudioProvider>[0]['createAnalyzer']>>[2])=>AudioBandAnalyzer;
}>):StudioAudioProvider{
  const provider=createStudioAudioProvider({
    scheduler:options.scheduler,
    ...(options.createAnalyzer?{createAnalyzer:options.createAnalyzer}:{}),
    async openCapture({localDeviceId}){
      const arm=await options.permissions.arm();
      let stream:MediaStream|undefined;
      try{
        stream=await options.mediaDevices.getUserMedia({audio:localDeviceId?{deviceId:{exact:localDeviceId}}:true,video:false});
        if(!await options.permissions.activate(arm.token))throw Error('Audio permission activation failed');
        const context=options.createContext();
        const revoke=()=>{void options.permissions.disconnect();};
        for(const track of stream.getTracks())track.addEventListener?.('ended',revoke,{once:true});
        context.addEventListener?.('statechange',()=>{if(context.state==='closed'||context.state==='interrupted')revoke();});
        return {stream,context};
      }catch(error){
        for(const track of stream?.getTracks()??[]){try{track.stop();}catch{}}
        await options.permissions.cancel(arm.token).catch(()=>false);
        throw error;
      }
    },
  });
  return Object.freeze({
    connect:(configuration,localDeviceId)=>provider.connect(configuration,localDeviceId),
    async disconnect(){try{await provider.disconnect();}finally{await options.permissions.disconnect();}},
    getSnapshot:provider.getSnapshot,
    subscribe:provider.subscribe,
    async dispose(){try{await provider.dispose();}finally{await options.permissions.disconnect();}},
  });
}
