'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {InstanceRegistry, ProducerHealth} = require('../../apps/installed-runtime/src/registry.cjs');
const ledger = require('../../apps/installed-runtime/src/restart-intent.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {sourceIdentity}=require('../../packages/export/src/register.cjs');
const emptySchemaHash=require('../../tools/gpu-spike/parameter-mapping.cjs').schemaHash([]);
const runtimeId='a'.repeat(64), releaseId='b'.repeat(64), sourceHash='e'.repeat(64), supervisorEpoch='d'.repeat(32);
const hex=n=>n.toString(16).padStart(32,'0');
const lease=(n=1)=>({version:1,runtimeId,releaseId,instanceId:hex(n),hostPid:42});
const code=expected=>error=>error.code===expected;
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(start, options={}) {
  let now=0,nonce=100,starts=0;
  const registry=new InstanceRegistry({runtimeId,restart:{supervisorEpoch,now:()=>now,nonce:()=>hex(nonce++),...options},
    start:(request,at,attempt)=>start(request,at,attempt,++starts)});
  return {registry,get starts(){return starts;},set now(value){now=value;},get now(){return now;},
    tick:async(requests=[lease()],at=now)=>{now=at;return registry.reconcile(requests,at);}};
}
function command(registry, target, operation=1000, sequence=1) {
  const s=registry.inspectRestart(target);
  return JSON.stringify({version:1,supervisorEpoch:s.supervisorEpoch,attachmentId:s.identity.attachmentId,
    generation:s.observed.generation,commandSequence:sequence,operationId:hex(operation)});
}
const producer=()=>({exited:false,stop:async()=>{}});

// Moving automatic eligibility before take loses an already accepted command.
test('accepted explicit intent outranks suppression and reserves one actual ordinal',async()=>{
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));throw Error('pre-bridge fixture failure');});
  const r=f.registry;
  await f.tick();await f.tick([lease()],250);
  const target=r.restartTarget(lease().instanceId),state=r.inspectRestart(target);
  assert.equal(state.observed.phase,'failed_clear');assert.equal(state.observed.generation,2);
  const bytes=command(r,target);f.now=300;
  assert.equal(r.requestRestart(target,bytes).status,'accepted');await f.tick();
  assert.equal(f.starts,3);assert.equal(r.entries.get(lease().instanceId).attempts,3);
  assert.equal(r.inspectRestart(target).receipt.status,'start_failed');
  assert.equal(r.requestRestart(target,bytes).status,'start_failed');
  assert.equal(r.entries.get(lease().instanceId).lastFaultAt,300);
  assert.equal(r.entries.get(lease().instanceId).retryAt,Infinity);await r.close();
});

// A thrown foreign object must not invoke diagnostic getters or lose the owner.
test('pre-bridge rejected promise records one fault without coercing foreign throws',async()=>{
  let touches=0;
  const hostile={get message(){touches++;throw Error('getter');},toString(){touches++;throw Error('coercion');}};
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));return Promise.reject(hostile);});
  await f.tick();const r=f.registry,target=r.restartTarget(lease().instanceId);
  assert.equal(touches,0);assert.equal(r.entries.get(lease().instanceId).attempts,1);
  assert.equal(r.inspectRestart(target).observed.phase,'failed_clear');
  assert.equal(r.inspectRestart(target).observed.attemptId,hex(1));await r.close();
});

test('explicit admission before a due automatic retry preserves previous fault history on success',async()=>{
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));if(n===1)throw Error('pre-bridge');return producer();});
  await f.tick();const r=f.registry,target=r.restartTarget(lease().instanceId),bytes=command(r,target);
  f.now=250;r.requestRestart(target,bytes);await f.tick();
  const entry=r.entries.get(lease().instanceId);
  assert.equal(f.starts,2);assert.equal(entry.attempts,2);assert.equal(entry.lastFaultAt,0);assert.equal(entry.retryAt,250);
  assert.equal(r.inspectRestart(target).receipt.status,'started');
  entry.producer.exited=true;await f.tick([lease()],400);await entry.stopping;
  assert.equal(entry.lastFaultAt,400);assert.equal(entry.retryAt,Infinity);
  assert.equal(r.requestRestart(target,bytes).status,'start_failed');await r.close();
});

