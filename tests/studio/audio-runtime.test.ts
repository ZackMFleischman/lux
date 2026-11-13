import test from 'node:test';
import assert from 'node:assert/strict';
import {testRhythmInput} from '../../apps/studio/src/audio/test-rhythm.ts';
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

  assert.deepEqual(await runtime.listInputs(),[testRhythmInput,{id:'cable',label:'CABLE Output (VB-Audio Virtual Cable)'}]);
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
  assert.deepEqual(await runtime.listInputs(),[testRhythmInput,{id:'cable',label:'CABLE Output'}]);
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
  assert.deepEqual(await runtime.listInputs(),[testRhythmInput,{id:'cable',label:'CABLE Output'}]);
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


test('Test rhythm remains discoverable without hardware permission',async()=>{
  const runtime=createStudioAudioRuntime({permissions:{discover:async()=>{throw Error('denied');}} as any,
    mediaDevices:{} as any,createContext:()=>{throw Error('unused');},scheduler:{request:()=>1,cancel(){}}});
  assert.deepEqual(await runtime.listInputs(),[testRhythmInput]);
});

test('Test rhythm connects through the shared analyzer silently and releases every resource',async()=>{
  const calls:string[]=[];let discoveries=0;let pcm:Float32Array|undefined;let source:any;let sample:FrameRequestCallback|undefined;
  const stream={getTracks:()=>[{stop(){calls.push('track.stop');},addEventListener(){},removeEventListener(){}}]};
  const destination={stream};
  const context={state:'running',sampleRate:48000,destination:{},addEventListener(){},removeEventListener(){},
    createBuffer(channels:number,length:number,rate:number){assert.equal(channels,1);assert.equal(rate,48000);pcm=new Float32Array(length);return {getChannelData:()=>pcm};},
    createBufferSource(){source={loop:false,buffer:null,connect(target:any){assert.equal(target,destination);calls.push('source.connect');},start(){calls.push('source.start');},stop(){calls.push('source.stop');},disconnect(){calls.push('source.disconnect');}};return source;},
    createMediaStreamDestination(){return destination;},async close(){this.state='closed';calls.push('context.close');},
    createMediaStreamSource(input:any){assert.equal(input,stream);return {connect(target:any){assert.equal(target,context.destination);calls.push('monitor.connect');},disconnect(){calls.push('monitor.disconnect');}};},
  };
  const runtime=createStudioAudioRuntime({permissions:{disconnect:async()=>false,discover:async()=>{discoveries++;return {token:'hardware-discovery',expiresAtMs:1};},cancel:async()=>true} as any,mediaDevices:{enumerateDevices:async()=>[{kind:'audioinput',deviceId:'cable',label:'CABLE Output'}]} as any,createContext:()=>context as any,
    createAnalyzer:(actualContext,actualStream)=>{assert.equal(actualContext,context);assert.equal(actualStream,stream);calls.push('analyzer');return {sample:()=>({level:.2,bass:.3,mids:.1,highs:.05,kickStrength:.6}),dispose(){calls.push('analyzer.dispose');}};},
    scheduler:{request:callback=>{sample=callback;return 1;},cancel(){calls.push('sample.cancel');}}});
  await runtime.connect(configuration,testRhythmInput.id);
  assert.equal(runtime.getConnectedInputId(),testRhythmInput.id);assert.equal(runtime.getMonitoring(),false);assert.equal(source.loop,true);
  assert.equal(pcm?.length,48000*8);assert.ok(pcm!.some(value=>value!==0));assert.ok(pcm!.every(value=>Number.isFinite(value)&&Math.abs(value)<=1));
  assert.deepEqual(calls,['source.connect','source.start','analyzer']);
  assert.deepEqual(await runtime.listInputs(),[testRhythmInput,{id:'cable',label:'CABLE Output'}]);assert.equal(discoveries,1);
  runtime.subscribe(()=>{});sample?.(50);assert.equal(runtime.getSnapshot().kickSequence,1);assert.equal(runtime.getSnapshot().bass,.3);
  await runtime.setMonitoring(true);assert.equal(runtime.getMonitoring(),true);
  const generation=runtime.getSnapshot().generation;await runtime.disconnect();
  assert.equal(runtime.getSnapshot().available,false);assert.ok(runtime.getSnapshot().generation>generation);assert.equal(runtime.getSnapshot().bass,0);assert.equal(runtime.getConnectedInputId(),undefined);
  assert.ok(calls.includes('monitor.disconnect'));assert.ok(calls.includes('track.stop'));assert.ok(calls.includes('context.close'));assert.ok(calls.includes('source.stop'));assert.ok(calls.includes('source.disconnect'));
  await runtime.dispose();assert.equal(calls.filter(call=>call==='source.stop').length,1);
});


