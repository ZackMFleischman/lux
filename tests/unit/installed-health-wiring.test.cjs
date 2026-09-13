const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const registry = require('../../apps/installed-runtime/src/registry.cjs');

test('lifecycle telemetry failure cannot prevent native stop or reopen a released process key',async()=>{
 for(const failAt of ['stop-requested','process-exit-observed','clock','all']){
  const runtimeId='a'.repeat(64),local=path.resolve('fixture/local'),root=path.join(local,'Lux/Installed'),runtime=path.join(root,'runtimes',runtimeId);
  let start,stopCalls=0,active=false,failed=false;const records=[],warnings=[];
  class Registry{entries=new Map();errors=new Map();constructor(options){start=options.start;}async reconcile(){}}
  const context={__dirname:path.join(runtime,'apps/installed-runtime/src'),performance:{now:()=>0},setInterval(){return 1;},clearInterval(){},setTimeout,
   process:{argv:['node','supervisor','--lux-runtime-id',runtimeId],env:{LOCALAPPDATA:local},on(){},exit(){assert.fail('Unexpected exit');},stderr:{write:value=>warnings.push(value)}},
   require(name){
    if(name==='node:path'||name==='node:crypto')return require(name);
    if(name==='node:fs')return {mkdirSync(){},writeFileSync(){},rmSync(){},readdirSync:()=>[],appendFileSync(_file,bytes){const record=JSON.parse(bytes);if(failAt==='all'||record.kind===failAt&&!failed){failed=true;throw Error('Disk full');}records.push(record);}};
    if(name==='./registry.cjs')return {InstanceRegistry:Registry,ProducerHealth:class{},sameInstalledPath:(a,b)=>a===b};
    if(name.endsWith('.node'))return {lockSupervisor:()=>true,clock(){if(failAt==='clock'&&!failed){failed=true;throw Error('Clock unavailable');}return {domain:'qpc',at:'1',frequency:'10000000'};},installedStart(){active=true;return 1;},installedRunning(){assert.equal(active,true,'erased native key must never be read');return true;},installedStop(){assert.equal(active,true);active=false;stopCalls++;return {stopped:true,activeProcesses:0,observedExitAt:'2'};}};
    if(name.endsWith('package.cjs'))return {validateRuntime(){},validateRelease:()=>({runtimeId,sourceHash:'c'.repeat(64),releaseId:'d'.repeat(64)}),noLinks:value=>value};
    throw Error('Unexpected dependency: '+name);
   }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../apps/installed-runtime/src/supervisor.cjs'),'utf8'),context);
  const producer=await start({releaseId:'d'.repeat(64),instanceId:'b'.repeat(32)});
  await producer.stop({force:true});await producer.stop({force:true});assert.equal(producer.exited,true);assert.equal(stopCalls,1);assert.equal(failed,true);
  assert.equal(warnings.length,1);assert.equal(JSON.parse(warnings[0]).incomplete,true);
  if(failAt==='all')assert.equal(records.length,0);
  else if(failAt!=='process-exit-observed'){assert.equal(records.at(-1).incomplete,true);assert.equal(records.at(-1).lostRecords,1);}
 }
});
test('each attempt gets its own health/profile channel but watches the original host lease', () => {
  const runtimeId = 'a'.repeat(64), instanceId = 'b'.repeat(32), directory = path.resolve('fixture/Installed');
  const runtime = path.join(directory, 'runtimes', runtimeId), instances = path.join(directory, 'instances', runtimeId);
  const source = fs.readFileSync(path.join(__dirname, '../../apps/installed-runtime/src/instance.cjs'), 'utf8');
  function run(attemptId, foreign = false) {
    const requestPath = path.join(instances, foreign ? 'other.attempts' : instanceId + '.attempts', attemptId + '.json');
    const context = { __dirname: path.join(runtime, 'apps/installed-runtime/src'), process: { argv: ['node', 'instance.cjs', requestPath], env: {} },
      require(name) {
        if (name === 'node:fs') return { statSync: () => ({ size: 256 }), readFileSync: () => JSON.stringify({ version: 1, runtimeId, releaseId: 'c'.repeat(64), instanceId, hostPid: 42 }) };
        if (name === 'node:path') return path;
        if (name === './registry.cjs') return registry;
        if (name.endsWith('package.cjs')) return { noLinks: value => value, validateRelease: () => ({ runtimeId, transportHash: 'transport' }) };
        if (name.endsWith('main.cjs')) return {};
        throw Error('Unexpected dependency: ' + name);
      } };
    vm.runInNewContext(source, context); return context;
  }
  const first = run('1'.repeat(32)), second = run('2'.repeat(32));
  assert.equal(first.luxInstalledContext.requestPath, path.join(instances, instanceId + '.json'));
  assert.equal(first.luxInstalledContext.requestPath, second.luxInstalledContext.requestPath);
  assert.notEqual(first.luxInstalledContext.healthPath, second.luxInstalledContext.healthPath);
  assert.notEqual(first.process.env.LUX_GPU_OUTPUT, second.process.env.LUX_GPU_OUTPUT);
  assert.equal(first.luxInstalledContext.protocol, 'lux-installed-render-host-v2');
  assert.throws(() => run('3'.repeat(32), true), /path mismatch/);
});
test('producer main publishes bounded health while Electron loadFile remains pending, without claiming readiness', async () => {
  const intervals = [], files = new Map(), handlers=new Map(), pendingLoad = new Promise(() => {});
  class FakeWindow {
    constructor() { this.webContents = { on(name,handler) {handlers.set(name,handler);}, setFrameRate() {} }; }
    setContentSize() {} getContentBounds() { return {}; } loadFile() { return pendingLoad; }
  }
  const app = { commandLine: { appendSwitch() {} }, setPath() {}, whenReady: () => Promise.resolve(), getGPUInfo: () => assert.fail('must still be awaiting loadFile') };
  const context = { globalThis: { luxInstalledContext: { protocol: 'lux-installed-render-host-v2', attemptId: 'a'.repeat(32), healthPath: 'health.status' } },
    __dirname: path.resolve('fixture/runtime/apps/render-host/src'), performance: { now: () => 0 },
    process: { env: { LUX_TRANSPORT_BUNDLE: 'bundle', LUX_TRANSPORT_PLAYBACK: '1', LUX_TRANSPORT_STOP: 'stop', LUX_GPU_OUTPUT: 'output' }, versions: {}, pid: 42, hrtime: { bigint: () => 0n } },
    setInterval(callback, ms) { intervals.push({ callback, ms }); return intervals.length; }, clearInterval() {}, clearTimeout() {},
    require(name) {
      if (name === 'electron') return { app, BrowserWindow: FakeWindow };
      if (name === 'node:fs') return { mkdirSync() {}, writeFileSync(name, data) { files.set(name, data); }, renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); } };
      if (name === 'node:path') return path;
      if (name.endsWith('producer-session.cjs')) return require('../../tools/gpu-spike/producer-session.cjs');
      if (name.endsWith('host-startup.cjs')) return require('../../tools/gpu-spike/host-startup.cjs');
      if (name.endsWith('frame-progress.cjs')) return require('../../tools/gpu-spike/frame-progress.cjs');
      if (name.endsWith('transport-release.cjs')) return { readTransportRelease: () => ({ sourceHash: 'hash', linked: {}, settings: {} }) };
      if (name.endsWith('.node')) return {};
      throw Error('Unexpected dependency: ' + name);
    } };
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../../apps/render-host/src/main.ts'), 'utf8'));
  vm.runInNewContext(source, context); await Promise.resolve();
  const sample = JSON.parse(files.get('health.status')); assert.equal(sample.sequence, 1); assert.equal(sample.ready, false);
  assert.equal(sample.frameId, '0'); assert.equal(sample.completedFrames, 0); assert.ok(Buffer.byteLength(files.get('health.status')) < 512);
  intervals.find(timer => timer.ms === 250).callback();
  assert.equal(JSON.parse(files.get('health.status')).sequence, 2); assert.equal(JSON.parse(files.get('health.status')).ready, false);
  assert.equal(sample.version,2);assert.equal(sample.workerHeartbeat,0);
  const beat=value=>handlers.get('console-message')({message:JSON.stringify({kind:'runtime-heartbeat',frameId:'0',workerHeartbeat:value})});
  beat(1);let received=JSON.parse(files.get('health.status'));assert.equal(received.workerHeartbeat,1);assert.equal(received.sequence,3);assert.equal(received.ready,false);
  for(const value of [1,0,-1,1.5,null,Number.MAX_SAFE_INTEGER+1])beat(value);
  assert.equal(JSON.parse(files.get('health.status')).sequence,3,'replayed/invalid worker messages cannot renew health');
  intervals.find(timer=>timer.ms===250).callback();received=JSON.parse(files.get('health.status'));assert.equal(received.sequence,4);assert.equal(received.workerHeartbeat,1,'main health must preserve the last actual worker counter');
  beat(2);assert.equal(JSON.parse(files.get('health.status')).workerHeartbeat,2);
});

