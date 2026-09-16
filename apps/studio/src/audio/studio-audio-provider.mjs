import { normalizeAudioInputConfiguration, normalizeLocalAudioDeviceId } from './audio-contract.mjs';
import { createWebAudioBandAnalyzer } from './audio-analysis.mjs';

const freeze = Object.freeze;
const finite = Number.isFinite;

function zero(generation) {
  return freeze({ generation, sequence: 0, available: false, level: 0, bass: 0, mids: 0, highs: 0 });
}

function normalizeBands(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Reflect.ownKeys(input).length !== 4) {
    throw new Error('Invalid audio band sample');
  }
  const result = {};
  for (const name of ['level', 'bass', 'mids', 'highs']) {
    const value = Object.getOwnPropertyDescriptor(input, name);
    if (!value?.enumerable || !Object.hasOwn(value, 'value') || !finite(value.value) || value.value < 0 || value.value > 1) {
      throw new Error('Invalid audio band sample');
    }
    result[name] = value.value === 0 ? 0 : value.value;
  }
  return freeze(result);
}

async function cleanupCapture(capture, analyzer, detach = () => {}) {
  detach();
  try { analyzer?.dispose(); } catch { /* Continue releasing owned capture. */ }
  let tracks = [];
  try { tracks = capture?.stream?.getTracks?.() ?? []; } catch { /* Continue closing owned context. */ }
  for (const track of tracks) {
    try { track.stop(); } catch { /* Continue releasing remaining resources. */ }
  }
  try {
    if (capture?.context?.state !== 'closed' && typeof capture?.context?.close === 'function') await capture.context.close();
  } catch { /* Cleanup is best effort after the provider has published unavailable. */ }
}

export function createStudioAudioProvider(options) {
  if (!options || typeof options.openCapture !== 'function') throw new Error('Audio capture opener is required');
  const createAnalyzer = options.createAnalyzer ?? createWebAudioBandAnalyzer;
  const scheduler = options.scheduler;
  if (typeof createAnalyzer !== 'function' || !scheduler || typeof scheduler.request !== 'function' || typeof scheduler.cancel !== 'function') {
    throw new Error('Audio provider dependencies are invalid');
  }

  const listeners = new Set();
  let snapshot = zero(0), operation = 0, connecting = false, active = null, scheduled;
  let disposed = false;

  function publish(next) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function cancelSampling() {
    if (scheduled === undefined) return;
    scheduler.cancel(scheduled);
    scheduled = undefined;
  }

  function scheduleSampling() {
    if (scheduled !== undefined || !active || listeners.size === 0) return;
    scheduled = scheduler.request(() => {
      scheduled = undefined;
      const owner = active;
      if (!owner || listeners.size === 0) return;
      try {
        const bands = normalizeBands(owner.analyzer.sample());
        if (active !== owner) return;
        publish(freeze({ generation: owner.generation, sequence: snapshot.sequence + 1, available: true, ...bands }));
        scheduleSampling();
      } catch {
        void fail(owner);
      }
    });
  }

  async function fail(owner) {
    if (active !== owner) return;
    operation++;
    active = null;
    connecting = false;
    cancelSampling();
    publish(zero(snapshot.generation + 1));
    await cleanupCapture(owner.capture, owner.analyzer, owner.detach);
  }

  function attachFailureHandlers(owner) {
    const removals = [];
    const failed = () => { void fail(owner); };
    for (const track of owner.capture.stream.getTracks()) {
      if (typeof track.addEventListener === 'function') {
        track.addEventListener('ended', failed);
        removals.push(() => track.removeEventListener('ended', failed));
      }
    }
    const context = owner.capture.context;
    const contextChanged = () => { if (context.state === 'closed' || context.state === 'interrupted') failed(); };
    if (typeof context.addEventListener === 'function') {
      context.addEventListener('statechange', contextChanged);
      removals.push(() => context.removeEventListener('statechange', contextChanged));
    }
    return () => { for (const remove of removals) remove(); };
  }

  async function disconnectCurrent(nextGeneration) {
    const owner = active;
    active = null;
    connecting = false;
    cancelSampling();
    publish(zero(nextGeneration));
    if (owner) await cleanupCapture(owner.capture, owner.analyzer, owner.detach);
  }

  return freeze({
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new Error('Audio subscriber must be a function');
      listeners.add(listener);
      scheduleSampling();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) cancelSampling();
      };
    },
    async connect(input, deviceInput) {
      if (disposed) throw new Error('Audio provider is disposed');
      const configuration = normalizeAudioInputConfiguration(input);
      const localDeviceId = normalizeLocalAudioDeviceId(deviceInput);
      const key = JSON.stringify([configuration, localDeviceId]);
      if (active?.key === key) return;

      const token = ++operation;
      const generation = snapshot.generation + 1;
      connecting = true;
      const previous = active;
      active = null;
      cancelSampling();
      publish(zero(generation));
      if (previous) await cleanupCapture(previous.capture, previous.analyzer, previous.detach);
      if (token !== operation || disposed) return;

      let capture;
      try { capture = await options.openCapture({ configuration, localDeviceId }); }
      catch (error) {
        if (token === operation) connecting = false;
        if (token !== operation || disposed) return;
        throw error;
      }
      if (token !== operation || disposed) { await cleanupCapture(capture); return; }
      if (!capture?.stream || !capture?.context || typeof capture.stream.getTracks !== 'function') {
        await cleanupCapture(capture);
        connecting = false;
        throw new Error('Invalid audio capture');
      }

      let analyzer;
      try { analyzer = createAnalyzer(capture.context, capture.stream, configuration.analyzer); }
      catch (error) {
        await cleanupCapture(capture);
        if (token === operation) connecting = false;
        throw error;
      }
      if (token !== operation || disposed) { await cleanupCapture(capture, analyzer); return; }
      const owner = { key, generation, capture, analyzer, detach: () => {} };
      owner.detach = attachFailureHandlers(owner);
      active = owner;
      connecting = false;
      publish(freeze({ generation, sequence: 0, available: true, level: 0, bass: 0, mids: 0, highs: 0 }));
      scheduleSampling();
    },
    async disconnect() {
      if (!active && !connecting) return;
      operation++;
      await disconnectCurrent(snapshot.generation + 1);
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      operation++;
      if (active || connecting) await disconnectCurrent(snapshot.generation + 1);
      listeners.clear();
      cancelSampling();
    },
  });
}
