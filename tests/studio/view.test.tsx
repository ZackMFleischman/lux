import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudioApp } from '../../apps/studio/src/renderer.tsx';
import { createDisconnectedClient } from '../../apps/studio/src/service-client.ts';
import type { StudioClient, StudioSnapshot } from '../../apps/studio/src/service-client.ts';

test('default view shows unavailable output and disabled runtime controls rather than a demo', () => {
  const html = renderToStaticMarkup(<StudioApp client={createDisconnectedClient()} />);
  assert.match(html, /Awaiting runtime/);
  assert.match(html, /Reference output/);
  assert.match(html, /1920 × 1080/);
  assert.match(html, /disabled=""[^>]*aria-label="Play"/);
  assert.match(html, /Visual delivery[\s\S]*Unavailable/);
  assert.match(html, /UI cadence[\s\S]*Unavailable/);
  assert.doesNotMatch(html, /<canvas|<img|60 fps|demo scene/i);
});

test('connected view distinguishes actual zero measurement, stale coverage and host revision', () => {
  const snapshot: StudioSnapshot = {
    connection: 'connected', message: null, receivedAtMs: 1000,
    authoring: { instanceId: 'instance-1', generation: 2, revisionId: 'author-revision', sceneName: 'Scene', authority: 'studio',
      playback: 'paused', clockEpoch: 1, frameId: '81', intensity: 0.5, output: { width: 1920, height: 1080 },
      fault: { code: 'COMPILE_FAILED', message: 'Line 8: unknown symbol' } },
    host: { instanceId: 'host-1', revisionId: 'host-revision' }, jobs: [],
    visualFps: { value: 0, sampledAtMs: 1000, coverage: 0.75 }, uiFps: null,
  };
  const client: StudioClient = { getSnapshot: () => snapshot, subscribe: () => () => {}, invoke: async () => ({}) };
  const html = renderToStaticMarkup(<StudioApp client={client} nowMs={4000} />);
  assert.match(html, /0.0 fps/); assert.match(html, /75% coverage/); assert.match(html, /Stale/);
  assert.match(html, /host-revision/); assert.match(html, /author-revision/);
  assert.match(html, /COMPILE_FAILED/); assert.match(html, /Line 8: unknown symbol/);
});

test('status bar exposes current build, problem and runtime health as actionable labels', () => {
  let snapshot: StudioSnapshot = {
    connection: 'connected', message: null, receivedAtMs: 1000,
    authoring: { instanceId: 'instance-1', generation: 2, revisionId: 'author-revision', sceneName: 'Scene', authority: 'studio',
      playback: 'paused', clockEpoch: 1, frameId: '81', intensity: 0.5, output: { width: 1920, height: 1080 }, fault: null },
    host: null, jobs: [{ jobId: 'build-1', state: 'compiling', summary: 'Compiling visual…' }],
    visualFps: null, uiFps: null,
  };
  const client: StudioClient = { getSnapshot: () => snapshot, subscribe: () => () => {}, invoke: async () => ({}) };
  const html = renderToStaticMarkup(<StudioApp client={client} nowMs={1000} />);
  assert.match(html, /aria-label="Build status: Compiling visual…\. Open Jobs and diagnostics"/);
  assert.match(html, />Compiling visual…</);
  assert.match(html, /aria-label="Problems: 0\. Open Jobs and diagnostics"/);
  assert.match(html, />0 problems</);
  assert.doesNotMatch(html, /Runtime status:|playback-state|Service connected/);
  assert.doesNotMatch(html, />Paused<|>Playing</);
  assert.doesNotMatch(html, /Presentation only|TRACER 0\.1/);
  assert.match(html, /class="status-spinner"/);
  assert.match(html, /aria-busy="true"/);
  const stale = renderToStaticMarkup(<StudioApp client={client} nowMs={1000} sourceChanged />);
  assert.match(stale, /Source changed · Build to update/);
  for (const connection of ['connecting', 'disconnected'] as const) {
    const lost = { ...snapshot, connection };
    const errorHtml = renderToStaticMarkup(<StudioApp client={{ ...client, getSnapshot: () => lost }} nowMs={1000} />);
    assert.match(errorHtml, /Runtime status: (Connecting|Disconnected)/);
  }
  snapshot = { ...snapshot, jobs: [{ jobId: 'build-1', state: 'succeeded', summary: 'Visual is ready in Lux.' }] };
  const finished = renderToStaticMarkup(<StudioApp client={client} nowMs={1000} />);
  assert.doesNotMatch(finished, /class="status-spinner"/);
  assert.match(finished, />Build ready</);
});