for(const faultAt of [400,30250])test(`explicit success retains fault 250 for subsequent fault at ${faultAt}`,async()=>{
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));if(n<3)throw Error('pre-bridge');return producer();});
  await f.tick();await f.tick([lease()],250);const r=f.registry,target=r.restartTarget(lease().instanceId);
  f.now=300;r.requestRestart(target,command(r,target));await f.tick();const entry=r.entries.get(lease().instanceId);
  assert.equal(entry.lastFaultAt,250);assert.equal(entry.retryAt,Infinity);
  entry.producer.exited=true;await f.tick([lease()],faultAt);await entry.stopping;
  assert.equal(entry.retryAt,faultAt===400?Infinity:30500);await r.close();
});

test('reserved automatic attempt rejects late command and retains deferred producer through close',async()=>{
  const pending=deferred(),stopped=deferred();let stops=0,context;
  const f=fixture((_request,_at,attempt,n)=>{
    attempt.bindValidated(sourceHash,hex(n));if(n===1)throw Error('pre-bridge');context=attempt;return pending.promise;
  });
  await f.tick();const r=f.registry,target=r.restartTarget(lease().instanceId),bytes=command(r,target);
  const admission=f.tick([lease()],250);
  assert.equal(Object.isFrozen(context),true);assert.equal(context.generation,2);
  assert.equal(r.inspectRestart(target).observed.phase,'starting');assert.equal(r.entries.get(lease().instanceId).startPending,true);
  assert.throws(()=>r.requestRestart(target,bytes),code('NOT_FAILED'));
  let closed=false;const closing=r.close().then(()=>{closed=true;});await Promise.resolve();assert.equal(closed,false);
  const owned={exited:false,stop(){stops++;return stopped.promise;}};pending.resolve(owned);await admission;
  assert.equal(r.draining.get(lease().instanceId).producer,owned);assert.equal(r.inspectRestart(target).observed.phase,'removing');
  const secondClose=r.close();assert.equal(stops,1);stopped.resolve();await Promise.all([closing,secondClose]);
  assert.equal(stops,1);assert.equal(f.starts,2);assert.equal(r.inspectRestart(target).retired,true);
});

test('close before deferred validation rejects binding and cannot create provenance',async()=>{
  const gate=deferred();let calls=0;
  const f=fixture(async(_request,_at,attempt)=>{await gate.promise;attempt.bindValidated(sourceHash,hex(1));calls++;return producer();});
  const admission=f.tick(),closing=f.registry.close();gate.resolve();await admission;await closing;
  assert.equal(calls,0);assert.equal(f.registry.restartTarget(lease().instanceId),null);assert.equal(f.registry.draining.size,0);
});

test('accepted close receipt and admitted explicit result have separate lifecycle outcomes',async()=>{
  for(const dispatch of [false,true]){
    const gate=deferred();let stops=0;
    const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));if(n===1)throw Error('pre-bridge');return gate.promise;});
    await f.tick();const r=f.registry,target=r.restartTarget(lease().instanceId),bytes=command(r,target);
    r.requestRestart(target,bytes);const admission=dispatch?f.tick():null;const closing=r.close();
    assert.equal(r.inspectRestart(target).receipt.status,dispatch?'started':'closed');
    if(dispatch){gate.resolve({exited:false,stop:async()=>{stops++;}});await admission;}
    await closing;assert.equal(stops,dispatch?1:0);assert.equal(r.inspectRestart(target).retired,true);
  }
});

