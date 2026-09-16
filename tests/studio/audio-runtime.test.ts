import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioAudioRuntime} from '../../apps/studio/src/audio/studio-audio-runtime.ts';

const configuration={logicalInputId:'primary-audio' as const,analyzer:{version:1 as const,fftSize:2048 as const,minDecibels:-100,maxDecibels:-30}};

test('audio runtime arms one request, activates its token, and revokes on disconnect',async()=>{
  const calls:string[]=[];
  const track={stop(){calls.push('stop');},addEventListener(){},removeEventListener(){}};
  const stream={getTracks:()=>[track]} as any;
  const context={state:'suspended',resume:async()=>{calls.push('resume');context.state='running';},close:async()=>{calls.push('close');},addEventListener(){},removeEventListener(){}} as any;
  const runtime=createStudioAudioRuntime({
    permissions:{arm:async()=>{calls.push('arm');return {token:'token-token-token-1',expiresAtMs:1};},activate:async token=>{calls.push(`activate:${token}`);return true;},cancel:async()=>false,disconnect:async()=>{calls.push('revoke');return true;}},
    mediaDevices:{getUserMedia:async (constraints:any)=>{calls.push(`capture:${JSON.stringify(constraints)}`);return stream;}} as any,
    createContext:()=>context,
    createAnalyzer:()=>({sample:()=>({level:0,bass:0,mids:0,highs:0,kickStrength:0}),dispose(){}}),
    scheduler:{request:()=>1,cancel(){}},
  });
  await runtime.connect(configuration,'device-local');
  assert.deepEqual(calls.slice(0,4),['arm','capture:{"audio":{"deviceId":{"exact":"device-local"}},"video":false}','activate:token-token-token-1','resume']);
  await runtime.disconnect();
  assert.deepEqual(calls.slice(4),['stop','close','revoke']);
});

test('failed permission activation stops the acquired stream and cancels the exact arm',async()=>{
  const calls:string[]=[];
  const stream={getTracks:()=>[{stop(){calls.push('stop');}}]} as any;
  const runtime=createStudioAudioRuntime({
    permissions:{arm:async()=>({token:'token-token-token-2',expiresAtMs:1}),activate:async()=>false,cancel:async token=>{calls.push(`cancel:${token}`);return true;},disconnect:async()=>false},
    mediaDevices:{getUserMedia:async()=>stream} as any,createContext:()=>{throw Error('must not create');},
    createAnalyzer:()=>({sample:()=>({level:0,bass:0,mids:0,highs:0,kickStrength:0}),dispose(){}}),scheduler:{request:()=>1,cancel(){}},
  });
  await assert.rejects(runtime.connect(configuration),/activation failed/);
  assert.deepEqual(calls,['stop','cancel:token-token-token-2']);
});

test('audio runtime fails closed when its context cannot enter running state',async()=>{
  const calls:string[]=[];
  const stream={getTracks:()=>[{stop(){calls.push('stop');}}]} as any;
  const context={state:'suspended',resume:async()=>{calls.push('resume');},close:async()=>{calls.push('close');}} as any;
  const runtime=createStudioAudioRuntime({
    permissions:{arm:async()=>({token:'token-token-token-3',expiresAtMs:1}),activate:async()=>true,cancel:async token=>{calls.push(`cancel:${token}`);return true;},disconnect:async()=>false},
    mediaDevices:{getUserMedia:async()=>stream} as any,createContext:()=>context,
    createAnalyzer:()=>{throw Error('must not analyze');},scheduler:{request:()=>1,cancel(){}},
  });
  await assert.rejects(runtime.connect(configuration),/running/);
  assert.deepEqual(calls,['resume','stop','close','cancel:token-token-token-3']);
});
