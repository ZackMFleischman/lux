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
import { prepareAuthoredModule,prepareAuthoredGenerationFactories } from './authored-worker-assets.mjs';
import {prepareAuthoredSharedModules} from './authored-shared-modules.mjs';
import {verifySharedVisualsStructure} from '../../build-worker/src/shared-link-identity.mjs';
import {createStoryWorkerResourcePorts} from './story/story-worker-resource-ports.mjs';
import {createStoryWorkerGeneration} from './story/story-worker-generation.mjs';
import {createStoryCompositor} from './controls/story-compositor.mjs';
import { prepareWorkerControlState } from './controls/worker-control-state.mjs';
import {prepareWorkerCompositionState} from './controls/worker-composition-state.mjs';
import {createTempoClock} from './controls/tempo-clock.mjs';
import {createTriggerLedger} from './controls/trigger-ledger.mjs';
import {createStoryTransport} from './controls/story-transport.mjs';
import { createFrameCollector } from '../../../packages/performance/live.mjs';
import { createGpuPassTimer } from '../../../packages/performance/gpu-pass.mjs';
import { collectionMode } from '../../../packages/performance/collection-mode.mjs';
const freeze=Object.freeze, RuntimeError=Error,stringify=JSON.stringify,arrayIncludes=Function.prototype.call.bind(Array.prototype.includes),max=Math.max,ceil=Math.ceil,define=Object.defineProperty,RuntimeMap=Map,mapGet=Function.prototype.call.bind(Map.prototype.get),mapSet=Function.prototype.call.bind(Map.prototype.set),mapDelete=Function.prototype.call.bind(Map.prototype.delete);
const storyError=(code,message)=>{const error=new RuntimeError(message);define(error,'code',{value:code,enumerable:true});return error;};
const scenePath=freeze([]);
const createURL=URL.createObjectURL.bind(URL),revokeURL=URL.revokeObjectURL.bind(URL),RuntimeBlob=Blob;
const digest=crypto.subtle.digest.bind(crypto.subtle),RuntimeTextEncoder=TextEncoder;
async function hashBytes(bytes){const hash=new Uint8Array(await digest('SHA-256',bytes));return Array.from(hash,byte=>byte.toString(16).padStart(2,'0')).join('');}
const now=performance.now.bind(performance);
const post=postMessage.bind(globalThis);
let identity, renderer, device, visual, clock, tempoClock, random, settings, outputTarget, presentation;
let initializationProbe, material, componentBridge, compositionBridge, authoredCleanup, cleanupPromise, activeOperation;
let authoredDisposalAttempted=false,terminalError;
let controlState, frame = 0, tick = 0, lastTime = 0;
let triggerSequence=0,latestTriggerReceipt,activeTrigger,storyTransport,admittedStoryHash;
let storyMode=false,storyReady=false,storyGeneration,storyResourcePorts,storySharedModules,storyFactories,storyCompositor;const storyPendingCommands=new RuntimeMap(),storyFailedCommands=new RuntimeMap();
const triggerLedger=createTriggerLedger();
const storyLedger=createTriggerLedger(),normalStoryFrame=freeze({state:'normal',storyEpoch:0});
let drawStarted=0,scheduleEpoch=0;
let performanceMode='routine';
let stopped = false, externallyDriven=false, timer, heartbeat, telemetryTimer, collector, gpuTimer, gpuCapability, chain = Promise.resolve();
const send = (type, extra = {}) => post({ type, ...identity, ...extra });
function state(sample) { const clockState=sample??clock.snapshot(),tempo=tempoClock.snapshot(clockState.timeSeconds);if(storyGeneration)return { ...clockState,tempo,tempoSequence:tempo.tempoSequence,frameId:String(frame),triggerSequence,...(latestTriggerReceipt?{latestTriggerReceipt}:{}),storySchedule:storyGeneration.status(clockState.timeSeconds,clockState.playback==='playing'),visualStates:storyGeneration.visualStates(clockState.timeSeconds)};return { ...clockState, tempo,tempoSequence:tempo.tempoSequence, frameId: String(frame),...controlState.state(clockState.timeSeconds,tempo.beatPosition),triggerSequence,...(latestTriggerReceipt?{latestTriggerReceipt}:{}),...(storyTransport?{story:storyTransport.status(clockState.timeSeconds,clockState.playback==='playing')}:{}) }; }
function runOperation(operation) {
  // Device loss bypasses the command queue. Keep the current command's lifetime
  // separate from terminal cleanup so teardown can await it without awaiting itself.
  const pending=Promise.resolve().then(operation);
  activeOperation=pending;
  return pending.finally(()=>{if(activeOperation===pending)activeOperation=undefined;});
}
function requireRunning() { if(stopped)throw new RuntimeError('Worker stopped'); }
function terminalCleanup(requestId) {
  if(cleanupPromise)return cleanupPromise;
  stopped=true;clearTimeout(timer);clearInterval(heartbeat);clearInterval(telemetryTimer);
  initializationProbe?.cancel();initializationProbe=undefined;componentBridge?.invalidate();
  cleanupPromise=(async()=>{
    const diagnostics=[];
    const attempt=async(label,fn)=>{try{await fn?.();}catch(error){if(diagnostics.length<8)diagnostics.push(label+': '+String(error?.message||error).slice(0,200));}};
    if(activeOperation)await activeOperation.catch(()=>{});
    if(storyMode){
      try{
        let result;if(storyGeneration)result=await storyGeneration.dispose();else{await storyCompositor?.dispose();await storySharedModules?.dispose();await storyFactories?.dispose();result={disposition:'settled'};}
        if(device)await device.queue.onSubmittedWorkDone();await renderer?.dispose?.();if(device)await device.queue.onSubmittedWorkDone();device?.destroy?.();storyResourcePorts?.close();
        const resources=storyGeneration?storyGeneration.status(clock?.snapshot?.().timeSeconds??0).resources:storyPartialResources();
        const settled=storyResourcesSettled(resources);send('story-cleanup',{requestId,disposition:result.disposition==='settled'&&settled?'settled':'unreclaimed',resources});
      }catch(error){storyResourcePorts?.close();const resources=storyGeneration?storyGeneration.status(clock?.snapshot?.().timeSeconds??0).resources:storyPartialResources();send('story-cleanup',{requestId,disposition:'unreclaimed',resources,diagnostics:[String(error?.message||error).slice(0,500)]});}
      return;
    }
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
function storyPartialResources(){const assets=storyFactories?.status?.().assetResources??{},modules=storySharedModules?.status?.()??{},storyTargetBytes=storyCompositor?.status?.().storyTargetBytes??0;return freeze({slots:0,slotStates:freeze({preparing:0,ready:0,active:0,retiring:0,unsettled:0}),pendingCreates:0,assetLeases:assets.leaseCount??0,assetLeaseBytes:assets.assetLeaseBytes??0,assetStagingJobs:assets.pendingStagingJobs??0,assetStagingBytes:assets.assetStagingBytes??0,storyTargetBytes,pendingImports:modules.pendingImports??0,ownedModuleURLs:modules.ownedModuleURLs??0,pendingCallbacks:0,gpuSubmissions:0,readbackGrants:0,readbackBytes:0});}
function storyResourcesSettled(resources){return resources.slots===0&&resources.pendingCreates===0&&resources.assetLeases===0&&resources.assetLeaseBytes===0&&resources.assetStagingJobs===0&&resources.assetStagingBytes===0&&resources.storyTargetBytes===0&&resources.pendingImports===0&&resources.ownedModuleURLs===0&&resources.pendingCallbacks===0&&resources.gpuSubmissions===0&&resources.readbackGrants===0&&resources.readbackBytes===0&&resources.slotStates.preparing===0&&resources.slotStates.ready===0&&resources.slotStates.active===0&&resources.slotStates.retiring===0&&resources.slotStates.unsettled===0;}
function failure(error, requestId) {
  if(!terminalError){terminalError=error;send('failure',{requestId,code:'RUNTIME_FAILED',message:String(error?.message||error).slice(0,2000)});}
  void terminalCleanup();
}
async function draw(requestId, type = 'frame',extra = {},trigger,storyCommand,clockSample) {
  if(storyGeneration)return drawStory(requestId,type,extra,clockSample);
  requireRunning();
  drawStarted=now();
  const time = clockSample??clock.snapshot();storyTransport?.beginFrame(time.timeSeconds);const tempo=tempoClock.snapshot(time.timeSeconds),storyFrame=storyTransport?.frame(time.timeSeconds)??normalStoryFrame;
  const profiling=performanceMode==='routine';
  if(profiling)gpuTimer.begin(frame+1);
  const updateStart=profiling?now():0;
  const triggerEvent=trigger?.event,events=triggerEvent&&trigger.target.nodePath.length===0?freeze([triggerEvent]):freeze([]);activeTrigger=trigger;
  await visual.update(freeze({ tick: tick++, timeSeconds: time.timeSeconds,
    deltaSeconds: (triggerEvent||storyCommand)&&time.playback==='paused'?0:max(0, time.timeSeconds - lastTime), controls: controlState.values(time.timeSeconds,tempo.beatPosition), events,
    story:storyFrame,sampleControl:(controlId,instanceKey)=>controlState.sample(scenePath,controlId,instanceKey,time.timeSeconds,tempo.beatPosition) }));
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
  storyTransport?.completeFrame(time.timeSeconds);let triggerReceipt,storyReceipt;
  if(trigger){triggerReceipt=freeze({result:'applied',commandId:trigger.event.commandId,controlId:trigger.target.controlId,nodePath:trigger.target.nodePath,sequence:trigger.event.sequence,frameId:String(frame),timeSeconds:time.timeSeconds});triggerLedger.complete(trigger.entry,triggerReceipt);latestTriggerReceipt=triggerReceipt;}
  if(storyCommand){const story=storyTransport.status(time.timeSeconds,time.playback==='playing');storyReceipt=freeze({result:'applied',commandId:storyCommand.commandId,action:storyCommand.action,storyRevision:story.storyRevision,frameId:String(frame),timeSeconds:time.timeSeconds,story:story.frame});storyLedger.complete(storyCommand.entry,storyReceipt);}
  activeTrigger=undefined;
  if(profiling){collector.record(completed,frame,updateEnd-updateStart,renderCallEnd-updateEnd,completed-renderEnd,asynchronous,renderEnd-renderCallEnd);gpuTimer.end();}
  else collector.record(completed,frame);
  send(type, { requestId, ...state(time), timeSeconds: time.timeSeconds,...extra,...(triggerReceipt?{triggerReceipt}:{}),...(storyReceipt?{storyReceipt,storyCommandKey:storyCommand.payloadKey}:{}) });
  return triggerReceipt??storyReceipt;
}
async function drawStory(requestId,type='frame',extra={},clockSample){
  requireRunning();drawStarted=now();const time=clockSample??clock.snapshot(),completed=now();
  const result=await storyGeneration.draw(time.timeSeconds,String(frame+1),time.playback==='playing');requireRunning();frame=Number(result.frameId);lastTime=time.timeSeconds;
  collector?.record(completed,frame);send(type,{requestId,...state(time),timeSeconds:time.timeSeconds,...extra});return result;
}
function schedule() {
  clearTimeout(timer);
  const epoch=++scheduleEpoch;
  if (stopped || externallyDriven || clock.snapshot().playback !== 'playing') return;
  // Start-to-start cadence includes update, async render and queue completion.
  // Every actual draw rebases the deadline, so slow work/late timers never build
  // a backlog of missed frames. Keep one asynchronous yield even when overdue.
  const delay=max(0,drawStarted+1000/settings.fps-now());
  timer = setTimeout(() => { chain = chain.then(async () => {
    // clearTimeout cannot retract a callback already queued behind a command.
    if (!stopped && epoch===scheduleEpoch && clock.snapshot().playback==='playing') { await runOperation(()=>draw()); schedule(); }
  }).catch(failure); }, delay);
}
async function initialize(message) {
  identity = { instanceId: message.instanceId, generation: message.generation, revisionId: message.revisionId,...(message.manifest?{scheduleHash:message.scheduleHash,capsuleHash:message.capsuleHash}:{}) };
  externallyDriven=message.externallyDriven===true;
  performanceMode=collectionMode(message.performanceMode);
  settings = message.settings;
  if (!settings || !Number.isInteger(settings.width) || !Number.isInteger(settings.height) || settings.width < 1 || settings.width > 3840 || settings.height < 1 || settings.height > 2160 || settings.fps !== 60 ||
      !Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 0xffffffff) throw Error('Unsupported output settings');
  if(message.manifest){
    storyMode=true;
    const storyIdentity=freeze({instanceId:message.instanceId,generation:message.generation,scheduleHash:message.scheduleHash,capsuleHash:message.capsuleHash});
    const grant=message.reservationGrant;
    if(!grant||grant.identity?.instanceId!==storyIdentity.instanceId||grant.identity?.generation!==storyIdentity.generation||grant.identity?.scheduleHash!==storyIdentity.scheduleHash||grant.identity?.capsuleHash!==storyIdentity.capsuleHash||grant.width!==settings.width||grant.height!==settings.height||grant.maxSlots!==2||grant.maxPendingCreates!==1||grant.storyTargetBytes!==24*settings.width*settings.height||grant.assetLeaseBytes!==6291456)throw new RuntimeError('Invalid Story generation reservation grant');
    externallyDriven=message.externallyDriven===true;performanceMode=collectionMode(message.performanceMode);
    clock=new RuntimeClock(()=>performance.now(),'paused');tempoClock=createTempoClock({nowMs:now,bpm:message.tempo?.bpm??120,tempoSequence:message.tempoSequence??0});random=new SeededRandom(settings.seed);
    let workerHeartbeat=0;const beat=()=>send('heartbeat',{frameId:String(frame),workerHeartbeat:++workerHeartbeat});heartbeat=setInterval(beat,250);beat();
    storyResourcePorts=createStoryWorkerResourcePorts(storyIdentity,post);
    const capsule=await verifySharedVisualsStructure(message.sharedCapsule,hashBytes);
    if(capsule.capsuleHash!==storyIdentity.capsuleHash)throw new RuntimeError('Story shared capsule identity mismatch');
    storyFactories=await prepareAuthoredGenerationFactories({identity:storyIdentity,capsule,manifest:message.manifest,initialVisualStates:message.visualStates},{broker:storyResourcePorts.broker,decoder:storyResourcePorts.decoder});
    const preparation=storyFactories.preparation;
    storySharedModules=await prepareAuthoredSharedModules(capsule,{admittedCapsule:capsule});
    const sharedRuntime=await storySharedModules.importRuntime(),R=sharedRuntime.WebGPU,T=sharedRuntime.TSL;
    if(!navigator.gpu)throw new RuntimeError('WebGPU is unavailable');const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new RuntimeError('No WebGPU adapter available');
    gpuCapability=freeze({timestampQuerySupported:typeof adapter.features?.has==='function'?adapter.features.has('timestamp-query'):null,timestampQueryEnabled:false});device=await adapter.requestDevice();
    device.lost.then(info=>{if(!stopped)failure(new RuntimeError(`WebGPU device lost: ${info.message}`));});
    renderer=new R.WebGPURenderer({canvas:message.canvas,device,alpha:true,antialias:false});renderer.setSize(settings.width,settings.height,false);renderer.setClearColor(0x000000,0);await renderer.init();requireRunning();if(!renderer.backend.isWebGPUBackend)throw new RuntimeError('WebGPU backend required');
    storyCompositor=createStoryCompositor({WebGPU:R,TSL:T,renderer,device,width:settings.width,height:settings.height});
    collector=createFrameCollector({startMs:now(),mode:performanceMode});
    const preparedReceipt=receipt=>{
      if(receipt.commandId===null){frame=Number(receipt.frameId);return;}
      const pending=mapGet(storyPendingCommands,receipt.commandId);if(!pending)return;mapDelete(storyPendingCommands,receipt.commandId);frame=Number(receipt.frameId);
      const current=storyGeneration.status(receipt.timeSeconds),storyReceipt=freeze({result:'applied',commandId:receipt.commandId,action:pending.action,storyRevision:current.storyRevision,frameId:receipt.frameId,timeSeconds:receipt.timeSeconds,story:current.committed?.frame??normalStoryFrame});
      storyLedger.complete(pending.entry,storyReceipt);send('status',{requestId:pending.requestId,...state(freeze({...clock.snapshot(),timeSeconds:receipt.timeSeconds})),storyReceipt,storyCommandKey:pending.payloadKey});
    };
      const preparationError=(error,preparation)=>{const pending=preparation.commandId?mapGet(storyPendingCommands,preparation.commandId):undefined;if((error?.code==='STORY_CLEANUP_FAILED'||error?.code==='STORY_POST_COMMIT_FAILED')&&storyReady){if(pending)mapDelete(storyPendingCommands,preparation.commandId);failure(error,pending?.requestId);return;}if(pending){mapDelete(storyPendingCommands,preparation.commandId);const failureResult=freeze({payloadKey:pending.payloadKey,code:typeof error?.code==='string'?error.code:'STORY_PREPARATION_FAILED',message:String(error?.message||error).slice(0,500)});mapSet(storyFailedCommands,preparation.commandId,failureResult);send('command-error',{requestId:pending.requestId,code:failureResult.code,message:failureResult.message});}if(storyReady){const sample=clock.snapshot();send('status',{...state(sample),timeSeconds:sample.timeSeconds});}};
    const intermediateFrame=result=>{frame=Number(result.frameId);lastTime=result.timeSeconds;send('status',{...state(freeze({...clock.snapshot(),timeSeconds:result.timeSeconds})),timeSeconds:result.timeSeconds});};
    storyGeneration=createStoryWorkerGeneration({identity:storyIdentity,manifest:preparation.manifest,initialVisualStates:preparation.initialVisualStates,factories:storyFactories,sharedModules:storySharedModules,renderer,device,compositor:storyCompositor,settings,tempoClock,sampleTime:()=>clock.snapshot().timeSeconds,onPreparedReceipt:preparedReceipt,onIntermediateFrame:intermediateFrame,onError:preparationError});
    storyGeneration.audio(message.audioSnapshot??{generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0},{playing:false,timeSeconds:0});
    await storyGeneration.initialize(0);requireRunning();storyReady=true;frame=1;if(message.playing)clock.play();send('ready',{requestId:message.requestId,...state(),timeSeconds:clock.snapshot().timeSeconds});schedule();return;
  }
  const prepared=await prepareAuthoredModule(message);
  controlState=prepared.admission.kind==='composition'?await prepareWorkerCompositionState(message,prepared.admission):await prepareWorkerControlState(message,prepared.admission);
  controlState.applyAudioSnapshot(message.audioSnapshot??{generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0},{playing:false,timeSeconds:0});
  clock = new RuntimeClock(() => performance.now(), 'paused');tempoClock=createTempoClock({nowMs:now,bpm:message.tempo?.bpm??120,tempoSequence:message.tempoSequence??0}); random = new SeededRandom(settings.seed);
  storyTransport=prepared.admission.kind==='story'&&prepared.admission.story?createStoryTransport(prepared.admission.story,prepared.admission.storyCapability,prepared.admission.storyHash):undefined;
  admittedStoryHash=prepared.admission.kind==='story'?prepared.admission.storyHash:undefined;
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
      nodeControls:(path,frame)=>controlState.nodeValues(path,frame.timeSeconds,tempoClock.snapshot(frame.timeSeconds).beatPosition),
      nodeSampleControl:(path,controlId,instanceKey,frame)=>controlState.sample(path,controlId,instanceKey,frame.timeSeconds,tempoClock.snapshot(frame.timeSeconds).beatPosition),
      nodeEvents:path=>activeTrigger&&stringify(path)===stringify(activeTrigger.target.nodePath)?freeze([activeTrigger.event]):freeze([])});visual=compositionBridge;authoredCleanup=()=>compositionBridge.dispose();
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
  // Story asset verification/preparation runs while initialization is pending.
  // Resource responses must bypass the serialized command chain or admission
  // would wait behind itself.
  if(message?.type==='story-resource-response'&&storyResourcePorts?.accept(message))return;
  chain = chain.then(async () => {
    if(message?.type==='dispose'&&identity&&message.instanceId===identity.instanceId&&message.generation===identity.generation){await terminalCleanup(message.requestId);close();return;}
    return runOperation(async()=>{
    if (!identity && message?.type === 'init') return initialize(message);
    if (stopped || !identity || message.instanceId !== identity.instanceId || message.generation !== identity.generation) return;
    if (message.type === 'frame') {
      await draw(message.requestId,'frame'); schedule();
    } else if (message.type === 'controls') {
      if(storyGeneration){storyGeneration.controls(message);await draw(message.requestId,'status');schedule();return;}
      controlState.apply(message.values,message.controlSequence,message.controlSchemaHash);
      await draw(message.requestId, 'status'); schedule();
    } else if (message.type === 'node-controls') {
      if(!controlState.applyNode)throw Error('This visual has no composition nodes');
      controlState.applyNode(message.nodePath,message.values,message.controlSequence,message.controlSchemaHash);
      await draw(message.requestId, 'status'); schedule();
    } else if(message.type==='animations'){
      if(storyGeneration){storyGeneration.animations(message,clock.snapshot().timeSeconds);await draw(message.requestId,'status');schedule();return;}
      if(!controlState.applyAnimations)throw Error('This visual cannot animate controls');
      controlState.applyAnimations(message.controlAnimations,message.animationSequence,clock.snapshot().timeSeconds);
      if(message.restart)controlState.restartAnimation(message.restart.nodePath,message.restart.controlId,clock.snapshot().timeSeconds);
      await draw(message.requestId,'status');schedule();
    } else if(message.type==='audio'){
      const audioClock=clock.snapshot();if(storyGeneration)storyGeneration.audio(message.audioSnapshot,{playing:audioClock.playback==='playing',timeSeconds:audioClock.timeSeconds});else controlState.applyAudioSnapshot(message.audioSnapshot,{playing:audioClock.playback==='playing',timeSeconds:audioClock.timeSeconds});
      send('audio-ack',{providerGeneration:message.audioSnapshot.generation,sampleSequence:message.audioSnapshot.sequence});
    } else if(message.type==='tempo'){
      const time=clock.snapshot().timeSeconds;
      const acknowledgement=message.action==='set'?tempoClock.setBpm(message.bpm,time):message.action==='tap'?tempoClock.tap(time):message.action==='synchronize'?tempoClock.synchronize(message.bpm,message.tempoSequence,time):undefined;
      if(!acknowledgement)throw Error('Invalid tempo command');
      await draw(message.requestId,'status',acknowledgement.tempoResult?{tempoResult:acknowledgement.tempoResult}:{});schedule();
    } else if(message.type==='trigger'){
      if(storyGeneration){
        let target,targetKey;
        try{
          if(typeof message.commandId!=='string'||message.commandId.length<1||message.commandId.length>100)throw new RuntimeError('Invalid trigger command ID');
          targetKey=stringify([message.visualId,message.activationId,message.controlId]);const existing=triggerLedger.lookup(message.commandId,targetKey);
          if(existing){if(!existing.receipt)throw new RuntimeError('Trigger command is still pending');send('status',{requestId:message.requestId,...state(),triggerReceipt:existing.receipt});return;}
          if(!triggerLedger.hasCapacity())throw new RuntimeError('Trigger command ledger is full; restart runtime');target={input:{visualId:message.visualId,activationId:message.activationId,controlId:message.controlId,commandId:message.commandId,sequence:triggerSequence+1}};
        }catch(error){send('command-error',{requestId:message.requestId,code:'TRIGGER_REJECTED',message:String(error?.message||error).slice(0,500)});return;}
        const time=clock.snapshot();let drawn;try{drawn=await storyGeneration.triggerAndDraw(target.input,time.timeSeconds,time.playback==='playing');}catch(error){if(error?.code==='TRIGGER_DRAW_FAILED')throw error;send('command-error',{requestId:message.requestId,code:'TRIGGER_REJECTED',message:String(error?.message||error).slice(0,500)});return;}target=drawn.target;frame=Number(drawn.result.frameId);lastTime=time.timeSeconds;triggerSequence=target.event.sequence;const entry=triggerLedger.begin(message.commandId,targetKey).entry;
        const triggerReceipt=freeze({result:'applied',commandId:message.commandId,visualId:message.visualId,activationId:message.activationId,controlId:target.target.controlId,nodePath:scenePath,sequence:target.event.sequence,frameId:String(frame),timeSeconds:time.timeSeconds});triggerLedger.complete(entry,triggerReceipt);latestTriggerReceipt=triggerReceipt;
        send('status',{requestId:message.requestId,...state(time),triggerReceipt});schedule();return;
      }
      let target,entry;
      try{
        if(typeof message.commandId!=='string'||message.commandId.length<1||message.commandId.length>100)throw Error('Invalid trigger command ID');
        target=controlState.resolveTrigger(message.nodePath??scenePath,message.controlId);const targetKey=stringify([target.nodePath,target.controlId]),admitted=triggerLedger.begin(message.commandId,targetKey);entry=admitted.entry;
        if(admitted.duplicate){if(!entry.receipt)throw Error('Trigger command is still pending');send('status',{requestId:message.requestId,...state(),triggerReceipt:entry.receipt});return;}
      }catch(error){send('command-error',{requestId:message.requestId,code:'TRIGGER_REJECTED',message:String(error?.message||error).slice(0,500)});return;}
      const event=freeze({type:'trigger',controlId:target.controlId,commandId:message.commandId,sequence:++triggerSequence});
      await draw(message.requestId,'status',{},freeze({target,event,entry}));schedule();
    } else if(message.type==='story-transport'){
      if(storyGeneration){
        let payloadKey,entry,decision;
        try{
          if(typeof message.commandId!=='string'||message.commandId.length<1||message.commandId.length>100)throw storyError('INVALID_COMMAND_ID','Invalid Story command ID');
          payloadKey=stringify({expectedRevisionId:message.expectedRevisionId,expectedStoryHash:message.expectedStoryHash,expectedStoryRevision:message.expectedStoryRevision,action:message.action,
            ...(arrayIncludes(['launch','replay','loop'],message.action)?{beatId:message.beatId}:{}),...(arrayIncludes(['start','resume'],message.action)&&message.occurrenceId!==undefined?{occurrenceId:message.occurrenceId}:{}),...(message.action==='set-auto-advance'?{enabled:message.enabled}:{}),...(message.action==='seek'?{localTimeSeconds:message.localTimeSeconds}:{})});
          const failed=mapGet(storyFailedCommands,message.commandId);if(failed){if(failed.payloadKey!==payloadKey)throw storyError('STORY_REJECTED','Story command ID was already used for another target');send('command-error',{requestId:message.requestId,code:failed.code,message:failed.message});return;}
          const existing=storyLedger.lookup(message.commandId,payloadKey);if(existing){if(!existing.receipt)throw storyError('STORY_PENDING','Story command is still pending');send('status',{requestId:message.requestId,...state(),storyReceipt:existing.receipt,storyCommandKey:payloadKey,storyCommandDuplicate:true});return;}
          const current=storyGeneration.status(clock.snapshot().timeSeconds);if(message.expectedRevisionId!==identity.revisionId||message.expectedStoryHash!==current.storyHash||message.expectedStoryRevision!==current.storyRevision)throw storyError('STORY_CHANGED','Story target changed; read current status');
          if(!storyLedger.hasCapacity())throw storyError('STORY_LEDGER_FULL','Story command ledger is full; restart runtime');
          const time=clock.snapshot();decision=storyGeneration.command(message,time.timeSeconds);entry=storyLedger.begin(message.commandId,payloadKey).entry;
          if(decision.result==='preparing'){mapSet(storyPendingCommands,message.commandId,freeze({entry,requestId:message.requestId,action:message.action,payloadKey}));schedule();return;}
          const drawn=await storyGeneration.draw(time.timeSeconds,String(frame+1),time.playback==='playing');frame=Number(drawn.frameId);lastTime=time.timeSeconds;const status=storyGeneration.status(time.timeSeconds,time.playback==='playing'),storyReceipt=freeze({result:'applied',commandId:message.commandId,action:message.action,storyRevision:status.storyRevision,frameId:String(frame),timeSeconds:time.timeSeconds,story:status.committed?.frame??normalStoryFrame});storyLedger.complete(entry,storyReceipt);
          send('status',{requestId:message.requestId,...state(time),storyReceipt,storyCommandKey:payloadKey});schedule();return;
        }catch(error){if(entry)throw error;send('command-error',{requestId:message.requestId,code:typeof error?.code==='string'?error.code:'STORY_REJECTED',message:String(error?.message||error).slice(0,500),...(error?.candidates?{candidates:error.candidates}:{})});return;}
      }
      let admitted;
      try{
        if(!storyTransport)throw storyError('STORY_UNAVAILABLE','This visual has no active Story definition');
        if(typeof message.commandId!=='string'||message.commandId.length<1||message.commandId.length>100)throw storyError('INVALID_COMMAND_ID','Invalid Story command ID');
        const payloadKey=stringify({expectedRevisionId:message.expectedRevisionId,expectedStoryHash:message.expectedStoryHash,expectedStoryRevision:message.expectedStoryRevision,action:message.action,
          ...(arrayIncludes(['launch','replay','loop'],message.action)?{beatId:message.beatId}:{}),...(arrayIncludes(['start','resume'],message.action)&&message.occurrenceId!==undefined?{occurrenceId:message.occurrenceId}:{}),
          ...(message.action==='set-auto-advance'?{enabled:message.enabled}:{}),...(message.action==='seek'?{localTimeSeconds:message.localTimeSeconds}:{})});
        const existing=storyLedger.lookup(message.commandId,payloadKey);
        if(existing){if(!existing.receipt)throw storyError('STORY_PENDING','Story command is still pending');send('status',{requestId:message.requestId,...state(),storyReceipt:existing.receipt,storyCommandKey:payloadKey,storyCommandDuplicate:true});return;}
        if(message.expectedRevisionId!==identity.revisionId||message.expectedStoryHash!==admittedStoryHash)throw storyError('STORY_CHANGED','Story target changed; read current status');
        if(!storyLedger.hasCapacity())throw storyError('STORY_LEDGER_FULL','Story command ledger is full; restart runtime');
        const time=clock.snapshot();storyTransport.apply(message,time.timeSeconds);const ledgerAdmission=storyLedger.begin(message.commandId,payloadKey);
        admitted=freeze({entry:ledgerAdmission.entry,commandId:message.commandId,action:message.action,payloadKey,time});
      }catch(error){send('command-error',{requestId:message.requestId,code:typeof error?.code==='string'?error.code:'STORY_REJECTED',message:String(error?.message||error).slice(0,500),...(error?.candidates?{candidates:error.candidates}:{})});return;}
      await draw(message.requestId,'status',{},undefined,admitted,admitted.time);schedule();
    } else if (message.type === 'playback') {
      if (!arrayIncludes(['play', 'pause', 'reset'],message.action)) throw Error('Invalid playback command');
      clearTimeout(timer);
      if(storyGeneration){
        if(message.action==='reset'){clock.reset();tempoClock.reset(0);await storyGeneration.reset(0);lastTime=0;tick=0;}
        else clock[message.action]();
        await draw(message.requestId,'status');schedule();return;
      }
      if (message.action === 'reset') { clock.reset();tempoClock.reset(0); controlState.resetAnimations?.(0);storyTransport?.reset(0); random.reset(settings.seed); await visual.reset(settings.seed); lastTime = 0; tick = 0; }
      else {if(message.action==='pause')controlState.fenceAudioEvents?.();clock[message.action]();}
      await draw(message.requestId, 'status'); schedule();
    } else if (message.type === 'render-frame') {
      // Offline rendering (render pool): seek to an exact time, draw once and
      // return the encoded frame in one round trip. Does not touch playback.
      if(storyGeneration)throw new RuntimeError('Story scenes cannot be rendered offline yet');
      const timeSeconds=Number(message.timeSeconds);
      if(!Number.isFinite(timeSeconds)||timeSeconds<0)throw new RuntimeError('Invalid frame time');
      await draw(undefined,'status',{},undefined,undefined,freeze({...clock.snapshot(),playback:'paused',timeSeconds}));
      const pixels=await renderer.readRenderTargetPixelsAsync(outputTarget,0,0,settings.width,settings.height);
      if(stopped)return;
      const png=encodeCapturedTarget(pixels,settings.width,settings.height),bytes=png.slice().buffer;
      postMessage({type:'frame-png',...identity,requestId:message.requestId,timeSeconds,bytes},[bytes]);
    } else if (message.type === 'capture') {
      try {
        if(storyGeneration){
          const grant=message.readbackGrant;if(!grant||grant.identity?.instanceId!==identity.instanceId||grant.identity?.generation!==identity.generation||grant.identity?.scheduleHash!==identity.scheduleHash||grant.identity?.capsuleHash!==identity.capsuleHash||grant.requestId!==message.requestId||typeof grant.grantId!=='string')throw new RuntimeError('Story capture requires a valid readback grant');
          const expected=(settings.height-1)*ceil(settings.width*4/256)*256+settings.width*4;if(grant.readbackBytes!==expected)throw new RuntimeError('Story readback grant size mismatch');
          try{const pixels=await storyGeneration.capture();if(stopped)return;const png=encodeCapturedTarget(pixels,settings.width,settings.height),bytes=png.slice().buffer,{triggerSequence:_triggerSequence,latestTriggerReceipt:_latestTriggerReceipt,storySchedule:_storySchedule,...persistentState}=state();send('story-readback-release',{grantId:grant.grantId});postMessage({type:'capture',...identity,requestId:message.requestId,metadata:{...persistentState,timeSeconds:lastTime,width:settings.width,height:settings.height,seed:settings.seed,colorSpace:'srgb',alphaMode:'straight'},bytes},[bytes]);}
          catch(error){send('story-readback-release',{grantId:grant.grantId});send('capture-error',{requestId:message.requestId,message:String(error?.message||error)});}return;
        }
        // Same completed output as presentation; no user-code rerender during
        // capture. The serialized execution queue pins it until encoding ends.
        const pixels = await renderer.readRenderTargetPixelsAsync(outputTarget, 0, 0, settings.width, settings.height);
        if(stopped)return;
        const png = encodeCapturedTarget(pixels, settings.width, settings.height);
        const bytes = png.slice().buffer;
        const {triggerSequence:_triggerSequence,latestTriggerReceipt:_latestTriggerReceipt,story:_story,...persistentState}=state();
        const metadata = { ...persistentState, timeSeconds: lastTime, width: settings.width, height: settings.height, seed: settings.seed, colorSpace: 'srgb', alphaMode: 'straight' };
        postMessage({ type: 'capture', ...identity, requestId: message.requestId, metadata, bytes }, [bytes]);
      } catch (error) { if(!stopped)send('capture-error', { requestId: message.requestId, message: String(error.message) }); }
    }
    });
  }).catch(error => failure(error, message?.requestId));
};