test('rejected stop retains one producer while sibling worker liveness still expires at 1250 ms',async()=>{
  const denied={get message(){throw Error('getter');},toString(){throw Error('coercion');}};
  let allow=false,stops=0,polls=0,sequence=0;
  const health=new ProducerHealth({attemptId:hex(2),startedAt:0});
  const f=fixture((request,_at,attempt,n)=>{
    attempt.bindValidated(sourceHash,hex(n));
    if(request.instanceId===hex(1))return {exited:true,stop:async()=>{stops++;if(!allow)throw denied;}};
    return {exited:false,failure(now){polls++;health.observe({version:2,attemptId:hex(2),sequence:++sequence,workerHeartbeat:1,
      ready:true,frameId:String(sequence),completedFrames:sequence,backpressureFrames:0},now);return health.failure(now);},stop:async()=>{}};
  });
  const r=f.registry,requests=[lease(),lease(2)];await f.tick(requests);const firstOwner=r.entries.get(hex(1)).producer;
  await f.tick(requests,250);const target=r.restartTarget(hex(1)),entry=r.entries.get(hex(1));
  await assert.rejects(entry.stopping);assert.equal(entry.producer,firstOwner,'rejected cleanup must retain its exact producer');
  r.requestRestart(target,command(r,target));
  for(const at of [500,750,1000,1250,1500]){await f.tick(requests,at);await assert.rejects(entry.stopping);}
  assert.equal(stops,6);assert.equal(polls,6);assert.equal(f.starts,2);assert.equal(entry.producer!==null,true);
  assert.equal(r.inspectRestart(target).observed.phase,'failed_owned');assert.equal(r.inspectRestart(target).receipt.status,'accepted');
  assert.match(r.errors.get(hex(2)),/worker heartbeat expired/);assert.equal(r.entries.get(hex(2)).lastFaultAt,1500);
  allow=true;await f.tick(requests,1501);await entry.stopping;
  await r.close();
});

test('removal retires only confirmed owners and fresh attachment cannot be controlled with old handle',async()=>{
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));throw Error('pre-bridge');});
  await f.tick();const r=f.registry,target=r.restartTarget(hex(1)),bytes=command(r,target);r.requestRestart(target,bytes);
  await f.tick([],1);assert.equal(r.restartTarget(hex(1)),null);assert.equal(r.inspectRestart(target).receipt.status,'removed');
  assert.equal(r.inspectRestart(target).retired,true);await f.tick([lease()],2);
  const fresh=r.restartTarget(hex(1));assert.notEqual(fresh,target);
  assert.notEqual(r.inspectRestart(fresh).identity.attachmentId,r.inspectRestart(target).identity.attachmentId);
  assert.throws(()=>r.requestRestart(target,bytes),code('ATTACHMENT_RETIRED'));
  assert.throws(()=>r.cancelRestart(target,hex(1000),1),code('ATTACHMENT_RETIRED'));await r.close();
});

test('changed lease identity cannot dispatch accepted command or replace its source',async()=>{
  for(const patch of [{releaseId:'f'.repeat(64)},{hostPid:43},{version:2,descriptorHash:'f'.repeat(64)}]){
    const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));throw Error('pre-bridge');});
    await f.tick();const r=f.registry,target=r.restartTarget(hex(1));r.requestRestart(target,command(r,target));
    const before=r.inspectRestart(target);await f.tick([{...lease(),...patch}],250);
    assert.equal(f.starts,1);assert.deepEqual(r.inspectRestart(target),before);await r.close();
  }
});

test('wrapper authority and rejected clock or command leave full state and sequence unchanged',async()=>{
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));throw Error('pre-bridge');});
  const other=fixture(()=>producer());await f.tick([lease()],10);
  const r=f.registry,target=r.restartTarget(hex(1)),bytes=command(r,target),before=r.inspectRestart(target);
  for(const bad of [{},other.registry])assert.throws(()=>r.inspectRestart(bad),code('INVALID_HANDLE'));
  for(const name of ['requestRestart','cancelRestart','inspectRestart'])assert.throws(()=>other.registry[name](target,bytes),code('INVALID_HANDLE'));
  for(const now of [9,NaN,Infinity,-1]){f.now=now;assert.throws(()=>r.requestRestart(target,bytes),code('INVALID_CLOCK'));assert.deepEqual(r.inspectRestart(target),before);}
  f.now=1000;assert.throws(()=>r.requestRestart(target,' '+bytes),code('INVALID_INPUT'));f.now=10;
  assert.equal(r.requestRestart(target,bytes).status,'accepted');assert.equal(r.cancelRestart(target,hex(1000),1).status,'cancelled');
  await r.close();await other.registry.close();
});

