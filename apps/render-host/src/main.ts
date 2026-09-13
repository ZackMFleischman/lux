const installed = (globalThis as any).luxInstalledContext;
const parameterProtocol='lux-parameter-render-host-v1';
if (installed && installed.protocol !== 'lux-installed-render-host-v2') throw Error('Installed render-host protocol mismatch');
if (!installed && (!process.env.LUX_EXPERIMENT_RUN_ID || process.env.LUX_EXPERIMENT_MODE !== 'hardware')) {
  throw Error('Reviewed experiment supervisor required');
}
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { ProducerSession } = require('../../../tools/gpu-spike/producer-session.cjs');
const { readTransportRelease } = require('../../../tools/gpu-spike/transport-release.cjs');
const { HostStartup } = require('../../../tools/gpu-spike/host-startup.cjs');
const { FrameProgress } = require('../../../tools/gpu-spike/frame-progress.cjs');
const progress = new FrameProgress();
const release = process.env.LUX_TRANSPORT_BUNDLE ? readTransportRelease(process.env.LUX_TRANSPORT_BUNDLE) : null;
const controlledFrames=process.env.LUX_CONTROLLED_FRAMES==='1';
if(controlledFrames&&release?.linked.linkedVersion!==3)throw Error('Controlled frame diagnostics require a parameter release');
const frameGate=controlledFrames?new (require('../../../tools/gpu-spike/frame-gate.cjs').ControlledFrameGate)({revisionId:release.sourceHash,schemaHash:release.linked.controlSchemaHash,count:release.linked.controls.length}):null;
const playback = process.env.LUX_TRANSPORT_PLAYBACK === '1';
if(playback&&(!release||!process.env.LUX_TRANSPORT_STOP))throw Error('Playback requires a compiled release and supervised stop signal');
const bridge = require(path.resolve(__dirname, '../../../native/build/Release/lux_texture_bridge.node'));
const output = process.env.LUX_GPU_OUTPUT || path.resolve(__dirname, '../../../evidence/tracer-0.1/tr02-probe');
const duration = Number(process.env.LUX_GPU_DURATION_MS || 8000);
if (!Number.isInteger(duration) || duration < 1000 || duration > 330000) throw Error('Invalid diagnostic duration');
fs.mkdirSync(output, { recursive: true });
const records = [], session = new ProducerSession(bridge);
let count = 0, dropped = 0, failed = false, finishing = false, webgpuReady = false, visualReady = false;
let pollTimer, controlTimer, endTimer;
let healthTimer, healthSequence = 0, completedFrames = 0, backpressureFrames = 0;
let stopProducer=()=>{};
function publishHealth() {
  if (!installed || finishing) return;
  const state = {version:1, attemptId:installed.attemptId, sequence:++healthSequence,
    ready:visualReady && completedFrames > 0, frameId:progress.frame.toString(), completedFrames, backpressureFrames};
  const temporary = installed.healthPath + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(state)); fs.renameSync(temporary, installed.healthPath);
}
// Start reporting before Electron startup awaits. The supervisor owns the
// deadline if this main event loop or a native driver call stops responding.
if (installed) {
  publishHealth();
  healthTimer = setInterval(() => { try { publishHealth(); } catch (error) { failure(error); } }, 250);
}
function record(value) {
  if(playback&&value.kind==='copy-complete')return;
  if(playback&&records.length>=1000)records.shift();
  if (records.length < 10000) records.push({ utc: new Date().toISOString(), time: process.hrtime.bigint().toString(), ...value });
  else dropped++;
}
function failure(error) { failed = true; record({ kind: 'failure', reason: String(error) }); if(playback)stopProducer(); }
function finish(closed) {
  if (finishing) return;
  finishing = true;
  clearInterval(pollTimer); clearInterval(controlTimer); clearInterval(healthTimer); clearTimeout(endTimer);
  record({ kind: 'summary', paint: count, held: session.held.size, uncertain: session.uncertain.size, dropped, closed, failed, webgpuReady });
  fs.writeFileSync(path.join(output, 'probe.json'), JSON.stringify(records, null, 2));
  // The external supervisor owns the final wall-clock deadline if driver teardown stalls.
  app.exit(closed && !failed && !dropped && count > 0 && webgpuReady ? 0 : 2);
}
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.setPath('userData', path.join(output, 'profile'));
app.whenReady().then(async () => {
  record({ kind: 'versions', versions: process.versions, pid: process.pid });
  if (release) record({kind:'release',sourceHash:release.sourceHash,linkedHash:release.linked.linkedHash,settings:release.settings});
  const win = new BrowserWindow({ width: 1920, height: 1080, frame: false, useContentSize: true, show: false, transparent: true,
    webPreferences: { offscreen: { useSharedTexture: true }, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.setContentSize(1920, 1080);
  // Keep compositor begin-frames running while the worker initializes. Paints
  // are released below until the initial host control has been rendered.
  record({ kind: 'bounds', bounds: win.getContentBounds() });
  win.webContents.on('console-message', (details, _level, legacyMessage) => {
    const message = details.message ?? legacyMessage;
    if(typeof message==='string'&&message.includes('runtime-heartbeat')){
      try{const data=JSON.parse(message);if(data.kind==='runtime-heartbeat'){progress.observe(data.frameId,performance.now());if(!playback)record(data);return;}}catch{}
    }
    record({ kind: 'console', message });
    try {
      const value = JSON.parse(message);
      if (value.kind === 'failure') failure(value.reason);
      if (value.kind === 'webgpu' && value.backend === 'WebGPU' && value.width === 1920 && value.height === 1080) webgpuReady = true;
    } catch { /* Ordinary browser log messages are not worker protocol records. */ }
    if (details.level === 'error' || _level === 3) failure(message);
  });
  win.webContents.on('render-process-gone', (_event, details) => { failure(JSON.stringify(details)); finish(false); });
  win.webContents.on('paint', event => {
    if (!event.texture) { failure('paint without shared texture'); return; }
    if (release && !visualReady) { event.texture.release(); return; }
    const claim=frameGate?.consumePaint();
    if(frameGate&&!claim){event.texture.release();return;}
    if(frameGate)win.webContents.stopPainting();
    try {
      const result = session.submit(event.texture,claim??undefined);
      // A host that has stopped drawing can fill the receiver ring without a
      // failed visual. Only confirmed backpressure with no pending copy counts.
      if (result.drop === 'no-free-slot' && session.held.size === 0 && session.uncertain.size === 0) backpressureFrames++;
      count++;
      if (result.id && (result.width !== 1920 || result.height !== 1080)) failure('Unexpected output dimensions');
      if (count <= 10) record({ kind: 'paint', ...result, info: { ...event.texture.textureInfo, handle: 'borrowed-local-NT' } });
    } catch (error) { failure(error); }
  });
  pollTimer = setInterval(() => {
    try { for (const id of session.poll()) { completedFrames++; record({ kind: 'copy-complete', id }); } }
    catch (error) { failure(error); finish(false); }
  }, 1);
  win.webContents.setFrameRate(60);
  await win.loadFile(path.join(__dirname, release ? 'compiled-output.html' : 'output.html'));
  record({ kind: 'gpu', info: await app.getGPUInfo('complete') });
  const generic=release?.linked.linkedVersion===3;
  if(generic)bridge.configureControls(release.linked.controlSchemaHash,release.linked.controls.length);
  if (installed) bridge.advertise(installed.rendezvous); else bridge.advertise();
  let lastHostControl: number | undefined;
  let normalized=[];
  const executeDraw=async (script:string)=>{
    if(!frameGate)return win.webContents.executeJavaScript(script);
    if(!frameGate.begin())throw Error('Controlled draw already pending');
    win.webContents.stopPainting();
    const pinned=[...normalized];
    const result=await win.webContents.executeJavaScript(script);
    frameGate.acknowledge(result,pinned);
    record({kind:'worker-frame-claim',clock:bridge.clock(),...result,normalized:pinned,correlation:'producer-claim-unverified'});
    win.webContents.startPainting();win.webContents.invalidate();
    return result;
  };
  const startup = release ? new HostStartup({revisionId:release.sourceHash,
    ...(generic?{schema:release.linked.controls,schemaHash:release.linked.controlSchemaHash}:{}),
    init:value=>executeDraw('window.startVisual(' + JSON.stringify(release) + ',' + JSON.stringify(value) + ','+controlledFrames+')'),
    update:value=>executeDraw((generic?'window.setParameters(':'window.setIntensity(') + JSON.stringify(value) + ')'),
    observe:value=>record({kind:'host-control',value}), stopped:()=>session.stopping||finishing,
    promote:(initial,value)=>{
      record({kind:'initial-frame',controls:initial.controls,controlSchemaHash:initial.controlSchemaHash,sourceHash:release.sourceHash,frameId:initial.frameId,controlSequence:initial.controlSequence});
      visualReady=true;webgpuReady=true;progress.observe(initial.frameId,performance.now());win.webContents.startPainting();
      if(!playback&&!process.env.LUX_RESOLUME_PID)win.webContents.executeJavaScript('window.captureVisual()').then(capture=>{
        fs.writeFileSync(path.join(output,'worker.png'),Buffer.from(capture.bytes));record({kind:'capture',...capture.metadata});
      }).catch(error=>record({kind:'diagnostic-capture-error',reason:String(error)}));
    }}) : null;
  let applyingControl = false;
  controlTimer = setInterval(async () => {
    if (applyingControl || session.stopping || frameGate?.busy) return;
    applyingControl = true;
    try {
      const value = bridge.control();
      if (startup) {
        if(frameGate&&value!==null){normalized=[...value.values];record({kind:'producer-control-received',clock:bridge.clock(),hostSequence:value.sequence,schemaHash:value.schemaHash,normalized});}
        await startup.apply(value);
        if(frameGate&&startup.ready&&!frameGate.busy)await executeDraw('window.drawVisual()');
        return;
      }
      if (value === null) return;
      if (value !== lastHostControl) { record({ kind: 'host-control', value }); lastHostControl = value; }
      await win.webContents.executeJavaScript('window.setIntensity(' + value + ')');
    }
    catch (error) { failure(error); }
    finally { applyingControl = false; }
  }, controlledFrames?16:50);
  stopProducer = () => {
    if(session.stopping||finishing)return;
    session.stop(); win.webContents.stopPainting();
    clearInterval(endTimer);
    clearInterval(pollTimer); clearInterval(controlTimer);
    const deadline = performance.now() + 2000;
    pollTimer = setInterval(() => {
      try {
        if (session.drain()) finish(true);
        else if (performance.now() >= deadline) { failure('Shutdown deadline; outstanding ownership retained'); finish(false); }
      } catch (error) { failure(error); finish(false); }
    }, 10);
  };
  if(playback)endTimer=setInterval(()=>{
    if(installed){
      try {
        if(Date.now()-fs.statSync(installed.requestPath).mtimeMs>10000||Date.now()-fs.statSync(installed.supervisorReady).mtimeMs>10000){stopProducer();return;}
        process.kill(installed.hostPid,0);
      } catch {stopProducer();return;}
    }
    if(fs.existsSync(process.env.LUX_TRANSPORT_STOP))stopProducer();
    else if(visualReady&&progress.expired(performance.now()))failure('Visual worker stopped producing frames');
  },100);
  else endTimer=setTimeout(stopProducer,duration);
}).catch(error => { failure(error); finish(false); });
