import {z} from 'zod';
import {audioAnalyzerSchema} from '../runtime-operations.ts';
import type {StudioAudioRuntime} from './studio-audio-runtime.ts';

export const audioInputsInputSchema=z.object({}).strict();
export const audioConnectInputSchema=z.object({localDeviceId:z.string().min(1).max(4096),configuration:z.object({logicalInputId:z.literal('primary-audio'),analyzer:audioAnalyzerSchema}).strict()}).strict();
export async function dispatchAudioCommand(provider:StudioAudioRuntime,method:string,input:unknown){
  if(method==='audio.inputs'){audioInputsInputSchema.parse(input);return {inputs:await provider.listInputs()};}
  if(method==='audio.disconnect'){audioInputsInputSchema.parse(input);await provider.disconnect();return provider.getSnapshot();}
  if(method!=='audio.connect')throw Error('Unsupported audio command');
  const request=audioConnectInputSchema.parse(input),inputs=await provider.listInputs();
  if(!inputs.some(row=>row.id===request.localDeviceId))throw Error('Audio input is unavailable; list inputs and choose a current device');
  await provider.connect(request.configuration,request.localDeviceId);
  return provider.getSnapshot();
}