test('shared clock samples after awaited start rather than reusing earlier tick time',async()=>{
  const gate=deferred();
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));if(n===1)throw Error('pre-bridge');return gate.promise;});
  await f.tick();const r=f.registry,target=r.restartTarget(hex(1)),bytes=command(r,target);r.requestRestart(target,bytes);
  const admission=f.tick([lease()],1);f.now=1000;assert.equal(r.requestRestart(target,bytes).status,'started');
  gate.resolve(producer());await admission;assert.equal(r.inspectRestart(target).observed.phase,'running');await r.close();
});

test('owner clock failure after acquisition closes admission but retains and stops exact producer',async()=>{
  const gate=deferred(),stop=deferred();let stops=0;
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));return gate.promise;});
  const admission=f.tick([lease()],10),r=f.registry,target=r.restartTarget(hex(1));f.now=9;
  const owned={exited:false,stop(){stops++;return stop.promise;}};gate.resolve(owned);
  await assert.rejects(admission,code('INVALID_CLOCK'));assert.equal(r.closed,true);
  assert.equal(r.draining.get(hex(1)).producer,owned);assert.equal(stops,1);
  f.now=10;stop.resolve();await r.close();assert.equal(r.inspectRestart(target).retired,true);
});

test('binding is frozen, one use, ordinal scoped and never accepts changed source or previous ID',async()=>{
  for(const attack of ['reuse','source','previous']){
    let old;
    const f=fixture((_request,_at,attempt,n)=>{
      assert.equal(Object.isFrozen(attempt),true);
      if(n===1){old=attempt;attempt.bindValidated(sourceHash,hex(1));throw Error('pre-bridge');}
      if(attack==='reuse')old.bindValidated(sourceHash,hex(2));
      else attempt.bindValidated(attack==='source'?'f'.repeat(64):sourceHash,attack==='previous'?hex(1):hex(2));
      assert.fail('invalid binding authorized a start');
    });
    await f.tick();await assert.rejects(f.tick([lease()],250),code('RESTART_OWNER_CONFLICT'));
    assert.equal(f.starts,2);assert.equal(f.registry.closed,true);await f.registry.close();
  }
});

test('nonce collision fails before start completion and does not retarget the first attachment',async()=>{
  let launches=0;
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));launches++;return producer();},{nonce:()=>hex(10)});
  await f.tick();const r=f.registry,target=r.restartTarget(hex(1)),identity=r.inspectRestart(target).identity;
  await assert.rejects(f.tick([lease(),lease(2)],1),code('ATTACHMENT_EXISTS'));
  assert.equal(launches,1);assert.deepEqual(r.inspectRestart(target).identity,identity);await r.close();
});

test('generation overflow prevents arithmetic and launch',async()=>{
  const f=fixture(()=>{throw Error('pre-validation');});await f.tick();const entry=f.registry.entries.get(hex(1));
  entry.attempts=Number.MAX_SAFE_INTEGER;
  await assert.rejects(f.tick([lease()],250),code('IDENTITY_EXHAUSTED'));
  assert.equal(entry.attempts,Number.MAX_SAFE_INTEGER);assert.equal(f.starts,1);await f.registry.close();
});

test('sixteen retained cleanup reservations deny the seventeenth until one confirmed removal',async()=>{
  const stops=new Map();
  const f=fixture((request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));const stop=deferred();stops.set(request.instanceId,stop);return {exited:true,stop:()=>stop.promise};});
  const r=f.registry,requests=Array.from({length:17},(_,i)=>lease(i+1));
  await f.tick(requests);assert.equal(f.starts,16);
  await f.tick(requests,1);
  for(const request of requests.slice(0,16)){
    const handle=r.restartTarget(request.instanceId),bytes=command(r,handle);r.requestRestart(handle,bytes);r.cancelRestart(handle,hex(1000),1);
  }
  await f.tick(requests.slice(1),2);assert.equal(r.draining.size,1);assert.equal(f.starts,16);
  stops.get(hex(1)).resolve();await r.draining.get(hex(1)).stopping;await f.tick(requests.slice(1),3);
  assert.equal(f.starts,17);assert.equal(r.entries.size,16);
  for(const stop of stops.values())stop.resolve();await r.close();assert.equal(r.draining.size,0);
});

