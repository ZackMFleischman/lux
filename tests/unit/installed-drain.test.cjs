const test = require('node:test'), assert = require('node:assert/strict');
const {InstanceRegistry,ProducerHealth} = require('../../apps/installed-runtime/src/registry.cjs');
const runtimeId='a'.repeat(64),releaseId='b'.repeat(64),removed='1'.repeat(32),healthy='2'.repeat(32),attemptId='c'.repeat(32);
const request=instanceId=>({version:1,runtimeId,releaseId,instanceId,hostPid:42});
async function microtasks(){for(let index=0;index<10;index++)await Promise.resolve();}

test('slow forced stop keeps sibling watchdog polls live and gates replacement until confirmed exit',async()=>{
 let finishStop;const pending=new Promise(resolve=>{finishStop=resolve;});let fault=false,sequence=0;
 const starts=[],stops=[],health=new ProducerHealth({attemptId,startedAt:0});
 const registry=new InstanceRegistry({runtimeId,start:async value=>{starts.push(value.instanceId);return {get exited(){return value.instanceId===removed&&fault;},failure:now=>{
  if(value.instanceId!==healthy)return null;
  health.observe({version:2,attemptId,sequence:++sequence,workerHeartbeat:sequence,ready:true,frameId:String(sequence),completedFrames:sequence,backpressureFrames:0},now);return health.failure(now);
 },stop:async options=>{stops.push({id:value.instanceId,force:options?.force});if(value.instanceId===removed)await pending;}};}});
 try{
  await registry.reconcile([request(removed),request(healthy)],0);await registry.reconcile([request(removed),request(healthy)],250);fault=true;
  let reconciled=false;const failing=registry.reconcile([request(removed),request(healthy)],500).then(()=>{reconciled=true;});
  await microtasks();assert.equal(reconciled,true,'forced cleanup must not hold the supervisor poll');await failing;
  for(let now=750;now<=2000;now+=250)await registry.reconcile([request(removed),request(healthy)],now);
  assert.deepEqual(stops,[{id:removed,force:true}]);assert.equal(starts.filter(id=>id===removed).length,1);assert.equal(registry.entries.get(healthy).attempts,1);assert.equal(health.failure(2000),null);
  finishStop();await microtasks();fault=false;await registry.reconcile([request(removed),request(healthy)],2250);assert.equal(starts.filter(id=>id===removed).length,2);
 }finally{finishStop();await registry.close();}
});

test('removal and close share a pending forced stop while retaining its capacity',async()=>{
 let finishStop;const pending=new Promise(resolve=>{finishStop=resolve;});let fault=false,starts=0,stops=0;
 const registry=new InstanceRegistry({runtimeId,limit:1,start:async()=>{starts++;return {get exited(){return fault;},stop:async options=>{stops++;assert.equal(options.force,true);await pending;}};}});
 try{
  await registry.reconcile([request(removed)],0);fault=true;await registry.reconcile([request(removed)],250);await microtasks();
  await registry.reconcile([request(healthy)],500);assert.equal(registry.draining.size,1);assert.equal(starts,1);assert.equal(stops,1);
  let closed=false;const closing=registry.close().then(()=>{closed=true;});await microtasks();assert.equal(closed,false);assert.equal(stops,1);
  finishStop();await closing;assert.equal(registry.draining.size,0);assert.equal(stops,1);
 }finally{finishStop();await registry.close();}
});

test('failed forced cleanup retains ownership through removal and close retries',async()=>{
 let stopAllowed=false,stops=0;
 const registry=new InstanceRegistry({runtimeId,limit:1,start:async()=>({exited:true,stop:async()=>{stops++;if(!stopAllowed)throw Error('exit unconfirmed');}})});
 await registry.reconcile([request(removed)],0);await registry.reconcile([request(removed)],250);await microtasks();
 assert.ok(registry.entries.get(removed).producer,'unconfirmed producer remains owned');
 await assert.rejects(registry.close(),/exit unconfirmed/);assert.equal(registry.draining.size,1);
 const previousStops=stops;stopAllowed=true;await registry.close();assert.equal(stops,previousStops+1);assert.equal(registry.draining.size,0);
});
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
