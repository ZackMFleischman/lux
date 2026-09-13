// Generated modules run only in this dedicated browser worker. No Node or
// desktop bridge is exposed here. The parent owns termination and promotion.
import { RuntimeClock } from '../../../packages/runtime/src/clock.ts';
import { SeededRandom } from '../../../packages/runtime/src/seed.ts';
import { loadAuthoredModule } from './authored-worker-assets.mjs';
import { prepareWorkerControlState } from './controls/worker-control-state.mjs';
import { createFrameCollector } from '../../../packages/performance/live.mjs';
const freeze=Object.freeze;
const now=performance.now.bind(performance);
const post=postMessage.bind(globalThis);
let identity, renderer, device, visual, clock, random, settings, outputTarget, presentation;
let controlState, frame = 0, tick = 0, lastTime = 0;
let stopped = false, timer, heartbeat, telemetryTimer, collector, gpuCapability, chain = Promise.resolve();
const send = (type, extra = {}) => post({ type, ...identity, ...extra });
function state() { return { ...clock.snapshot(), frameId: String(frame),...controlState.state() }; }
function failure(error, requestId) {
  stopped = true; clearTimeout(timer); clearInterval(heartbeat); clearInterval(telemetryTimer);
  send('failure', { requestId, code: 'RUNTIME_FAILED', message: String(error?.message || error).slice(0, 2000) });
}
async function draw(requestId, type = 'frame') {
  const time = clock.snapshot();
  const updateStart=now();
  visual.update(freeze({ tick: tick++, timeSeconds: time.timeSeconds,
    deltaSeconds: Math.max(0, time.timeSeconds - lastTime), controls: controlState.values(), events: freeze([]) }));
  const updateEnd=now();
  const renderResult=visual.render(freeze({ width: settings.width, height: settings.height, colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }));
  const renderCallEnd=now();
  const asynchronous=renderResult != null && typeof renderResult.then === 'function';
  await renderResult;
  const renderEnd=now();
  await device.queue.onSubmittedWorkDone();
  const completed=now();
  lastTime = time.timeSeconds; frame++;
  collector.record(completed,frame,updateEnd-updateStart,renderCallEnd-updateEnd,completed-renderEnd,asynchronous,renderEnd-renderCallEnd);
  send(type, { requestId, ...state(), timeSeconds: time.timeSeconds });
}
function schedule() {
  clearTimeout(timer);
  if (stopped || clock.snapshot().playback !== 'playing') return;
  timer = setTimeout(() => { chain = chain.then(async () => { if (!stopped) { await draw(); schedule(); } }).catch(failure); }, 1000 / settings.fps);
}
async function initialize(message) {
  identity = { instanceId: message.instanceId, generation: message.generation, revisionId: message.revisionId };
  settings = message.settings;
  if (!settings || settings.width !== 1920 || settings.height !== 1080 || settings.fps !== 60 ||
      !Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 0xffffffff) throw Error('Unsupported output settings');
  controlState=await prepareWorkerControlState(message);
  clock = new RuntimeClock(() => performance.now(), 'paused'); random = new SeededRandom(settings.seed);
  heartbeat = setInterval(() => send('heartbeat', { frameId: String(frame) }), 250);
  const {module,assets} = await loadAuthoredModule(message, async moduleSource => {
    const url = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }));
    try { return await import(url); } finally { URL.revokeObjectURL(url); }
  });
  const create=controlState.checkDefinition(module);
  if (!navigator.gpu) throw Error('WebGPU is unavailable');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw Error('No WebGPU adapter available');
  gpuCapability=freeze({timestampQuerySupported:typeof adapter.features?.has === 'function' ? adapter.features.has('timestamp-query') : null,timestampQueryEnabled:false});
  device = await adapter.requestDevice();
  device.lost.then(info => { if (!stopped) failure(Error(`WebGPU device lost: ${info.message}`)); });
  renderer = new module.WebGPURenderer({ canvas: message.canvas, device, alpha: true, antialias: false });
  renderer.setSize(settings.width, settings.height, false); await renderer.init();
  if (!renderer.backend.isWebGPUBackend) throw Error('WebGPU backend required');
  outputTarget = new module.RenderTarget(settings.width, settings.height);
  outputTarget.texture.colorSpace = module.SRGBColorSpace;
  const material = new module.MeshBasicNodeMaterial();
  material.fragmentNode = module.sampleTexture(outputTarget.texture);
  presentation = new module.QuadMesh(material);
  visual = await create(freeze({ settings: freeze({ ...settings }), assets,
    random: () => random.next(), reportError: value => { throw Error(String(value)); },
    renderer: freeze({ render: (scene, camera) => {
      renderer.setRenderTarget(outputTarget); renderer.render(scene, camera);
      renderer.setRenderTarget(null); presentation.render(renderer);
    } }) }));
  for (const name of ['update', 'render', 'reset', 'dispose']) if (typeof visual?.[name] !== 'function') throw Error(`Visual missing ${name}`);
  collector=createFrameCollector({startMs:now()});
  telemetryTimer=setInterval(()=>{if (!stopped) send('performance',{summary:collector.summary(now(),gpuCapability)});},500);
  if (message.playing) clock.play();
  await draw(message.requestId, 'ready');
  schedule();
}
onmessage = event => {
  const message = event.data;
  chain = chain.then(async () => {
    if (!identity && message?.type === 'init') return initialize(message);
    if (stopped || !identity || message.instanceId !== identity.instanceId || message.generation !== identity.generation) return;
    if (message.type === 'controls') {
      controlState.apply(message.values,message.controlSequence,message.controlSchemaHash);
      await draw(message.requestId, 'status'); schedule();
    } else if (message.type === 'playback') {
      if (!['play', 'pause', 'reset'].includes(message.action)) throw Error('Invalid playback command');
      clearTimeout(timer);
      if (message.action === 'reset') { clock.reset(); random.reset(settings.seed); await visual.reset(settings.seed); lastTime = 0; tick = 0; }
      else clock[message.action]();
      await draw(message.requestId, 'status'); schedule();
    } else if (message.type === 'capture') {
      try {
        // Same completed output as presentation; no user-code rerender during
        // capture. The serialized execution queue pins it until encoding ends.
        const pixels = await renderer.readRenderTargetPixelsAsync(outputTarget, 0, 0, settings.width, settings.height);
        const image = new OffscreenCanvas(settings.width, settings.height);
        image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength), settings.width, settings.height), 0, 0);
        const blob = await image.convertToBlob({ type: 'image/png' });
        if (blob.size > 8388608) throw Error('Capture exceeds 8 MiB');
        const bytes = await blob.arrayBuffer();
        const metadata = { ...state(), timeSeconds: lastTime, width: settings.width, height: settings.height, seed: settings.seed, colorSpace: 'srgb', alphaMode: 'straight' };
        postMessage({ type: 'capture', ...identity, requestId: message.requestId, metadata, bytes }, [bytes]);
      } catch (error) { send('capture-error', { requestId: message.requestId, message: String(error.message) }); }
    } else if (message.type === 'dispose') {
      stopped = true; clearTimeout(timer); clearInterval(heartbeat); clearInterval(telemetryTimer); await visual.dispose(); outputTarget.dispose(); presentation.material.dispose(); renderer.dispose(); device.destroy(); close();
    }
  }).catch(error => failure(error, message?.requestId));
};
