import {createStudioAudioProvider} from './studio-audio-provider.mjs';
import type {AudioBandAnalyzer} from './audio-analysis.mjs';
import type {StudioAudioPermissionClient} from './audio-permission-client.ts';
import type {StudioAudioProvider,AudioFrameScheduler} from './studio-audio-provider.mjs';

type CaptureMediaDevices=Pick<MediaDevices,'getUserMedia'|'enumerateDevices'|'addEventListener'|'removeEventListener'>;
export type LocalAudioInput=Readonly<{id:string;label:string}>;
export type StudioAudioRuntime=StudioAudioProvider&Readonly<{
  listInputs():Promise<readonly LocalAudioInput[]>;
  subscribeDevices(listener:()=>void):()=>void;
  getMonitoring():boolean;
  setMonitoring(enabled:boolean):Promise<boolean>;
}>;

export function createStudioAudioRuntime(options:Readonly<{
  permissions:StudioAudioPermissionClient;
  mediaDevices:CaptureMediaDevices;
  createContext():AudioContext;
  scheduler:AudioFrameScheduler;
  createAnalyzer?:(context:AudioContext,stream:MediaStream,config:Parameters<NonNullable<Parameters<typeof createStudioAudioProvider>[0]['createAnalyzer']>>[2])=>AudioBandAnalyzer;
}>):StudioAudioRuntime{
  let capturesPending=0;
  let capture:Readonly<{stream:MediaStream;context:AudioContext}>|undefined;
  let monitor:MediaStreamAudioSourceNode|undefined;
  let monitoring=false;
  const listeners=new Set<()=>void>();
  const notify=()=>{for(const listener of listeners)listener();};
  const stopMonitoring=()=>{try{monitor?.disconnect();}catch{}monitor=undefined;monitoring=false;};
  const provider=createStudioAudioProvider({
    scheduler:options.scheduler,
    ...(options.createAnalyzer?{createAnalyzer:options.createAnalyzer}:{}),
    async openCapture({localDeviceId}){
      const arm=await options.permissions.arm();
      let stream:MediaStream|undefined;
      let context:AudioContext|undefined;
      try{
        stream=await options.mediaDevices.getUserMedia({audio:localDeviceId?{deviceId:{exact:localDeviceId}}:true,video:false});
        if(!await options.permissions.activate(arm.token))throw Error('Audio permission activation failed');
        const ownedContext=options.createContext();
        context=ownedContext;
        if(ownedContext.state!=='running')await ownedContext.resume();
        if(ownedContext.state!=='running')throw Error('Audio context did not enter the running state');
        const revoke=()=>{void options.permissions.disconnect();};
        for(const track of stream.getTracks())track.addEventListener?.('ended',revoke,{once:true});
        ownedContext.addEventListener?.('statechange',()=>{if(ownedContext.state==='closed'||ownedContext.state==='interrupted')revoke();});
        capture={stream,context:ownedContext};
        return capture;
      }catch(error){
        for(const track of stream?.getTracks()??[]){try{track.stop();}catch{}}
        try{if(context?.state!=='closed')await context?.close();}catch{}
        await options.permissions.cancel(arm.token).catch(()=>false);
        throw error;
      }
    },
  });
  provider.subscribe(()=>{
    if(!provider.getSnapshot().available){stopMonitoring();capture=undefined;}
    notify();
  });
  return Object.freeze({
    async listInputs(){
      const arm=provider.getSnapshot().available||capturesPending>0?undefined:await options.permissions.discover();
      try{
        const rows=await options.mediaDevices.enumerateDevices();
        let index=0;
        return Object.freeze(rows.filter(row=>row.kind==='audioinput'&&row.deviceId).map(row=>{
          index++;
          return Object.freeze({id:row.deviceId,label:row.label||`Audio input ${index}`});
        }));
      }finally{if(arm)await options.permissions.cancel(arm.token);}
    },
    subscribeDevices(listener){
      const changed=()=>listener();
      options.mediaDevices.addEventListener('devicechange',changed);
      return()=>options.mediaDevices.removeEventListener('devicechange',changed);
    },
    async connect(configuration,localDeviceId){capturesPending++;try{await provider.connect(configuration,localDeviceId);}finally{capturesPending--;}},
    async disconnect(){stopMonitoring();capture=undefined;try{await provider.disconnect();}finally{await options.permissions.disconnect();}},
    getSnapshot:provider.getSnapshot,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    getMonitoring:()=>monitoring,
    async setMonitoring(enabled){
      if(!enabled){stopMonitoring();notify();return false;}
      const active=capture;
      if(!active||!provider.getSnapshot().available)throw Error('Audio input is not connected');
      try{stopMonitoring();monitor=active.context.createMediaStreamSource(active.stream);monitor.connect(active.context.destination);monitoring=true;notify();return true;}
      catch(error){stopMonitoring();notify();throw error;}
    },
    async dispose(){stopMonitoring();capture=undefined;try{await provider.dispose();}finally{await options.permissions.disconnect();}},
  });
}
