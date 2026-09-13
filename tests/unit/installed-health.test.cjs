const test = require('node:test'), assert = require('node:assert/strict');
const { ProducerHealth, InstanceRegistry } = require('../../apps/installed-runtime/src/registry.cjs');
const attemptId = 'a'.repeat(32);
const status = (sequence, patch = {}) => ({ version: 2, attemptId, sequence, workerHeartbeat:sequence, ready: true, frameId: '1', completedFrames: 1, backpressureFrames: 0, ...patch });

test('worker silence expires at exactly 1250ms before first frame for blocked top-level or create',()=>{
 for(const stage of ['top-level','create']){
  const health=new ProducerHealth({attemptId,startedAt:0});
  health.observe(status(1,{ready:false,frameId:'0',completedFrames:0}),100);
  for(const now of [350,600,850,1100,1349])health.observe(status(now,{workerHeartbeat:1,ready:false,frameId:'0',completedFrames:0}),now);
  assert.equal(health.failure(1349),null,stage);assert.match(health.failure(1350),/worker heartbeat/i,stage);
 }
});
test('healthy async startup and delayed worker start retain the fifteen-second first-frame budget',()=>{
 for(const workerStart of [0,10000]){
  const health=new ProducerHealth({attemptId,startedAt:0});
  for(let now=0;now<15000;now+=250){
   assert.equal(health.observe(status(now+1,{workerHeartbeat:now<workerStart?0:now+1,ready:false,frameId:'0',completedFrames:0}),now),true);
   assert.equal(health.failure(now),null);
  }
  assert.match(health.failure(15000),/startup/);
 }
 const delayedMain=new ProducerHealth({attemptId,startedAt:0});assert.equal(delayedMain.failure(14999),null);assert.match(delayedMain.failure(15000),/startup/);
});
test('backpressure and main activity cannot renew a silent worker, and worker counter replays cannot renew liveness',()=>{
 const health=new ProducerHealth({attemptId,startedAt:0});health.observe(status(1),0);
 for(let now=250;now<1250;now+=250)assert.equal(health.observe(status(now,{workerHeartbeat:1,backpressureFrames:now}),now),true);
 assert.equal(health.observe(status(1100,{workerHeartbeat:0}),1100),false);
 assert.equal(health.observe(status(1000,{workerHeartbeat:2}),1100),false);
 assert.equal(health.observe(status(1101,{workerHeartbeat:NaN}),1101),false);
 assert.equal(health.failure(1249),null);assert.match(health.failure(1250),/worker heartbeat/i);
});
test('250ms supervisor polling force-stops a silent worker by the first tick after the 1250ms deadline',async()=>{
 const health=new ProducerHealth({attemptId,startedAt:0});health.observe(status(1),1);
 const runtimeId='a'.repeat(64),request={version:1,runtimeId,releaseId:'b'.repeat(64),instanceId:'1'.repeat(32),hostPid:42};
 let current=0;const stops=[];const registry=new InstanceRegistry({runtimeId,start:async()=>({exited:false,failure:now=>health.failure(now),stop:async options=>stops.push({at:current,force:options?.force})})});
 await registry.reconcile([request],0);
 for(current=250;current<=1500;current+=250){health.observe(status(current,{workerHeartbeat:1}),current);await registry.reconcile([request],current);}
 assert.deepEqual(stops,[{at:1500,force:true}]);assert.equal(registry.entries.get(request.instanceId).producer,null);
});
test('external startup deadline expires despite a responsive main that never publishes a first frame', () => {
  const health = new ProducerHealth({ attemptId, startedAt: 0 });
  for (let now = 0; now <= 15000; now += 250) health.observe(status(now + 1, { ready: false, frameId: '0', completedFrames: 0 }), now);
  assert.match(health.failure(15000), /startup/);
});
test('main heartbeat and advancing worker/published frames have independent external deadlines', () => {
  const missing = new ProducerHealth({ attemptId, startedAt: 0 }); missing.observe(status(1), 100);
  assert.equal(missing.failure(1349),null);assert.match(missing.failure(1350), /main heartbeat/);
  const worker = new ProducerHealth({ attemptId, startedAt: 0 }); worker.observe(status(1), 100);
  for (let now = 1100; now < 4100; now += 1000) worker.observe(status(now, { completedFrames: now }), now);
  assert.match(worker.failure(4100), /Visual frame/);
  const compositor = new ProducerHealth({ attemptId, startedAt: 0 }); compositor.observe(status(1), 100);
  for (let now = 1100; now < 4100; now += 1000) compositor.observe(status(now, { frameId: String(now) }), now);
  assert.match(compositor.failure(4100), /Published output/);
  const healthy = new ProducerHealth({ attemptId, startedAt: 0 });
  for (let now = 0; now <= 20000; now += 250) { healthy.observe(status(now + 1, { frameId: String(now + 1), completedFrames: now + 1 }), now); assert.equal(healthy.failure(now), null); }
});
test('old attempts, replayed sequences and malformed samples cannot renew a producer', () => {
  const health = new ProducerHealth({ attemptId, startedAt: 0 }); health.observe(status(1), 100);
  for (const sample of [status(2, { version:1 }),status(2, { attemptId: 'b'.repeat(32) }), status(1), status(2, { sequence: NaN }), status(2, { frameId: '-1' }), status(2, { completedFrames: -1 })])
    assert.equal(health.observe(sample, 500), false);
  assert.match(health.failure(1350), /main heartbeat/);
});
test('confirmed receiver backpressure tolerates a non-consuming host without hiding a stalled visual', () => {
  const health = new ProducerHealth({ attemptId, startedAt: 0 }); health.observe(status(1), 0);
  for (let now = 250; now <= 10000; now += 250) {
    health.observe(status(now, { frameId: String(now), backpressureFrames: now }), now);
    assert.equal(health.failure(now), null);
  }
  for (let now = 10250; now < 14000; now += 250) health.observe(status(now, { frameId: '10000', backpressureFrames: now }), now);
  assert.match(health.failure(14000), /Visual frame/);
});
test('expiry stops only its Job and disposes the second failed producer before suppressing retry', async () => {
  const runtimeId = 'a'.repeat(64), releaseId = 'b'.repeat(64), bad = '1'.repeat(32), good = '2'.repeat(32);
  const request = instanceId => ({ version: 1, runtimeId, releaseId, instanceId, hostPid: 42 });
  const starts = [], stops = [];
  const registry = new InstanceRegistry({ runtimeId, start: async value => {
    starts.push(value.instanceId); return { exited: false, failure: () => value.instanceId === bad ? 'startup deadline' : null,
      stop: async options => { stops.push({ id: value.instanceId, force: options?.force }); } };
  } });
  for (const now of [0, 1, 500, 1001, 1002, 3002, 3003, 10000]) await registry.reconcile([request(bad), request(good)], now);
  assert.equal(starts.filter(id => id === bad).length, 2); assert.equal(starts.filter(id => id === good).length, 1);
  assert.deepEqual(stops, Array.from({ length: 2 }, () => ({ id: bad, force: true })));
  assert.equal(registry.entries.get(bad).producer, null); assert.match(registry.errors.get(bad), /startup/);
  await registry.reconcile([request(good)], 20000); assert.equal(registry.errors.has(bad), false);
  await registry.close(); assert.equal(stops.at(-1).id, good);
});
