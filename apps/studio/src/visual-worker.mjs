import { encodeCapturedTarget } from './capture-png.mjs';
import { createInitializationProbe } from './initialization-probe.mjs';
// Generated modules run only in this dedicated browser worker. No Node or
// desktop bridge is exposed here. The parent owns termination and promotion.
import { RuntimeClock } from '../../../packages/runtime/src/clock.ts';
import { SeededRandom } from '../../../packages/runtime/src/seed.ts';
import {createSingleImageVisual,componentDisposer,captureComponentInstance} from '../../../packages/runtime/src/components/single-image.ts';
import {createImageCompositionVisual} from '../../../packages/runtime/src/components/image-chain.ts';
import {validateNestedGraph} from '../../../packages/runtime/src/graph/nested-validate.ts';
import {prepareGraphRuntimePlan} from '../../../packages/runtime/src/graph/runtime-plan.ts';
import { prepareAuthoredModule } from './authored-worker-assets.mjs';
import { prepareWorkerControlState } from './controls/worker-control-state.mjs';
import {prepareWorkerCompositionState} from './controls/worker-composition-state.mjs';
import { createFrameCollector } from '../../../packages/performance/live.mjs';
import { createGpuPassTimer } from '../../../packages/performance/gpu-pass.mjs';
import { collectionMode } from '../../../packages/performance/collection-mode.mjs';
const freeze=Object.freeze, RuntimeError=Error;
const createURL=URL.createObjectURL.bind(URL),revokeURL=URL.revokeObjectURL.bind(URL),RuntimeBlob=Blob;
const now=performance.now.bind(performance);
const post=postMessage.bind(globalThis);
let identity, renderer, device, visual, clock, random, settings, outputTarget, presentation;
let initializationProbe, material, componentBridge, compositionBridge, authoredCleanup, cleanupPromise, activeOperation;
let authoredDisposalAttempted=false,terminalError;
let controlState, frame = 0, tick = 0, lastTime = 0;
let drawStarted=0,scheduleEpoch=0;
let performanceMode='routine';
let stopped = false, externallyDriven=false, timer, heartbeat, telemetryTimer, collector, gpuTimer, gpuCapability, chain = Promise.resolve();
const send = (type, extra = {}) => post({ type, ...identity, ...extra });
function state() { const clockState=clock.snapshot();return { ...clockState, frameId: String(frame),...controlState.state(clockState.timeSeconds) }; }
function runOperation(operation) {
  // Device loss bypasses the command queue. Keep the current command's lifetime
  // separate from terminal cleanup so teardown can await it without awaiting itself.
  const pending=Promise.resolve().then(operation);
  activeOperation=pending;
  return pending.finally(()=>{if(activeOperation===pending)activeOperation=undefined;});
}
function requireRunning() { if(stopped)throw new RuntimeError('Worker stopped'); }
function terminalCleanup() {
  if(cleanupPromise)return cleanupPromise;
  stopped=true;clearTimeout(timer);clearInterval(heartbeat);clearInterval(telemetryTimer);
  initializationProbe?.cancel();initializationProbe=undefined;componentBridge?.invalidate();
  cleanupPromise=(async()=>{
    const diagnostics=[];
    const attempt=async(label,fn)=>{try{await fn?.();}catch(error){if(diagnostics.length<8)diagnostics.push(label+': '+String(error?.message||error).slice(0,200));}};
    if(activeOperation)await activeOperation.catch(()=>{});
    // Settlement failures must not authorize freeing an in-use target. Bridge
    // drain observes backend rejection; a rejected GPU barrier stops teardown.
    try{await componentBridge?.drain();if(device)await device.queue.onSubmittedWorkDone();}
    catch(error){send('cleanup',{complete:false,message:String(error?.message||error).slice(0,200)});return;}
    if(!authoredDisposalAttempted&&authoredCleanup){authoredDisposalAttempted=true;await attempt('authored',authoredCleanup);}
    await attempt('target',()=>outputTarget?.dispose());
    await attempt('material',()=>material?.dispose());
    await attempt('profiling',()=>gpuTimer?.dispose());
    await attempt('renderer',()=>renderer?.dispose());
    await attempt('device',()=>device?.destroy());
    if(diagnostics.length)send('cleanup',{complete:true,diagnostics});
  })();
  return cleanupPromise;
}
function failure(error, requestId) {
  if(!terminalError){terminalError=error;send('failure',{requestId,code:'RUNTIME_FAILED',message:String(error?.message||error).slice(0,2000)});}
  void terminalCleanup();
}
async function draw(requestId, type = 'frame') {
  requireRunning();
  drawStarted=now();
  const time = clock.snapshot();
  const profiling=performanceMode==='routine';
  if(profiling)gpuTimer.begin(frame+1);
  const updateStart=profiling?now():0;
  await visual.update(freeze({ tick: tick++, timeSeconds: time.timeSeconds,
    deltaSeconds: Math.max(0, time.timeSeconds - lastTime), controls: controlState.values(time.timeSeconds), events: freeze([]) }));
  requireRunning();
  const updateEnd=profiling?now():0;
  const renderResult=visual.render(freeze({ width: settings.width, height: settings.height, colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }));
  const renderCallEnd=profiling?now():0;
  const asynchronous=profiling&&renderResult != null && typeof renderResult.then === 'function';
  await renderResult;
  requireRunning();
  if(componentBridge||compositionBridge) presentation.render(renderer);
  const renderEnd=profiling?now():0;
  await device.queue.onSubmittedWorkDone();
  requireRunning();
  const completed=now();
  lastTime = time.timeSeconds; frame++;
  if(profiling){collector.record(completed,frame,updateEnd-updateStart,renderCallEnd-updateEnd,completed-renderEnd,asynchronous,renderEnd-renderCallEnd);gpuTimer.end();}
  else collector.record(completed,frame);
  send(type, { requestId, ...state(), timeSeconds: time.timeSeconds });
}
function schedule() {
  clearTimeout(timer);
  const epoch=++scheduleEpoch;
  if (stopped || externallyDriven || clock.snapshot().playback !== 'playing') return;
  // Start-to-start cadence includes update, async render and queue completion.
  // Every actual draw rebases the deadline, so slow work/late timers never build
  // a backlog of missed frames. Keep one asynchronous yield even when overdue.
  const delay=Math.max(0,drawStarted+1000/settings.fps-now());
  timer = setTimeout(() => { chain = chain.then(async () => {
    // clearTimeout cannot retract a callback already queued behind a command.
    if (!stopped && epoch===scheduleEpoch && clock.snapshot().playback==='playing') { await runOperation(()=>draw()); schedule(); }
  }).catch(failure); }, delay);
}
async function initialize(message) {
  identity = { instanceId: message.instanceId, generation: message.generation, revisionId: message.revisionId };
  externallyDriven=message.externallyDriven===true;
  performanceMode=collectionMode(message.performanceMode);
  settings = message.settings;
  if (!settings || !Number.isInteger(settings.width) || !Number.isInteger(settings.height) || settings.width < 1 || settings.width > 3840 || settings.height < 1 || settings.height > 2160 || settings.fps !== 60 ||
      !Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 0xffffffff) throw Error('Unsupported output settings');
  const prepared=await prepareAuthoredModule(message);
  controlState=prepared.admission.kind==='composition'?await prepareWorkerCompositionState(message,prepared.admission):await prepareWorkerControlState(message,prepared.admission);
  clock = new RuntimeClock(() => performance.now(), 'paused'); random = new SeededRandom(settings.seed);
  /*! lux-worker-liveness-v2: heartbeat starts before authored import/create. */
  let workerHeartbeat=0;
  const beat=()=>send('heartbeat', { frameId: String(frame),workerHeartbeat:++workerHeartbeat });
  heartbeat = setInterval(beat, 250);
  beat(); // Arm external worker liveness before any authored import/create runs.
  const {module,assets,images} = await prepared.import(async moduleSource => {
    const url = createURL(new RuntimeBlob([moduleSource], { type: 'text/javascript' }));
    try { return await import(url); } finally { revokeURL(url); }
  });
  const create=controlState.checkDefinition(module);
  if (!navigator.gpu) throw Error('WebGPU is unavailable');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw Error('No WebGPU adapter available');
  gpuCapability=freeze({timestampQuerySupported:typeof adapter.features?.has === 'function' ? adapter.features.has('timestamp-query') : null,timestampQueryEnabled:false});
  device = await adapter.requestDevice(performanceMode==='routine'&&gpuCapability.timestampQuerySupported?{requiredFeatures:['timestamp-query']}:{});
  gpuTimer=createGpuPassTimer(device,(frame,ms,complete)=>collector?.recordGpu(frame,ms,complete)??false,{mode:performanceMode});
  device.lost.then(info => { if (!stopped) failure(Error(`WebGPU device lost: ${info.message}`)); });
  renderer = new module.WebGPURenderer({ canvas: message.canvas, device, alpha: true, antialias: false });
  renderer.setSize(settings.width, settings.height, false); await renderer.init();
  requireRunning();
  if (!renderer.backend.isWebGPUBackend) throw Error('WebGPU backend required');
  outputTarget = new module.RenderTarget(settings.width, settings.height);
  outputTarget.texture.colorSpace = module.SRGBColorSpace;
  // This attachment stores E(premultiplied linear RGB). Sampling decodes it
  // back to linear. Pinned Three RenderOutputNode handles the screen boundary:
  // unpremultiply -> encode sRGB -> premultiply for the canvas compositor.
  // Do not premultiply this presentation material again.
  material = new module.MeshBasicNodeMaterial();
  material.fragmentNode = module.sampleTexture(outputTarget.texture);
  presentation = new module.QuadMesh(material);
  if (typeof message.initProbeId === 'string' && /^[a-f0-9]{32}$/.test(message.initProbeId)) {
    initializationProbe=createInitializationProbe({...identity,initProbeId:message.initProbeId},post);
    await initializationProbe.wait;
    initializationProbe=undefined;
    requireRunning();
  }
  const context={ settings: freeze({ ...settings }), assets, images,
    random: () => random.next(), reportError: value => { throw new RuntimeError(String(value)); } };
  if(prepared.admission.kind==='composition'){
    const profile=prepared.admission.composition,targets=new WeakMap(),compiledScenes=new WeakSet(),settlements=new Set(),descriptor={width:settings.width,height:settings.height};let staged,settlementFailure;
    const resources=freeze({async produce(output){const call=staged;staged=undefined;if(!call)throw new RuntimeError('Missing staged component render');const target=new module.RenderTarget(descriptor.width,descriptor.height);target.texture.colorSpace=module.SRGBColorSpace;targets.set(output,target);renderer.setRenderTarget(target);try{
      // Compile new pipelines asynchronously so a complex authored shader does
      // not block the worker heartbeat while the GPU driver prepares it.
      if(!compiledScenes.has(call.scene)){await renderer.compileAsync(call.scene,call.camera);compiledScenes.add(call.scene);}
      await renderer.render(call.scene,call.camera);
    }finally{renderer.setRenderTarget(null);}},release(image){const target=targets.get(image);if(!target)throw new RuntimeError('Missing component image allocation');targets.delete(image);const settled=device.queue.onSubmittedWorkDone().then(()=>target.dispose());settlements.add(settled);settled.then(()=>settlements.delete(settled),error=>{settlementFailure??=error;settlements.delete(settled);});},capture(){}});
    const backend=freeze({resources,stage(scene,camera){if(staged)throw new RuntimeError('Component render already staged');staged={scene,camera};},texture(image){const target=targets.get(image);if(!target)throw new RuntimeError('Missing component input image');return target.texture;},async present(image){const target=targets.get(image);if(!target)throw new RuntimeError('Missing final component image');const copyMaterial=new module.MeshBasicNodeMaterial();copyMaterial.fragmentNode=module.sampleTexture(target.texture);const copy=new module.QuadMesh(copyMaterial);renderer.setRenderTarget(outputTarget);try{copy.render(renderer);}finally{renderer.setRenderTarget(null);copyMaterial.dispose();}},async drain(){while(settlements.size)await Promise.allSettled([...settlements]);if(settlementFailure)throw settlementFailure;}});
    const plan=prepareGraphRuntimePlan(validateNestedGraph(profile.graph,profile.definitions));
    compositionBridge=await createImageCompositionVisual({plan,definitions:create,context:freeze(context),backend,
      nodeControls:(path,frame)=>controlState.nodeValues(path,frame.timeSeconds)});visual=compositionBridge;authoredCleanup=()=>compositionBridge.dispose();
  }else if(prepared.admission.kind==='component'){
    const instance=await create(freeze(context));
    authoredCleanup=componentDisposer(instance);
    const captured=captureComponentInstance(instance);
    componentBridge=createSingleImageVisual(captured,{width:settings.width,height:settings.height,async render(scene,camera){
      renderer.setRenderTarget(outputTarget);
      try{await renderer.render(scene,camera);}finally{renderer.setRenderTarget(null);}
    }});
    visual=componentBridge;authoredCleanup=()=>componentBridge.dispose();
  }else{
    visual=await create(freeze({...context,renderer:freeze({render:(scene,camera)=>{
      renderer.setRenderTarget(outputTarget);
      try{renderer.render(scene,camera);}finally{renderer.setRenderTarget(null);}
      presentation.render(renderer);
    }})}));
    // Legacy visuals support prototype methods with the visual as receiver.
    authoredCleanup=()=>visual?.dispose?.();
    for(const name of ['update','render','reset','dispose'])if(typeof visual?.[name]!=='function')throw new RuntimeError('Visual missing '+name);
  }
  if(stopped)throw new RuntimeError('Worker stopped during initialization');
  collector=createFrameCollector({startMs:now(),mode:performanceMode});
  telemetryTimer=setInterval(()=>{if (!stopped) send('performance',{summary:collector.summary(now(),{...gpuTimer.status(),timestampQuerySupported:gpuCapability.timestampQuerySupported})});},500);
  if (message.playing) clock.play();
  await draw(message.requestId, 'ready');
  schedule();
}
onmessage = event => {
  const message = event.data;
  // GO must bypass the initialization promise queued on chain.
  if (message?.type === 'init-probe-go') { if (!stopped) initializationProbe?.accept(message); return; }
  chain = chain.then(async () => {
    if(message?.type==='dispose'&&identity&&message.instanceId===identity.instanceId&&message.generation===identity.generation){await terminalCleanup();close();return;}
    return runOperation(async()=>{
    if (!identity && message?.type === 'init') return initialize(message);
    if (stopped || !identity || message.instanceId !== identity.instanceId || message.generation !== identity.generation) return;
    if (message.type === 'frame') {
      await draw(message.requestId,'frame'); schedule();
    } else if (message.type === 'controls') {
      controlState.apply(message.values,message.controlSequence,message.controlSchemaHash);
      await draw(message.requestId, 'status'); schedule();
    } else if (message.type === 'node-controls') {
      if(!controlState.applyNode)throw Error('This visual has no composition nodes');
      controlState.applyNode(message.nodePath,message.values,message.controlSequence,message.controlSchemaHash);
      await draw(message.requestId, 'status'); schedule();
    } else if(message.type==='animations'){
      if(!controlState.applyAnimations)throw Error('This visual cannot animate controls');
      controlState.applyAnimations(message.controlAnimations,message.animationSequence,clock.snapshot().timeSeconds);
      if(message.restart)controlState.restartAnimation(message.restart.nodePath,message.restart.controlId,clock.snapshot().timeSeconds);
      await draw(message.requestId,'status');schedule();
    } else if (message.type === 'playback') {
      if (!['play', 'pause', 'reset'].includes(message.action)) throw Error('Invalid playback command');
      clearTimeout(timer);
      if (message.action === 'reset') { clock.reset(); controlState.resetAnimations?.(0); random.reset(settings.seed); await visual.reset(settings.seed); lastTime = 0; tick = 0; }
      else clock[message.action]();
      await draw(message.requestId, 'status'); schedule();
    } else if (message.type === 'capture') {
      try {
        // Same completed output as presentation; no user-code rerender during
        // capture. The serialized execution queue pins it until encoding ends.
        const pixels = await renderer.readRenderTargetPixelsAsync(outputTarget, 0, 0, settings.width, settings.height);
        if(stopped)return;
        const png = encodeCapturedTarget(pixels, settings.width, settings.height);
        const bytes = png.slice().buffer;
        const metadata = { ...state(), timeSeconds: lastTime, width: settings.width, height: settings.height, seed: settings.seed, colorSpace: 'srgb', alphaMode: 'straight' };
        postMessage({ type: 'capture', ...identity, requestId: message.requestId, metadata, bytes }, [bytes]);
      } catch (error) { if(!stopped)send('capture-error', { requestId: message.requestId, message: String(error.message) }); }
    }
    });
  }).catch(error => failure(error, message?.requestId));
};
