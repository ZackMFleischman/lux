import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioAudioRuntime} from '../../apps/studio/src/audio/studio-audio-runtime.ts';

const configuration={logicalInputId:'primary-audio' as const,analyzer:{version:1 as const,fftSize:2048 as const,minDecibels:-100,maxDecibels:-30}};

test('audio runtime discovers only input devices and always closes its discovery arm',async()=>{
  const calls:string[]=[];
  const runtime=createStudioAudioRuntime({
    permissions:{discover:async()=>{calls.push('discover');return {token:'discovery-token-01',expiresAtMs:1};},arm:async()=>{throw Error('must not capture');},activate:async()=>false,
      cancel:async token=>{calls.push(`cancel:${token}`);return true;},disconnect:async()=>false},
    mediaDevices:{
      getUserMedia:async()=>{throw Error('must not capture');},
      enumerateDevices:async()=>[
        {kind:'audioinput',deviceId:'cable',label:'CABLE Output (VB-Audio Virtual Cable)',groupId:'virtual'},
        {kind:'videoinput',deviceId:'camera',label:'Camera',groupId:'camera'},
      ],
      addEventListener(){},removeEventListener(){},
    } as any,
    createContext:()=>{throw Error('must not create');},scheduler:{request:()=>1,cancel(){}},
  });

  assert.deepEqual(await runtime.listInputs(),[{id:'cable',label:'CABLE Output (VB-Audio Virtual Cable)'}]);
  assert.deepEqual(calls,['discover','cancel:discovery-token-01']);
});

test('audio runtime reports device changes and removes its listener',()=>{
  const calls:string[]=[];let listener:(()=>void)|undefined;
  const runtime=createStudioAudioRuntime({
    permissions:{} as any,
    mediaDevices:{getUserMedia:async()=>{throw Error('unused');},enumerateDevices:async()=>[],
      addEventListener(type:string,next:()=>void){calls.push(`add:${type}`);listener=next;},
      removeEventListener(type:string,next:()=>void){calls.push(`remove:${type}:${next===listener}`);},} as any,
    createContext:()=>{throw Error('unused');},scheduler:{request:()=>1,cancel(){}},
  });
  const unsubscribe=runtime.subscribeDevices(()=>calls.push('changed'));
  listener?.();unsubscribe();
  assert.deepEqual(calls,['add:devicechange','changed','remove:devicechange:true']);
});

test('audio runtime reuses active capture permission for device refresh',async()=>{
  const calls:string[]=[];
  const stream={getTracks:()=>[{stop(){calls.push('stop');},addEventListener(){},removeEventListener(){}}]} as any;
  const context={state:'running',close:async()=>{calls.push('close');},addEventListener(){},removeEventListener(){}} as any;
  const runtime=createStudioAudioRuntime({
    permissions:{discover:async()=>{throw Error('must not replace active capture permission');},arm:async()=>({token:'capture-token-0001',expiresAtMs:1}),activate:async()=>true,
      cancel:async()=>false,disconnect:async()=>{calls.push('revoke');return true;}},
    mediaDevices:{getUserMedia:async()=>stream,enumerateDevices:async()=>[{kind:'audioinput',deviceId:'cable',label:'CABLE Output',groupId:'virtual'}],
      addEventListener(){},removeEventListener(){}} as any,
    createContext:()=>context,createAnalyzer:()=>({sample:()=>({level:0,bass:0,mids:0,highs:0,kickStrength:0}),dispose(){}}),scheduler:{request:()=>1,cancel(){}},
  });
  await runtime.connect(configuration,'cable');
  assert.equal(runtime.getConnectedInputId(),'cable');
  assert.deepEqual(await runtime.listInputs(),[{id:'cable',label:'CABLE Output'}]);
  await runtime.disconnect();
  assert.equal(runtime.getConnectedInputId(),undefined);
  assert.deepEqual(calls,['stop','close','revoke']);
});

test('audio runtime does not replace a pending capture arm during device refresh',async()=>{
  const calls:string[]=[];let releaseCapture!:(stream:MediaStream)=>void;
  const track={stop(){},addEventListener(){},removeEventListener(){}};
  const stream={getTracks:()=>[track]} as any;
  const context={state:'running',close:async()=>{},addEventListener(){},removeEventListener(){}} as any;
  const runtime=createStudioAudioRuntime({
    permissions:{discover:async()=>{calls.push('discover');return {token:'wrong-discovery',expiresAtMs:1};},arm:async()=>{calls.push('arm');return {token:'capture-token-0002',expiresAtMs:1};},
      activate:async()=>{calls.push('activate');return true;},cancel:async()=>false,disconnect:async()=>false},
    mediaDevices:{getUserMedia:async()=>new Promise<MediaStream>(resolve=>{releaseCapture=resolve;}),
      enumerateDevices:async()=>[{kind:'audioinput',deviceId:'cable',label:'CABLE Output',groupId:'virtual'}],addEventListener(){},removeEventListener(){}} as any,
    createContext:()=>context,createAnalyzer:()=>({sample:()=>({level:0,bass:0,mids:0,highs:0,kickStrength:0}),dispose(){}}),scheduler:{request:()=>1,cancel(){}},
  });
  const connecting=runtime.connect(configuration,'cable');
  while(!releaseCapture)await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(await runtime.listInputs(),[{id:'cable',label:'CABLE Output'}]);
  assert.deepEqual(calls,['arm']);
  releaseCapture(stream);await connecting;
  assert.deepEqual(calls,['arm','activate']);
});

test('audio runtime arms one request, activates its token, and revokes on disconnect',async()=>{
  const calls:string[]=[];
  const track={stop(){calls.push('stop');},addEventListener(){},removeEventListener(){}};
  const stream={getTracks:()=>[track]} as any;
  const context={state:'suspended',resume:async()=>{calls.push('resume');context.state='running';},close:async()=>{calls.push('close');},addEventListener(){},removeEventListener(){}} as any;
  const runtime=createStudioAudioRuntime({
    permissions:{discover:async()=>{throw Error('unused');},arm:async()=>{calls.push('arm');return {token:'token-token-token-1',expiresAtMs:1};},activate:async token=>{calls.push(`activate:${token}`);return true;},cancel:async()=>false,disconnect:async()=>{calls.push('revoke');return true;}},
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
    permissions:{discover:async()=>{throw Error('unused');},arm:async()=>({token:'token-token-token-2',expiresAtMs:1}),activate:async()=>false,cancel:async token=>{calls.push(`cancel:${token}`);return true;},disconnect:async()=>false},
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
    permissions:{discover:async()=>{throw Error('unused');},arm:async()=>({token:'token-token-token-3',expiresAtMs:1}),activate:async()=>true,cancel:async token=>{calls.push(`cancel:${token}`);return true;},disconnect:async()=>false},
    mediaDevices:{getUserMedia:async()=>stream} as any,createContext:()=>context,
    createAnalyzer:()=>{throw Error('must not analyze');},scheduler:{request:()=>1,cancel(){}},
  });
  await assert.rejects(runtime.connect(configuration),/running/);
  assert.deepEqual(calls,['resume','stop','close','cancel:token-token-token-3']);
});
