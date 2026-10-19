import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundtrackPlayer } from '../../apps/studio/src/soundtrack/soundtrack-player.ts';
import type { SoundtrackAudioContext, SoundtrackClockView } from '../../apps/studio/src/soundtrack/soundtrack-player.ts';

type FakeSource = { buffer: unknown; started: [number, number] | null; stopped: boolean; disconnected: boolean; connected: unknown;
  connect(target: unknown): void; start(when: number, offset: number): void; stop(): void; disconnect(): void };
function fakeAudio() {
  const sources: FakeSource[] = [];
  const gain = { gain: { value: 1 }, connected: null as unknown, connect(target: unknown) { this.connected = target; } };
  const context = {
    currentTime: 100, state: 'suspended' as string, destination: { kind: 'destination' }, resumes: 0,
    async resume() { this.resumes++; this.state = 'running'; },
    createGain: () => gain,
    createBufferSource: () => {
      const source: FakeSource = { buffer: null, started: null, stopped: false, disconnected: false, connected: null,
        connect(target) { this.connected = target; }, start(when, offset) { this.started = [when, offset]; },
        stop() { this.stopped = true; }, disconnect() { this.disconnected = true; } };
      sources.push(source); return source;
    },
    decodeAudioData: async (data: ArrayBuffer) => ({ duration: data.byteLength }),
  };
  return { context, gain, sources, active: () => sources.filter(source => source.started && !source.stopped) };
}
const clock = (patch: Partial<SoundtrackClockView> = {}): SoundtrackClockView =>
  ({ instanceId: 'runtime-a', generation: 1, clockEpoch: 0, playback: 'playing', timeSeconds: 0, ...patch });
function setup(duration = 300) {
  const audio = fakeAudio();
  const player = new SoundtrackPlayer({ createContext: () => audio.context as unknown as SoundtrackAudioContext });
  player.setBuffer({ duration });
  return { ...audio, player };
}

test('play starts the song at scene time plus offset and pause stops it', () => {
  const { player, sources, active, context, gain } = setup();
  player.update(clock({ playback: 'paused', timeSeconds: 0 }));
  assert.equal(sources.length, 0, 'paused runtime does not start audio');
  player.update(clock({ timeSeconds: 2 }));
  assert.equal(active().length, 1);
  assert.deepEqual(sources[0]!.started, [0, 2]);
  assert.equal(sources[0]!.connected, gain);
  assert.equal(gain.connected, context.destination);
  assert.equal(context.resumes, 1, 'a suspended context resumes when playback starts');
  context.currentTime += 1; player.update(clock({ timeSeconds: 3.01 }));
  assert.equal(sources.length, 1, 'small differences do not re-seek');
  assert.ok(Math.abs(player.status().driftSeconds! + 0.01) < 1e-9);
  player.update(clock({ playback: 'paused', timeSeconds: 3.01 }));
  assert.equal(active().length, 0);
  assert.equal(sources[0]!.stopped && sources[0]!.disconnected, true);
  assert.equal(player.status().playing, false);
  // Resume continues from the paused scene time.
  context.currentTime += 5; player.update(clock({ timeSeconds: 3.01 }));
  assert.deepEqual(sources[1]!.started, [0, 3.01]);
});

test('reset (clock epoch change) and rebuild (new generation) restart from scene time', () => {
  const { player, sources, active, context } = setup();
  player.update(clock({ timeSeconds: 40 }));
  context.currentTime += 0.5; player.update(clock({ timeSeconds: 0.01, clockEpoch: 1 }));
  assert.deepEqual(sources.at(-1)!.started, [0, 0.01]);
  assert.equal(active().length, 1);
  context.currentTime += 3; player.update(clock({ timeSeconds: 3, clockEpoch: 1 }));
  assert.equal(sources.length, 2);
  player.update(clock({ timeSeconds: 0, clockEpoch: 0, generation: 2 }));
  assert.deepEqual(sources.at(-1)!.started, [0, 0]);
  player.update(clock({ timeSeconds: 0.2, clockEpoch: 0, generation: 2, instanceId: 'runtime-b' }));
  assert.equal(sources.length, 4, 'a new runtime instance restarts the source');
  assert.equal(active().length, 1);
  player.update(null);
  assert.equal(active().length, 0, 'losing the runtime stops audio');
  player.update(clock({ playback: 'failed', timeSeconds: 1 }));
  assert.equal(active().length, 0);
});

test('drift beyond 50 ms on consecutive frames re-seeks; a single late frame does not', () => {
  const { player, sources, context } = setup();
  player.update(clock({ timeSeconds: 10 }));
  context.currentTime += 1; player.update(clock({ timeSeconds: 11.2 }));
  assert.equal(sources.length, 1, 'one outlier does not re-seek');
  context.currentTime += 0.016; player.update(clock({ timeSeconds: 11.016 }));
  assert.equal(sources.length, 1, 'a good sample clears the outlier');
  context.currentTime += 0.016; player.update(clock({ timeSeconds: 11.132 }));
  context.currentTime += 0.016; player.update(clock({ timeSeconds: 11.148 }));
  assert.equal(sources.length, 2);
  assert.deepEqual(sources[1]!.started, [0, 11.148]);
  assert.equal(player.status().starts, 2);
});

test('offset, volume and mute apply without changing scene playback', () => {
  const { player, sources, gain, context } = setup(60);
  player.setSettings({ offsetSeconds: 12.5 });
  player.update(clock({ timeSeconds: 1 }));
  assert.deepEqual(sources[0]!.started, [0, 13.5]);
  player.setSettings({ volume: 0.25 });
  assert.equal(gain.gain.value, 0.25);
  assert.equal(sources.length, 1, 'volume does not re-seek');
  player.setSettings({ muted: true });
  assert.equal(gain.gain.value, 0);
  assert.equal(player.status().playing, true, 'muted audio stays in sync');
  player.setSettings({ muted: false });
  assert.equal(gain.gain.value, 0.25);
  context.currentTime += 1; player.setSettings({ offsetSeconds: 2 });
  assert.deepEqual(sources[1]!.started, [0, 3], 'offset change re-seeks immediately');
  player.update(clock({ timeSeconds: 58.5 }));
  assert.equal(player.status().playing, false, 'past the end of the song plays nothing');
});

test('no buffer means no audio; removing the buffer stops the source', async () => {
  const audio = fakeAudio();
  const player = new SoundtrackPlayer({ createContext: () => audio.context as unknown as SoundtrackAudioContext });
  player.update(clock({ timeSeconds: 1 }));
  assert.equal(audio.sources.length, 0);
  const decoded = await player.decode(new Uint8Array(42));
  assert.equal(decoded.duration, 42);
  player.setBuffer(decoded);
  assert.equal(audio.active().length, 1, 'a buffer linked while playing starts at the current scene time');
  player.setLink('song.mp3', 'loaded');
  let notified = 0; player.subscribe(() => notified++);
  player.setBuffer(null);
  assert.equal(audio.active().length, 0);
  assert.equal(notified, 1);
  assert.equal(player.status().file, 'song.mp3');
});