test('R4a boundary only: close before dispatched next observation retains issued work',()=>{
  const q=ledger.createRestartQueue(runtimeId,supervisorEpoch);
  const identity={version:1,runtimeId,releaseId,sourceHash,instanceId:hex(1),hostPid:42,descriptorHash:null,attachmentId:hex(100)};
  const h=ledger.attachRestart(q,JSON.stringify(identity));
  const observe=(generation,phase,operationId=null)=>ledger.observeRestartOwner(h,JSON.stringify({generation,attemptId:hex(generation),phase,operationId}),0);
  observe(1,'failed_clear');
  const bytes=JSON.stringify({version:1,supervisorEpoch,attachmentId:hex(100),generation:1,commandSequence:1,operationId:hex(1000)});
  ledger.requestRestart(h,bytes,0);ledger.takeRestart(h,0);assert.equal(ledger.closeRestartQueue(q,0).retained,1);
  observe(2,'starting',hex(1000));assert.equal(ledger.inspectRestart(h).receipt.status,'started');
  observe(2,'removing');observe(2,'removed');ledger.retireRestart(h,0);
});

test('R4a boundary only: legitimate automatic observation supersedes queued intent',()=>{
  const q=ledger.createRestartQueue(runtimeId,supervisorEpoch),h=ledger.attachRestart(q,JSON.stringify({version:1,runtimeId,releaseId,sourceHash,
    instanceId:hex(1),hostPid:42,descriptorHash:null,attachmentId:hex(100)}));
  ledger.observeRestartOwner(h,JSON.stringify({generation:1,attemptId:hex(1),phase:'failed_clear',operationId:null}),0);
  ledger.requestRestart(h,JSON.stringify({version:1,supervisorEpoch,attachmentId:hex(100),generation:1,commandSequence:1,operationId:hex(1000)}),0);
  ledger.observeRestartOwner(h,JSON.stringify({generation:2,attemptId:hex(2),phase:'starting',operationId:null}),0);
  assert.equal(ledger.inspectRestart(h).receipt.status,'superseded');assert.equal(ledger.takeRestart(h,0),null);
});