test('disconnect during Test rhythm context resume cleans the late capture and never publishes it',async()=>{
  const calls:string[]=[];let resume!:()=>void;
  const context={state:'suspended',sampleRate:8000,async resume(){await new Promise<void>(resolve=>{resume=resolve;});this.state='running';},
    createBuffer(_channels:number,length:number){return {getChannelData:()=>new Float32Array(length)};},
    createBufferSource(){return {connect(){},start(){},stop(){calls.push('source.stop');},disconnect(){calls.push('source.disconnect');}};},
    createMediaStreamDestination(){return {stream:{getTracks:()=>[{stop(){calls.push('track.stop');}}]}};},
    async close(){this.state='closed';calls.push('context.close');},
  };
  const runtime=createStudioAudioRuntime({permissions:{disconnect:async()=>false} as any,mediaDevices:{} as any,createContext:()=>context as any,
    createAnalyzer:()=>{throw Error('stale capture must not reach analyzer');},scheduler:{request:()=>1,cancel(){}}});
  const connecting=runtime.connect(configuration,testRhythmInput.id);await runtime.disconnect();
  assert.deepEqual(calls,['context.close']);resume();await connecting;
  assert.equal(runtime.getSnapshot().available,false);assert.equal(runtime.getConnectedInputId(),undefined);assert.equal(runtime.getMonitoring(),false);
  assert.deepEqual(calls,['context.close']);
  await assert.rejects(runtime.setMonitoring(true),/not connected/);
});


test('a newer connect promptly closes only its superseded synthetic context',async()=>{
  const contexts:any[]=[];let resume!:()=>void;
  const runtime=createStudioAudioRuntime({permissions:{disconnect:async()=>false} as any,mediaDevices:{} as any,
    createContext:()=>{const first=contexts.length===0;const context={state:first?'suspended':'running',sampleRate:8000,closes:0,
      async resume(){await new Promise<void>(resolve=>{resume=resolve;});this.state='running';},
      createBuffer(_channels:number,length:number){return {getChannelData:()=>new Float32Array(length)};},
      createBufferSource(){return {connect(){},start(){},stop(){},disconnect(){}};},
      createMediaStreamDestination(){return {stream:{getTracks:()=>[{stop(){},addEventListener(){},removeEventListener(){}}]}};},
      addEventListener(){},removeEventListener(){},async close(){this.state='closed';this.closes++;},
    };contexts.push(context);return context as any;},
    createAnalyzer:()=>({sample:()=>({level:0,bass:0,mids:0,highs:0,kickStrength:0}),dispose(){}}),scheduler:{request:()=>1,cancel(){}}});
  const previous=runtime.connect(configuration,testRhythmInput.id);await runtime.connect(configuration,testRhythmInput.id);
  assert.equal(contexts[0].closes,1);assert.equal(contexts[1].closes,0);assert.equal(runtime.getSnapshot().available,true);
  resume();await previous;assert.equal(contexts[0].closes,1);assert.equal(runtime.getSnapshot().available,true);await runtime.dispose();
});

test('an older disconnect never closes or revokes a newer pending connection',async()=>{
  let releaseClose!:()=>void,resume!:()=>void;let revocations=0,created=0;const contexts:any[]=[];
  const runtime=createStudioAudioRuntime({permissions:{disconnect:async()=>{revocations++;return true;}} as any,mediaDevices:{} as any,
    createContext:()=>{const first=created++===0;const context={state:first?'running':'suspended',sampleRate:8000,closes:0,
      async resume(){await new Promise<void>(resolve=>{resume=resolve;});this.state='running';},
      createBuffer(_channels:number,length:number){return {getChannelData:()=>new Float32Array(length)};},
      createBufferSource(){return {connect(){},start(){},stop(){},disconnect(){}};},
      createMediaStreamDestination(){return {stream:{getTracks:()=>[{stop(){},addEventListener(){},removeEventListener(){}}]}};},
      addEventListener(){},removeEventListener(){},async close(){this.closes++;if(first)await new Promise<void>(resolve=>{releaseClose=resolve;});this.state='closed';},
    };contexts.push(context);return context as any;},
    createAnalyzer:()=>({sample:()=>({level:0,bass:0,mids:0,highs:0,kickStrength:0}),dispose(){}}),scheduler:{request:()=>1,cancel(){}}});
  await runtime.connect(configuration,testRhythmInput.id);const disconnecting=runtime.disconnect();const connecting=runtime.connect(configuration,testRhythmInput.id);
  releaseClose();await disconnecting;assert.equal(contexts[1].closes,0);assert.equal(revocations,0);
  resume();await connecting;assert.equal(runtime.getSnapshot().available,true);await runtime.dispose();assert.equal(revocations,1);
});


test('switching a physical capture to Test rhythm cancels only that capture permission token',async()=>{
  const cancelled:string[]=[];let arms=0;
  const stream={getTracks:()=>[{stop(){},addEventListener(){},removeEventListener(){}}]};
  const runtime=createStudioAudioRuntime({permissions:{arm:async()=>{arms++;return {token:'physical-capture-token',expiresAtMs:1};},activate:async()=>true,
    cancel:async (token:string)=>{cancelled.push(token);return true;},disconnect:async()=>false} as any,
    mediaDevices:{getUserMedia:async()=>stream} as any,
    createContext:()=>({state:'running',sampleRate:8000,addEventListener(){},removeEventListener(){},async close(){this.state='closed';},
      createBuffer(_channels:number,length:number){return {getChannelData:()=>new Float32Array(length)};},
      createBufferSource(){return {connect(){},start(){},stop(){},disconnect(){}};},createMediaStreamDestination(){return {stream};}} as any),
    createAnalyzer:()=>({sample:()=>({level:0,bass:0,mids:0,highs:0,kickStrength:0}),dispose(){}}),scheduler:{request:()=>1,cancel(){}}});
  await runtime.connect(configuration,'physical');await runtime.connect(configuration,testRhythmInput.id);
  assert.deepEqual(cancelled,['physical-capture-token']);assert.equal(arms,1);assert.equal(runtime.getConnectedInputId(),testRhythmInput.id);await runtime.dispose();
});
