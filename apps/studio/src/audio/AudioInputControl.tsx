import {Button,MenuItem,Select} from '@mui/material';
import {useEffect,useRef,useState} from 'react';
import type {StudioAudioProvider} from './studio-audio-provider.mjs';
import type {AudioInputConfiguration} from './audio-contract.mjs';

const defaultConfiguration:AudioInputConfiguration=Object.freeze({logicalInputId:'primary-audio',analyzer:Object.freeze({version:1,fftSize:2048,minDecibels:-100,maxDecibels:-30})});
const devicePreference='lux.audio.primary-device';
type DeviceChoice=Readonly<{id:string;label:string}>;

export function AudioInputControl({provider,onError,configuration=defaultConfiguration}:{provider:StudioAudioProvider;onError(reason:string):void;configuration?:AudioInputConfiguration}){
  const [phase,setPhase]=useState<'disconnected'|'connecting'|'connected'|'unavailable'>('disconnected');
  const [devices,setDevices]=useState<readonly DeviceChoice[]>([]);
  const [device,setDevice]=useState(()=>{try{return localStorage.getItem(devicePreference)??'';}catch{return '';}});
  const configurationKey=JSON.stringify(configuration),priorConfiguration=useRef(configurationKey);
  useEffect(()=>provider.subscribe(()=>{const snapshot=provider.getSnapshot();setPhase(current=>snapshot.available?(current==='connecting'?'connected':current):(current==='connected'?'unavailable':current));}),[provider]);
  useEffect(()=>()=>{void provider.dispose();},[provider]);
  useEffect(()=>{if(priorConfiguration.current===configurationKey)return;priorConfiguration.current=configurationKey;if(phase==='connected'){void provider.disconnect().then(()=>setPhase('disconnected')).catch(error=>{setPhase('unavailable');onError(String(error));});}},[configurationKey,phase,provider,onError]);
  async function refreshDevices(){
    const rows=await navigator.mediaDevices.enumerateDevices();
    const inputs=rows.filter(row=>row.kind==='audioinput').map((row,index)=>({id:row.deviceId,label:row.label||`Audio input ${index+1}`}));
    setDevices(inputs);
    if(device&&!inputs.some(row=>row.id===device)){setDevice('');try{localStorage.removeItem(devicePreference);}catch{}}
  }
  async function connect(){
    setPhase('connecting');onError('');
    try{await provider.connect(configuration,device||undefined);setPhase('connected');try{await refreshDevices();}catch(error){onError(`Audio connected, but input names are unavailable. ${String(error)}`);}}
    catch(error){setPhase('unavailable');onError(String(error));}
  }
  async function disconnect(){
    onError('');
    try{await provider.disconnect();setPhase('disconnected');}
    catch(error){setPhase('unavailable');onError(String(error));}
  }
  const label=phase==='connecting'?'Connecting…':phase==='connected'?'Connected':phase==='unavailable'?'Unavailable':'Disconnected';
  return <span className="audio-input-control" aria-label={`Audio input ${label}`}>
    <span className="document-label">Audio</span>
    <Select size="small" value={device} disabled={phase==='connecting'} aria-label="Audio input device" displayEmpty onChange={event=>{const next=String(event.target.value);setDevice(next);try{if(next)localStorage.setItem(devicePreference,next);else localStorage.removeItem(devicePreference);}catch{}}}>
      <MenuItem value="">Default input</MenuItem>{devices.map(row=><MenuItem key={row.id} value={row.id}>{row.label}</MenuItem>)}
    </Select>
    <span className={`audio-input-status ${phase}`}>{label}</span>
    {phase==='connected'?<Button size="small" color="inherit" onClick={()=>void disconnect()}>Disconnect</Button>:<Button size="small" color="inherit" disabled={phase==='connecting'} onClick={()=>void connect()}>{devices.length?'Connect':'Connect audio'}</Button>}
  </span>;
}