test('installed page forwards pre-ready heartbeat only for its own worker instance, generation and revision',async()=>{
 let worker;const logs=[];
 class Worker{constructor(){worker=this;}postMessage(message){this.init=message;}}
 const canvas={cloneNode(){return {transferControlToOffscreen:()=>({})};},replaceWith(){}};
 const context={window:{},Worker,document:{querySelector:()=>canvas},crypto:{randomUUID:require('node:crypto').randomUUID},setTimeout:()=>1,clearTimeout(){},console:{log:value=>logs.push(JSON.parse(value)),error(){}}};
 const html=fs.readFileSync(path.join(__dirname,'../../apps/render-host/src/compiled-output.html'),'utf8');vm.runInNewContext(html.match(/<script type="module">([\s\S]*)<\/script>/)[1],context);
 const ready=context.window.startVisual({sourceHash:'revision',linked:{},settings:{}},.5);
 const heartbeat={type:'heartbeat',instanceId:worker.init.instanceId,generation:worker.init.generation,revisionId:'revision',frameId:'0',workerHeartbeat:1};
 for(const patch of [{instanceId:'other'},{generation:2},{revisionId:'other'}])worker.onmessage({data:{...heartbeat,...patch}});
 assert.equal(logs.length,0);worker.onmessage({data:heartbeat});assert.deepEqual(logs,[{kind:'runtime-heartbeat',frameId:'0',workerHeartbeat:1}]);
 worker.onmessage({data:{...worker.init,type:'ready'}});await ready;
});
