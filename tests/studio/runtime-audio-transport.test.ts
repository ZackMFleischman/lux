import test from 'node:test';
import assert from 'node:assert/strict';
import {StandaloneClient} from '../../apps/studio/src/standalone-client.ts';
import {runtimeEditSignature} from '../../apps/studio/src/service-client.ts';

const zero=Object.freeze({generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0});

class AudioProviderFixture {
  snapshot:any=zero;
  listener:(()=>void)|undefined;
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listener=listener;return()=>{if(this.listener===listener)this.listener=undefined;};};
  publish(snapshot:any){this.snapshot=Object.freeze(snapshot);this.listener?.();}
}

class AudioWorkerFixture {
  static all:AudioWorkerFixture[]=[];
  onmessage:any;onerror:any;init:any;messages:any[]=[];terminated=false;
  constructor(){AudioWorkerFixture.all.push(this);}
  postMessage(message:any){
    this.messages.push(message);
    if(message.type==='init'){
      this.init=message;
      queueMicrotask(()=>this.reply({type:'ready'}));
    }
  }
  reply(extra:any){this.onmessage?.({data:{...this.init,type:'status',frameId:'1',timeSeconds:0,clockEpoch:0,
    controlSequence:0,animationSequence:0,intensity:this.init.controls.intensity,controls:this.init.controls,
    effectiveControls:this.init.controls,controlAnimations:this.init.controlAnimations,controlAnimationIssues:[],
    playback:this.init.playing?'playing':'paused',...extra}});}
  terminate(){this.terminated=true;}
}

test('runtime audio transport keeps one in-flight sample and one latest overwrite without publishing sampled state',async t=>{
  const originals=new Map<string,PropertyDescriptor|undefined>();
  const replace=(name:string,value:any)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});};
  AudioWorkerFixture.all=[];
  replace('Worker',AudioWorkerFixture);
  replace('document',{createElement:()=>({style:{},transferControlToOffscreen:()=>({}),remove(){}})});
  replace('performance',{now:()=>0});
  replace('setInterval',()=>1);replace('clearInterval',()=>{});
  t.after(()=>{for(const [name,descriptor] of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);});

  const audio=new AudioProviderFixture();
  const client=new StandaloneClient({compile:async()=>({ok:true,linked:{code:''},sourceHash:'revision'})} as any,{audioProvider:audio as any});
  await client.submit({sdkVersion:'0.1.0',entry:'visual.ts',files:{'visual.ts':''}});
  const worker=AudioWorkerFixture.all[0]!;
  assert.deepEqual(worker.init.audioSnapshot,zero);
  const before=runtimeEditSignature(client.getSnapshot().authoring);

  const first={generation:1,sequence:1,available:true,level:.1,bass:.2,mids:.3,highs:.4};
  const middle={...first,sequence:2,bass:.5};
  const latest={...first,sequence:3,bass:.9};
  audio.publish(first);audio.publish(middle);audio.publish(latest);
  assert.deepEqual(worker.messages.filter(row=>row.type==='audio').map(row=>row.audioSnapshot),[first]);

  worker.reply({type:'audio-ack',providerGeneration:1,sampleSequence:0});
  assert.equal(worker.messages.filter(row=>row.type==='audio').length,1,'stale acknowledgement is ignored');
  worker.reply({type:'audio-ack',providerGeneration:1,sampleSequence:1});
  assert.deepEqual(worker.messages.filter(row=>row.type==='audio').map(row=>row.audioSnapshot),[first,latest]);
  assert.equal(runtimeEditSignature(client.getSnapshot().authoring),before);
});