// Execute the real supervisor and registry. Only filesystem, time, randomness,
// package lookup and the native bridge are replaced; unknown imports fail.
async function supervisorFixture(options={}) {
  const local=path.resolve('fixture/local'),root=path.join(local,'Lux/Installed'),runtime=path.join(root,'runtimes',runtimeId);
  const directory=path.join(root,'instances',runtimeId),files=new Map(),launches=[],stops=[],records=[],exits=[],timers=[],handlers=new Map();
  let now=0,nonce=500,work,registry,constructorOptions,nativeRunning=true;
  let request={...lease(),...options.request};
  const release={format:'lux-resolume-source',version:1,name:'CPU fixture',runtimeId,releaseId,sourceHash,...options.release};
  const validationCalls=[];
  const disk={
    mkdirSync(){},readdirSync:()=>[request.instanceId+'.json'],
    statSync(filename){if(filename===path.join(directory,request.instanceId+'.json'))return {size:200,mtimeMs:now};
      if(!files.has(filename))throw Object.assign(Error('absent'),{code:'ENOENT'});return {size:Buffer.byteLength(files.get(filename)),mtimeMs:now};},
    readFileSync(filename){if(filename===path.join(directory,request.instanceId+'.json'))return JSON.stringify(request);
      if(!files.has(filename))throw Error('absent');return files.get(filename);},
    writeFileSync(filename,bytes){options.diskWrite?.(filename,bytes);if(filename.endsWith('.stop'))nativeRunning=false;files.set(filename,bytes);},
    rmSync(filename){options.diskRemove?.(filename);files.delete(filename);},
    appendFileSync(filename,bytes){options.append?.(filename,bytes);records.push(JSON.parse(bytes));}
  };
  const bridge={lockSupervisor:()=>true,clock(){return options.clock?.()??{domain:'qpc',at:'1',frequency:'10000000'};},
    installedStart(executable,entry,requestPath){launches.push({executable,entry,requestPath});return options.launch?.(requestPath)??77;},
    installedRunning(key){assert.equal(key,77);return nativeRunning;},
    installedStop(key){stops.push(key);return options.stop?.(key)??{stopped:true,activeProcesses:0,observedExitAt:'2'};}};
  class CapturedRegistry extends InstanceRegistry {
    constructor(settings){super(settings);registry=this;constructorOptions=settings;}
    reconcile(...args){work=super.reconcile(...args);return work;}
  }
  const context=vm.createContext({__dirname:path.join(runtime,'apps/installed-runtime/src'),Buffer,
    performance:{now:()=>{options.performance?.();return now;}},Date:{now:()=>now},
    setInterval(callback,ms){assert.equal(ms,250);return callback;},clearInterval(){},
    setTimeout(callback,ms){const timer={callback,ms};timers.push(timer);options.timer?.(timer);},
    process:{argv:['node','supervisor','--lux-runtime-id',runtimeId],env:{LOCALAPPDATA:local},pid:99,on:(name,callback)=>handlers.set(name,callback),
      kill(pid,signal){assert.equal(pid,42);assert.equal(signal,0);},exit:code=>exits.push(code),stderr:{write(){}}},
    require(name){
      if(name==='node:path')return path;
      if(name==='node:crypto')return {...crypto,randomBytes(size){assert.equal(size,16);return Buffer.from(options.random?.()??hex(nonce++),'hex');}};
      if(name==='node:fs')return disk;
      if(name==='./registry.cjs')return {...require('../../apps/installed-runtime/src/registry.cjs'),InstanceRegistry:CapturedRegistry};
      if(name===path.join(runtime,'native/build/Release/lux_texture_bridge.node'))return bridge;
      if(name===path.join(runtime,'package.cjs'))return {noLinks:value=>value,validateRuntime(location,id){assert.equal(location,runtime);assert.equal(id,runtimeId);},
        validateRelease(location,id){validationCalls.push({location,id});options.validate?.();return release;}};
      if(name===path.join(runtime,'register.cjs'))return {sourceIdentity};
      throw Error('Unexpected supervisor dependency: '+name);
    }});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../apps/installed-runtime/src/supervisor.cjs'),'utf8'),context);
  await work;
  const owner=vm.runInContext('({tick,close})',context);
  return {registry,constructorOptions,files,launches,stops,records,exits,timers,handlers,release,validationCalls,directory,
    set request(value){request=value;},get now(){return now;},set now(value){now=value;},
    tick:async at=>{now=at;await owner.tick();},close:()=>owner.close()};
}

test('actual supervisor binds validated legacy identity to the random request and health ID',async()=>{
  const f=await supervisorFixture(),r=f.registry,target=r.restartTarget(hex(1));
  assert.ok(target,'validated production start must attach the ledger');
  assert.equal(typeof f.constructorOptions.restart.now,'function');assert.equal(f.constructorOptions.restart.supervisorEpoch,hex(500));
  const state=r.inspectRestart(target);assert.equal(state.identity.descriptorHash,null);assert.equal(state.identity.sourceHash,sourceHash);
  assert.equal(state.observed.generation,1);assert.equal(state.observed.attemptId,hex(501));assert.equal(state.observed.phase,'running');
  assert.equal(f.launches[0].requestPath,path.join(f.directory,hex(1)+'.attempts',hex(501)+'.json'));
  const statusPath=path.join(f.directory,hex(1)+'.attempts',hex(501)+'.status');
  f.files.set(statusPath,JSON.stringify({version:2,attemptId:hex(501),sequence:1,workerHeartbeat:1,ready:true,frameId:'1',completedFrames:1,backpressureFrames:0}));
  await f.tick(1);assert.equal(r.entries.get(hex(1)).faulted,false);assert.equal(f.records[0].attemptId,hex(501));
  await r.close();assert.deepEqual(f.stops,[77]);
});

test('actual supervisor rejects release and descriptor failures before bind and native start',async()=>{
  const parameters={version:2,controlSchemaHash:emptySchemaHash,controls:[],savedControls:{},controlMapping:[]};
  const cases=[
    {validate(){throw Error('invalid immutable package');}},
    {release:{runtimeId:'f'.repeat(64)}},
    {release:{releaseId:'f'.repeat(64)}},
    {release:{version:3}},
    {request:{version:2,descriptorHash:'f'.repeat(64)}},
    {release:parameters},
    {release:parameters,request:{version:2,descriptorHash:'f'.repeat(64)}}
  ];
  for(const options of cases){const f=await supervisorFixture(options);
    assert.equal(f.launches.length,0);assert.equal(f.registry.restartTarget(hex(1)),null);
    assert.equal(f.registry.entries.get(hex(1)).attempts,1);await f.registry.close();}
});

