import {Button,MenuItem,Select} from '@mui/material';
import {useEffect,useRef,useState} from 'react';
import type {StudioAudioRuntime} from './studio-audio-runtime.ts';
import type {AudioInputConfiguration} from './audio-contract.mjs';

const defaultConfiguration:AudioInputConfiguration=Object.freeze({logicalInputId:'primary-audio',analyzer:Object.freeze({version:1,fftSize:2048,minDecibels:-100,maxDecibels:-30})});
const devicePreference='lux.audio.primary-device';
type DeviceChoice=Readonly<{id:string;label:string}>;

export function AudioInputControl({provider,onError,configuration=defaultConfiguration}:{provider:StudioAudioRuntime;onError(reason:string):void;configuration?:AudioInputConfiguration}){
  const [phase,setPhase]=useState<'disconnected'|'connecting'|'connected'|'unavailable'>('disconnected');
  const [devices,setDevices]=useState<readonly DeviceChoice[]>([]);
  const [device,setDevice]=useState(()=>{try{return localStorage.getItem(devicePreference)??'';}catch{return '';}});
  const configurationKey=JSON.stringify(configuration),priorConfiguration=useRef(configurationKey),currentConfiguration=useRef(configurationKey),operation=useRef(0),currentDevice=useRef(device);
  currentConfiguration.current=configurationKey;
  currentDevice.current=device;
  useEffect(()=>provider.subscribe(()=>{const snapshot=provider.getSnapshot();setPhase(current=>snapshot.available?(current==='connecting'?'connected':current):(current==='connected'?'unavailable':current));}),[provider]);
  useEffect(()=>()=>{operation.current++;void provider.dispose();},[provider]);
  useEffect(()=>{
    let disposed=false,refreshId=0;
    const refresh=async()=>{const id=++refreshId;try{const inputs=await provider.listInputs();if(disposed||id!==refreshId)return;setDevices(inputs);
      if(currentDevice.current&&!inputs.some(row=>row.id===currentDevice.current))onError('Previously selected audio input is unavailable. Choose another input.');
    }catch(error){if(!disposed&&id===refreshId)onError(`Audio inputs are unavailable. ${String(error)}`);}};
    const unsubscribe=provider.subscribeDevices(()=>{void refresh();});void refresh();
    return()=>{disposed=true;refreshId++;unsubscribe();};
  },[provider,onError]);
  useEffect(()=>{if(priorConfiguration.current===configurationKey)return;priorConfiguration.current=configurationKey;const token=++operation.current;
    void provider.disconnect().then(()=>{if(token===operation.current)setPhase('disconnected');}).catch(error=>{if(token===operation.current){setPhase('unavailable');onError(String(error));}});
  },[configurationKey,provider,onError]);
  async function connect(){
    const token=++operation.current,key=configurationKey;
    if(device&&!devices.some(row=>row.id===device)){setPhase('unavailable');onError('Previously selected audio input is unavailable. Choose another input.');return;}
    setPhase('connecting');onError('');
    try{await provider.connect(configuration,device||undefined);if(token!==operation.current||key!==currentConfiguration.current)return;setPhase('connected');}
    catch(error){if(token===operation.current){setPhase('unavailable');onError(String(error));}}
  }
  async function disconnect(){
    const token=++operation.current;
    onError('');
    try{await provider.disconnect();if(token===operation.current)setPhase('disconnected');}
    catch(error){if(token===operation.current){setPhase('unavailable');onError(String(error));}}
  }
  const label=phase==='connecting'?'Connecting…':phase==='connected'?'Connected':phase==='unavailable'?'Unavailable':'Disconnected';
  return <span className="audio-input-control" aria-label={`Audio input ${label}`}>
    <span className="document-label">Audio</span>
    <Select size="small" value={device} disabled={phase==='connecting'||phase==='connected'} aria-label="Audio input device" displayEmpty onChange={event=>{const next=String(event.target.value);setDevice(next);setPhase(current=>current==='unavailable'?'disconnected':current);onError('');try{if(next)localStorage.setItem(devicePreference,next);else localStorage.removeItem(devicePreference);}catch{}}}>
      <MenuItem value="">Default input</MenuItem>{device&&!devices.some(row=>row.id===device)?<MenuItem value={device} disabled>Previously selected input (unavailable)</MenuItem>:null}{devices.map(row=><MenuItem key={row.id} value={row.id}>{row.label}</MenuItem>)}
    </Select>
    <span className={`audio-input-status ${phase}`} role="status" aria-live="polite" aria-label="Audio input status">{label}</span>
    {phase==='connected'?<Button size="small" color="inherit" onClick={()=>void disconnect()}>Disconnect</Button>:<Button size="small" color="inherit" disabled={phase==='connecting'} onClick={()=>void connect()}>{devices.length?'Connect':'Connect audio'}</Button>}
  </span>;
}
