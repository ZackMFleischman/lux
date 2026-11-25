// packages/runtime/src/clock.ts
var RuntimeClock = class {
  nowMs;
  playback;
  accumulatedMs = 0;
  anchorMs = 0;
  lastSampleMs = 0;
  epoch = 0;
  constructor(nowMs, initialPlayback = "paused") {
    if (typeof nowMs !== "function") throw TypeError("An injected monotonic clock is required");
    if (initialPlayback !== "paused" && initialPlayback !== "playing") throw TypeError("Invalid initial playback state");
    this.nowMs = nowMs;
    this.playback = initialPlayback;
    this.anchorMs = this.sample();
  }
  snapshot() {
    return this.at(this.sample());
  }
  play() {
    const now = this.sample();
    if (this.playback === "paused") {
      this.anchorMs = now;
      this.playback = "playing";
    }
    return this.at(now);
  }
  pause() {
    const now = this.sample();
    if (this.playback === "playing") {
      this.accumulatedMs += now - this.anchorMs;
      this.playback = "paused";
    }
    return this.at(now);
  }
  reset() {
    const now = this.sample();
    if (this.epoch === Number.MAX_SAFE_INTEGER) throw RangeError("Clock epoch exhausted; a new runtime generation is required");
    this.accumulatedMs = 0;
    this.anchorMs = now;
    this.epoch++;
    return this.at(now);
  }
  sample() {
    const now = this.nowMs();
    if (!Number.isFinite(now) || now < this.lastSampleMs || now > Number.MAX_SAFE_INTEGER) {
      throw RangeError("Monotonic clock must provide finite nonnegative nondecreasing milliseconds within the safe range");
    }
    this.lastSampleMs = now;
    return now;
  }
  at(now) {
    const elapsed = this.accumulatedMs + (this.playback === "playing" ? now - this.anchorMs : 0);
    return Object.freeze({ playback: this.playback, timeSeconds: elapsed / 1e3, clockEpoch: this.epoch });
  }
};

// packages/runtime/src/seed.ts
var SeededRandom = class {
  seed;
  state;
  constructor(seed) {
    this.seed = this.validate(seed);
    this.state = this.seed;
  }
  next() {
    this.state = this.state + 1831565813 >>> 0;
    let value = this.state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }
  reset(seed = this.seed) {
    const validated = this.validate(seed);
    this.seed = validated;
    this.state = validated;
  }
  validate(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw RangeError("Seed must be an unsigned 32-bit integer");
    return seed;
  }
};

