const test = require('node:test'), assert = require('node:assert/strict');
const {InstanceRegistry,ProducerHealth} = require('../../apps/installed-runtime/src/registry.cjs');
const runtimeId='a'.repeat(64),releaseId='b'.repeat(64),removed='1'.repeat(32),healthy='2'.repeat(32),attemptId='c'.repeat(32);
const request=instanceId=>({version:1,runtimeId,releaseId,instanceId,hostPid:42});
async function microtasks(){for(let index=0;index<10;index++)await Promise.resolve();}
test('slow removal keeps healthy sibling polling and close awaits its outstanding drain', async () => {
  let finishDrain;const drain=new Promise(resolve=>{finishDrain=resolve;});
  const stopped=[],health=new ProducerHealth({attemptId,startedAt:0});let sequence=0;
  const registry=new InstanceRegistry({runtimeId,start:async value=>({exited:false,
    failure:now=>{
      health.observe({version:2,attemptId,sequence:++sequence,workerHeartbeat:sequence,ready:true,frameId:String(sequence),completedFrames:sequence,backpressureFrames:0},now);
      return health.failure(now);
    },stop:async()=>{stopped.push(value.instanceId);if(value.instanceId===removed)await drain;}})});
  try {
    await registry.reconcile([request(removed),request(healthy)],0);
    await registry.reconcile([request(removed),request(healthy)],250);
    let reconciled=false;
    const removing=registry.reconcile([request(healthy)],500).then(()=>{reconciled=true;});
    await microtasks();assert.equal(reconciled,true,'removal must not block the next supervisor tick');await removing;
    for(let now=750;now<=5000;now+=250)await registry.reconcile([request(healthy)],now);
    assert.equal(registry.entries.get(healthy).attempts,1);assert.deepEqual(stopped,[removed]);
    let closed=false;const closing=registry.close().then(()=>{closed=true;});await microtasks();
    assert.equal(closed,false,'close must retain ownership of the outstanding removal drain');
    finishDrain();await closing;assert.deepEqual(stopped,[removed,healthy]);
  } finally {finishDrain();await registry.close();}
});
test('a draining instance reserves capacity and cannot be replaced until cleanup finishes', async () => {
  let finishDrain;const drain=new Promise(resolve=>{finishDrain=resolve;});let starts=0;
  const registry=new InstanceRegistry({runtimeId,limit:1,start:async()=>{starts++;return{exited:false,stop:()=>drain};}});
  try {
    await registry.reconcile([request(removed)],0);
    const removal=registry.reconcile([],1);await microtasks();
    await registry.reconcile([request(removed)],2);assert.equal(starts,1);
    await registry.reconcile([request(healthy)],3);assert.equal(starts,1);
    finishDrain();await removal;await microtasks();
    await registry.reconcile([request(healthy)],4);assert.equal(starts,2);
  } finally {finishDrain();await registry.close();}
});
test('close retains a producer whose asynchronous admission is still finishing', async () => {
  let finishStart;const starting=new Promise(resolve=>{finishStart=resolve;});let stopped=0;
  const registry=new InstanceRegistry({runtimeId,start:()=>starting});
  const admission=registry.reconcile([request(healthy)],0);
  let closed=false;const closing=registry.close().then(()=>{closed=true;});await microtasks();
  try {
    assert.equal(closed,false);
  } finally {finishStart({exited:false,stop:async()=>{stopped++;}});await admission;await closing;}
  assert.equal(stopped,1);assert.equal(registry.entries.size,0);
});
