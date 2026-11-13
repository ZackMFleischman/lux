import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchAudioCommand} from '../../apps/studio/src/audio/agent-audio.ts';

const configuration={logicalInputId:'primary-audio',analyzer:{version:1,fftSize:2048,minDecibels:-100,maxDecibels:-30}};
test('audio commands connect only an exact currently enumerated device through the existing provider',async()=>{
  let connected=false;const writes:any[]=[];
  const provider:any={listInputs:async()=>[{id:'cable',label:'CABLE Output'}],getSnapshot:()=>({available:connected}),connect:async(config:any,id:string)=>{writes.push({config,id});connected=true;},disconnect:async()=>{connected=false;}};
  assert.deepEqual(await dispatchAudioCommand(provider,'audio.inputs',{}),{inputs:[{id:'cable',label:'CABLE Output'}]});
  await assert.rejects(dispatchAudioCommand(provider,'audio.connect',{localDeviceId:'gone',configuration}),/unavailable/);assert.deepEqual(writes,[]);
  await assert.rejects(dispatchAudioCommand(provider,'audio.connect',{localDeviceId:'cable',configuration,unexpected:true}));assert.deepEqual(writes,[]);
  assert.deepEqual(await dispatchAudioCommand(provider,'audio.connect',{localDeviceId:'cable',configuration}),{available:true});
  assert.deepEqual(writes,[{config:configuration,id:'cable'}]);
  assert.deepEqual(await dispatchAudioCommand(provider,'audio.disconnect',{}),{available:false});
});