// apps/studio/src/visual-worker.mjs
var identity;
var renderer;
var device;
var visual;
var clock;
var random;
var settings;
var outputTarget;
var presentation;
var controls = { intensity: 0.5 };
var sequence = 0;
var frame = 0;
var tick = 0;
var lastTime = 0;
var stopped = false;
var timer;
var heartbeat;
var chain = Promise.resolve();
var send = (type, extra = {}) => postMessage({ type, ...identity, ...extra });
function state() {
  return { ...clock.snapshot(), frameId: String(frame), controlSequence: sequence, intensity: controls.intensity };
}
function failure(error, requestId) {
  stopped = true;
  clearTimeout(timer);
  clearInterval(heartbeat);
  send("failure", { requestId, code: "RUNTIME_FAILED", message: String(error?.message || error).slice(0, 2e3) });
}
async function draw(requestId, type = "frame") {
  const time = clock.snapshot();
  visual.update(Object.freeze({
    tick: tick++,
    timeSeconds: time.timeSeconds,
    deltaSeconds: Math.max(0, time.timeSeconds - lastTime),
    controls: Object.freeze({ ...controls }),
    events: Object.freeze([])
  }));
  await visual.render(Object.freeze({ width: settings.width, height: settings.height, colorSpace: "linear-srgb", alphaMode: "premultiplied" }));
  await device.queue.onSubmittedWorkDone();
  lastTime = time.timeSeconds;
  frame++;
  send(type, { requestId, ...state(), timeSeconds: time.timeSeconds });
}
function schedule() {
  clearTimeout(timer);
  if (stopped || clock.snapshot().playback !== "playing") return;
  timer = setTimeout(() => {
    chain = chain.then(async () => {
      if (!stopped) {
        await draw();
        schedule();
      }
    }).catch(failure);
  }, 1e3 / settings.fps);
}
async function initialize(message) {
  identity = { instanceId: message.instanceId, generation: message.generation, revisionId: message.revisionId };
  settings = message.settings;
  if (!settings || settings.width !== 1920 || settings.height !== 1080 || settings.fps !== 60 || !Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 4294967295) throw Error("Unsupported output settings");
  if (typeof message.moduleSource !== "string" || message.moduleSource.length > 16777216) throw Error("Invalid linked module");
  if (!Number.isFinite(message.controls?.intensity) || message.controls.intensity < 0 || message.controls.intensity > 1) throw Error("Invalid intensity");
  controls = { intensity: message.controls.intensity };
  clock = new RuntimeClock(() => performance.now(), "paused");
  random = new SeededRandom(settings.seed);
  heartbeat = setInterval(() => send("heartbeat", { frameId: String(frame) }), 250);
  const url = URL.createObjectURL(new Blob([message.moduleSource], { type: "text/javascript" }));
  let module;
  try {
    module = await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  if (module.default?.sdkVersion !== "0.1.0" || typeof module.default.create !== "function") throw Error("Invalid visual definition");
  if (!navigator.gpu) throw Error("WebGPU is unavailable");
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw Error("No WebGPU adapter available");
  device = await adapter.requestDevice();
  device.lost.then((info) => {
    if (!stopped) failure(Error(`WebGPU device lost: ${info.message}`));
  });
  renderer = new module.WebGPURenderer({ canvas: message.canvas, device, alpha: true, antialias: false });
  renderer.setSize(settings.width, settings.height, false);
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) throw Error("WebGPU backend required");
  outputTarget = new module.RenderTarget(settings.width, settings.height);
  outputTarget.texture.colorSpace = module.SRGBColorSpace;
  const material = new module.MeshBasicNodeMaterial();
  material.fragmentNode = module.sampleTexture(outputTarget.texture);
  presentation = new module.QuadMesh(material);
  visual = await module.default.create(Object.freeze({
    settings: Object.freeze({ ...settings }),
    assets: /* @__PURE__ */ new Map(),
    random: () => random.next(),
    reportError: (value) => {
      throw Error(String(value));
    },
    renderer: Object.freeze({ render: (scene, camera) => {
      renderer.setRenderTarget(outputTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      presentation.render(renderer);
    } })
  }));
  for (const name of ["update", "render", "reset", "dispose"]) if (typeof visual?.[name] !== "function") throw Error(`Visual missing ${name}`);
  await draw(message.requestId, "ready");
  if (message.playing) {
    clock.play();
    schedule();
  }
}
onmessage = (event) => {
  const message = event.data;
  chain = chain.then(async () => {
    if (!identity && message?.type === "init") return initialize(message);
    if (stopped || !identity || message.instanceId !== identity.instanceId || message.generation !== identity.generation) return;
    if (message.type === "controls") {
      if (!Number.isSafeInteger(message.controlSequence) || message.controlSequence <= sequence || !Number.isFinite(message.values?.intensity) || message.values.intensity < 0 || message.values.intensity > 1) throw Error("Invalid control snapshot");
      controls = { intensity: message.values.intensity };
      sequence = message.controlSequence;
      await draw(message.requestId, "status");
      schedule();
    } else if (message.type === "playback") {
      if (!["play", "pause", "reset"].includes(message.action)) throw Error("Invalid playback command");
      clearTimeout(timer);
      if (message.action === "reset") {
        clock.reset();
        random.reset(settings.seed);
        await visual.reset(settings.seed);
        lastTime = 0;
        tick = 0;
      } else clock[message.action]();
      await draw(message.requestId, "status");
      schedule();
    } else if (message.type === "capture") {
      try {
        const pixels = await renderer.readRenderTargetPixelsAsync(outputTarget, 0, 0, settings.width, settings.height);
        const image = new OffscreenCanvas(settings.width, settings.height);
        image.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength), settings.width, settings.height), 0, 0);
        const blob = await image.convertToBlob({ type: "image/png" });
        if (blob.size > 8388608) throw Error("Capture exceeds 8 MiB");
        const bytes = await blob.arrayBuffer();
        const metadata = { ...state(), timeSeconds: lastTime, width: settings.width, height: settings.height, seed: settings.seed, colorSpace: "srgb", alphaMode: "straight" };
        postMessage({ type: "capture", ...identity, requestId: message.requestId, metadata, bytes }, [bytes]);
      } catch (error) {
        send("capture-error", { requestId: message.requestId, message: String(error.message) });
      }
    } else if (message.type === "dispose") {
      stopped = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      await visual.dispose();
      outputTarget.dispose();
      presentation.material.dispose();
      renderer.dispose();
      device.destroy();
      close();
    }
  }).catch((error) => failure(error, message?.requestId));
};
