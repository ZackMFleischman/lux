import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {randomUUID} from 'node:crypto';
import {createInitializationProbe} from '../../apps/studio/src/initialization-probe.mjs';
test('probe installs its one-shot resolver before ready and resumes only on its exact owner GO',async()=>{
 const owner={instanceId:'worker',generation:1,revisionId:'a'.repeat(64),initProbeId:'b'.repeat(32)};let ready;
 const gate=createInitializationProbe(owner,message=>{ready=message;});let resumed=false;gate.wait.then(()=>{resumed=true;});
 assert.equal(ready.type,'init-probe-ready');assert.deepEqual({...ready,type:undefined},{...owner,type:undefined});
 for(const patch of [{type:'other'},{instanceId:'old'},{generation:2},{revisionId:'old'},{initProbeId:'old'}])assert.equal(gate.accept({type:'init-probe-go',...owner,...patch}),false);
 await Promise.resolve();assert.equal(resumed,false);assert.equal(gate.accept({type:'init-probe-go',...owner}),true);
 await gate.wait;assert.equal(resumed,true);assert.equal(gate.accept({type:'init-probe-go',...owner}),false);
});
test('cancelled probe cannot resume from a late GO',()=>{
 const owner={instanceId:'worker',generation:1,revisionId:'revision',initProbeId:'probe'},gate=createInitializationProbe(owner,()=>{});
 gate.cancel();assert.equal(gate.accept({type:'init-probe-go',...owner}),false);
});
test('installed relay defaults off and guards ready/GO against stale identities and duplicate dispatch',async()=>{
 for(const enabled of [false,true]){
  let worker;const logs=[],sent=[];
  class Worker{constructor(){worker=this;}postMessage(value){sent.push(value);}}
  const canvas={cloneNode:()=>({transferControlToOffscreen:()=>({})}),replaceWith(){}};
  const context={window:{},Worker,document:{querySelector:()=>canvas},crypto:{randomUUID},setTimeout:()=>1,clearTimeout(){},console:{log:value=>logs.push(JSON.parse(value)),error(){}}};
  vm.runInNewContext(fs.readFileSync(new URL('../../apps/render-host/src/compiled-output.html',import.meta.url),'utf8').match(/<script type="module">([\s\S]*)<\/script>/)[1],context);
  const probe='b'.repeat(32),ready=context.window.startVisual({sourceHash:'revision',linked:{},settings:{}},.5,false,enabled?probe:undefined),initial=sent[0];
  if(!enabled){assert.equal('initProbeId' in initial,false);assert.equal(context.window.goInitProbe,undefined);}
  else{
   const owner={type:'init-probe-ready',instanceId:initial.instanceId,generation:1,revisionId:'revision',initProbeId:probe};
   assert.equal(context.window.goInitProbe(probe,'revision'),false);
   for(const patch of [{instanceId:'old'},{generation:2},{revisionId:'old'},{initProbeId:'old'}])worker.onmessage({data:{...owner,...patch}});
   assert.equal(logs.length,0);worker.onmessage({data:owner});assert.equal(logs.length,1);
   assert.equal(context.window.goInitProbe('old','revision'),false);assert.equal(context.window.goInitProbe(probe,'old'),false);
   assert.equal(context.window.goInitProbe(probe,'revision'),true);assert.equal(sent[1].type,'init-probe-go');assert.equal(sent[1].instanceId,initial.instanceId);
   assert.equal(context.window.goInitProbe(probe,'revision'),false);assert.equal(sent.length,2);
  }
  worker.onmessage({data:{...initial,type:'ready'}});await ready;
 }
});