test('actual supervisor uses the existing parameter sidecar SHA256 before binding',async()=>{
  const release={version:2,name:'CPU fixture',runtimeId,releaseId,sourceHash,controlSchemaHash:emptySchemaHash,controls:[],savedControls:{},controlMapping:[]};
  const digest=crypto.createHash('sha256').update(sourceIdentity(release).sidecar).digest('hex');
  const f=await supervisorFixture({release,request:{version:2,descriptorHash:digest}}),target=f.registry.restartTarget(hex(1));
  assert.ok(target);assert.equal(f.registry.inspectRestart(target).identity.descriptorHash,digest);assert.equal(f.launches.length,1);
  await f.registry.close();
});

test('actual supervisor quarantines ambiguous bridge failure permanently with the real attempt ID',async()=>{
  const retry=deferred();let thrownReads=0;
  const f=await supervisorFixture({launch(){throw {get message(){thrownReads++;throw Error('getter');}};},timer:timer=>retry.resolve(timer)});
  const r=f.registry,target=r.restartTarget(hex(1));assert.ok(target);
  const entry=r.entries.get(hex(1));assert.equal(entry.producer.initialFailure,'INSTALLED_START_EXIT_UNCONFIRMED');
  assert.equal(entry.producer.exited,false);assert.equal(r.inspectRestart(target).observed.attemptId,hex(501));
  assert.equal(r.inspectRestart(target).observed.phase,'failed_owned');await assert.rejects(entry.stopping,/INSTALLED_START_EXIT_UNCONFIRMED/);
  r.requestRestart(target,command(r,target));
  for(const at of [250,60000]){await f.tick(at);await assert.rejects(r.stopEntry(hex(1),entry),/INSTALLED_START_EXIT_UNCONFIRMED/);}
  assert.equal(f.launches.length,1);assert.equal(thrownReads,0);assert.equal(r.inspectRestart(target).receipt.status,'accepted');
  await assert.rejects(r.close(),/INSTALLED_START_EXIT_UNCONFIRMED/);assert.equal(r.draining.size,1);
  void f.close();const timer=await retry.promise;assert.equal(timer.ms,250);assert.deepEqual(f.exits,[]);
  assert.equal(r.draining.get(hex(1)).producer,entry.producer);assert.equal(r.inspectRestart(target).retired,false);
  // There is intentionally no cleanup resolver for this lost-key branch. The
  // VM's explicit timer owns the uncompleted close; no host timer was scheduled.
});

test('actual acquired key survives stop diagnostics and rejected native confirmation',async()=>{
  let confirmed=false,failDiagnostics=false;
  const f=await supervisorFixture({stop(){if(!confirmed)throw Error('native exit unconfirmed');return {stopped:true,activeProcesses:0};},
    clock(){if(failDiagnostics)throw Error('QPC diagnostic unavailable');},
    append(){if(failDiagnostics)throw Error('disk full');},diskWrite(filename){if(failDiagnostics&&filename.endsWith('.stop'))throw Error('disk full');},
    diskRemove(){if(failDiagnostics)throw Error('disk full');}});
  const r=f.registry,owned=r.entries.get(hex(1)).producer;failDiagnostics=true;
  await assert.rejects(r.close(),/native exit unconfirmed/);assert.equal(r.draining.get(hex(1)).producer,owned);
  assert.deepEqual(f.stops,[77]);confirmed=true;await r.close();assert.deepEqual(f.stops,[77,77]);assert.equal(owned.exited,true);
  await owned.stop({force:true});assert.deepEqual(f.stops,[77,77]);
});

test('invalid first package has no attachment and later validation binds the actual second ordinal',async()=>{
  const f=fixture((_request,_at,attempt,n)=>{if(n===1)throw Error('package unavailable');attempt.bindValidated(sourceHash,hex(91));return producer();});
  await f.tick();const r=f.registry;assert.equal(r.restartTarget(hex(1)),null);
  assert.equal(r.entries.get(hex(1)).lastFaultAt,0);await f.tick([lease()],250);
  const target=r.restartTarget(hex(1));assert.equal(r.inspectRestart(target).observed.generation,2);
  assert.equal(r.inspectRestart(target).observed.attemptId,hex(91));assert.equal(r.entries.get(hex(1)).lastFaultAt,0);await r.close();
});

