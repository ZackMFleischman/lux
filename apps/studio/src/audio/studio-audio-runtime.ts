import {createTestRhythm,testRhythmInput} from './test-rhythm.ts';
import {createStudioAudioProvider} from './studio-audio-provider.mjs';
import type {AudioBandAnalyzer} from './audio-analysis.mjs';
import type {StudioAudioPermissionClient} from './audio-permission-client.ts';
import type {StudioAudioProvider,AudioFrameScheduler} from './studio-audio-provider.mjs';

type CaptureMediaDevices=Pick<MediaDevices,'getUserMedia'|'enumerateDevices'|'addEventListener'|'removeEventListener'>;
export type LocalAudioInput=Readonly<{id:string;label:string}>;
export type StudioAudioRuntime=StudioAudioProvider&Readonly<{
  listInputs():Promise<readonly LocalAudioInput[]>;
  subscribeDevices(listener:()=>void):()=>void;
  getConnectedInputId():string|undefined;
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
  const pendingGenerated=new Map<AudioContext,number>(),closingGenerated=new WeakMap<AudioContext,Promise<void>>();
  const closeGenerated=(context:AudioContext)=>{
    let closing=closingGenerated.get(context);
    if(!closing){closing=(async()=>{try{if(context.state!=='closed')await context.close();}catch{}})();closingGenerated.set(context,closing);}
    return closing;
  };
  const closeGeneratedBefore=(token:number)=>Promise.all([...pendingGenerated].filter(([,owner])=>owner<token).map(([context])=>closeGenerated(context)));
  let capture:Readonly<{stream:MediaStream;context:AudioContext;physical:boolean}>|undefined;
  let monitor:MediaStreamAudioSourceNode|undefined;
  let monitoring=false;
  let connection=0,connectedInputId:string|undefined;
  const listeners=new Set<()=>void>();
  const notify=()=>{for(const listener of listeners)listener();};
  const stopMonitoring=()=>{try{monitor?.disconnect();}catch{}monitor=undefined;monitoring=false;};
  const provider=createStudioAudioProvider({
    scheduler:options.scheduler,
    ...(options.createAnalyzer?{createAnalyzer:options.createAnalyzer}:{}),
    async openCapture({localDeviceId}){
      const token=connection;
      if(localDeviceId===testRhythmInput.id){
        const context=options.createContext();
        pendingGenerated.set(context,token);
        try{
          if(context.state!=='running')await context.resume();
          if(token!==connection)throw Error('Audio input connection cancelled');
          if(context.state!=='running')throw Error('Audio context did not enter the running state');
          const generated={...createTestRhythm(context),physical:false};
          if(token===connection)capture=generated;
          return generated;
        }catch(error){await closeGenerated(context);throw error;}
        finally{pendingGenerated.delete(context);}
      }
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
        let revoked=false;
        const revoke=()=>{if(revoked)return;revoked=true;void options.permissions.cancel(arm.token).catch(()=>false);};
        for(const track of stream.getTracks())track.addEventListener?.('ended',revoke,{once:true});
        ownedContext.addEventListener?.('statechange',()=>{if(ownedContext.state==='closed'||ownedContext.state==='interrupted')revoke();});
        const acquired={stream,context:ownedContext,physical:true,dispose:revoke};
        if(token===connection)capture=acquired;
        return acquired;
      }catch(error){
        for(const track of stream?.getTracks()??[]){try{track.stop();}catch{}}
        try{if(context?.state!=='closed')await context?.close();}catch{}
        await options.permissions.cancel(arm.token).catch(()=>false);
        throw error;
      }
    },
  });
  provider.subscribe(()=>{
    if(!provider.getSnapshot().available){stopMonitoring();capture=undefined;connectedInputId=undefined;}
    notify();
  });
  return Object.freeze({
    async listInputs(){
      let arm:Awaited<ReturnType<StudioAudioPermissionClient['discover']>>|undefined;
      try{
        if(!capture?.physical&&capturesPending===0)arm=await options.permissions.discover();
        const rows=await options.mediaDevices.enumerateDevices();
        let index=0;
        return Object.freeze([testRhythmInput,...rows.filter(row=>row.kind==='audioinput'&&row.deviceId).map(row=>{
          index++;
          return Object.freeze({id:row.deviceId,label:row.label||`Audio input ${index}`});
        })]);
      }catch{return Object.freeze([testRhythmInput]);}
      finally{if(arm)await options.permissions.cancel(arm.token).catch(()=>false);}
    },
    subscribeDevices(listener){
      const changed=()=>listener();
      options.mediaDevices.addEventListener('devicechange',changed);
      return()=>options.mediaDevices.removeEventListener('devicechange',changed);
    },
    async connect(configuration,localDeviceId){const token=++connection,closing=closeGeneratedBefore(token),physical=localDeviceId!==testRhythmInput.id;if(physical)capturesPending++;try{await provider.connect(configuration,localDeviceId);if(token===connection&&provider.getSnapshot().available){connectedInputId=localDeviceId;notify();}}finally{await closing;if(physical)capturesPending--;}},
    async disconnect(){const token=++connection,closing=closeGeneratedBefore(token);connectedInputId=undefined;stopMonitoring();capture=undefined;try{await provider.disconnect();}finally{await closing;if(token===connection)await options.permissions.disconnect();}},
    getSnapshot:provider.getSnapshot,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    getConnectedInputId:()=>connectedInputId,
    getMonitoring:()=>monitoring,
    async setMonitoring(enabled){
      if(!enabled){stopMonitoring();notify();return false;}
      const active=capture;
      if(!active||!provider.getSnapshot().available)throw Error('Audio input is not connected');
      try{stopMonitoring();monitor=active.context.createMediaStreamSource(active.stream);monitor.connect(active.context.destination);monitoring=true;notify();return true;}
      catch(error){stopMonitoring();notify();throw error;}
    },
    async dispose(){const token=++connection,closing=closeGeneratedBefore(token);stopMonitoring();capture=undefined;try{await provider.dispose();}finally{await closing;if(token===connection)await options.permissions.disconnect();}},
  });
}