test('binding reserves ordinal and pending ownership before synchronous callback with no reusable bind',async()=>{
  let r;
  const f=fixture((_request,_at,attempt,n)=>{
    assert.equal(attempt.generation,n);assert.equal(r.entries.get(hex(1)).attempts,n);
    assert.equal(r.entries.get(hex(1)).startPending,true);assert.equal(r.starting.size,1);
    attempt.bindValidated(sourceHash,hex(n));
    assert.throws(()=>attempt.bindValidated(sourceHash,hex(n+10)),code('RESTART_OWNER_CONFLICT'));
    assert.equal(r.inspectRestart(r.restartTarget(hex(1))).observed.attemptId,hex(n));return producer();
  });
  r=f.registry;await f.tick();await r.close();
});

test('restart mode validates its fixed bound, epoch and nonce and never launches malformed identity',async()=>{
  for(const restart of [{supervisorEpoch:'bad',now:()=>0,nonce:()=>hex(1)},
    {supervisorEpoch,now:0,nonce:()=>hex(1)},{supervisorEpoch,now:()=>0,nonce:null}])
    assert.throws(()=>new InstanceRegistry({runtimeId,start:()=>producer(),restart}),code('INVALID_INPUT'));
  assert.throws(()=>new InstanceRegistry({runtimeId,limit:17,start:()=>producer(),restart:{supervisorEpoch,now:()=>0,nonce:()=>hex(1)}}),code('INVALID_INPUT'));
  for(const nonce of [null,'bad',{},'F'.repeat(32)]){
    let launches=0;
    const f=fixture((_request,_at,attempt)=>{attempt.bindValidated(sourceHash,hex(1));launches++;return producer();},{nonce:()=>nonce});
    await f.tick();assert.equal(launches,0);assert.equal(f.registry.restartTarget(hex(1)),null);await f.registry.close();
  }
});

test('clock failure during actual supervisor stop still attempts native cleanup on acquired key',async()=>{
  let clockThrows=false;
  const f=await supervisorFixture({performance(){if(clockThrows)throw Error('monotonic source unavailable');}});
  const owned=f.registry.entries.get(hex(1)).producer;clockThrows=true;
  await owned.stop({force:true});assert.deepEqual(f.stops,[77]);assert.equal(owned.exited,true);
  clockThrows=false;await f.registry.close();assert.deepEqual(f.stops,[77]);
});

test('same request sequence replays after many cancellations without an extra attempt',async()=>{
  const f=fixture((_request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));throw Error('pre-bridge');});
  await f.tick();const r=f.registry,target=r.restartTarget(hex(1));
  for(let sequence=1;sequence<=1000;sequence++){
    const bytes=command(r,target,1000+sequence,sequence);r.requestRestart(target,bytes);r.cancelRestart(target,hex(1000+sequence),sequence);
    assert.equal(r.requestRestart(target,bytes).status,'cancelled');
  }
  assert.equal(r.inspectRestart(target).lastSequence,1000);assert.equal(r.entries.size,1);assert.equal(f.starts,1);await r.close();
});

test('removal publication clock failure closes admission while every producer still reaches cleanup',async()=>{
  for(const invalid of [NaN,Infinity,-1]){
    const cleanup=deferred(),started=[];
    const f=fixture((request,_at,attempt,n)=>{attempt.bindValidated(sourceHash,hex(n));return {exited:false,stop(){started.push(request.instanceId);return cleanup.promise;}};});
    await f.tick([lease(),lease(2)]);f.now=invalid;
    await assert.rejects(f.registry.reconcile([lease(2)],1),code('INVALID_CLOCK'));
    assert.equal(f.registry.closed,true,'an owner publication failure must prevent further starts');
    assert.deepEqual(started.sort(),[hex(1),hex(2)]);
    f.now=1;cleanup.resolve();await f.registry.close();
  }
});
