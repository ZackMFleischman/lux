import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundtrackPlayer } from '../../apps/studio/src/soundtrack/soundtrack-player.ts';
import type { SoundtrackAudioContext, SoundtrackClockView } from '../../apps/studio/src/soundtrack/soundtrack-player.ts';

type FakeSource = { buffer: unknown; started: [number, number] | null; stopped: boolean; disconnected: boolean; connected: unknown;
  connect(target: unknown): void; start(when: number, offset: number): void; stop(): void; disconnect(): void };
/** Audio clock and performance clock advance together unless a test makes the audio slip. */
function fakeAudio() {
  const sources: FakeSource[] = [];
  const gain = { gain: { value: 1 }, connected: null as unknown, connect(target: unknown) { this.connected = target; } };
  const clocks = { nowMs: 50_000 };
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
  const advance = (seconds: number, audioSeconds = seconds) => { clocks.nowMs += seconds * 1000; context.currentTime += audioSeconds; };
  return { context, gain, sources, clocks, advance, active: () => sources.filter(source => source.started && !source.stopped) };
}
const clock = (patch: Partial<SoundtrackClockView> = {}): SoundtrackClockView =>
  ({ instanceId: 'runtime-a', generation: 1, clockEpoch: 0, playback: 'playing', timeSeconds: 0, ...patch });
function setup(duration = 300) {
  const audio = fakeAudio();
  const player = new SoundtrackPlayer({ createContext: () => audio.context as unknown as SoundtrackAudioContext, now: () => audio.clocks.nowMs });
  player.setBuffer({ duration });
  return { ...audio, player };
}
const near = (actual: number | null | undefined, expected: number, message?: string) =>
  assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) < 1e-6, message ?? `${actual} != ${expected}`);

test('play starts the song at scene time plus offset and pause stops it', () => {
  const { player, sources, active, context, gain, advance } = setup();
  player.update(clock({ playback: 'paused', timeSeconds: 0 }));
  assert.equal(sources.length, 0, 'paused runtime does not start audio');
  player.update(clock({ timeSeconds: 2 }));
  assert.equal(active().length, 1);
  near(sources[0]!.started![1], 2);
  assert.equal(sources[0]!.connected, gain);
  assert.equal(gain.connected, context.destination);
  assert.equal(context.resumes, 1, 'a suspended context resumes when playback starts');
  advance(1); player.update(clock({ timeSeconds: 2.99 }));
  assert.equal(sources.length, 1, 'small differences do not re-seek');
  near(player.status().driftSeconds, 0);
  near(player.status().positionSeconds, 3);
  player.update(clock({ playback: 'paused', timeSeconds: 3.01 }));
  assert.equal(active().length, 0);
  assert.equal(sources[0]!.stopped && sources[0]!.disconnected, true);
  assert.equal(player.status().playing, false);
  // Resume continues from the paused scene time, not from wall-clock time.
  advance(5); player.update(clock({ timeSeconds: 3.01 }));
  near(sources[1]!.started![1], 3.01);
});

test('reset (clock epoch change) and rebuild (new generation) restart from scene time', () => {
  const { player, sources, active, advance } = setup();
  player.update(clock({ timeSeconds: 40 }));
  advance(0.5); player.update(clock({ timeSeconds: 0.01, clockEpoch: 1 }));
  near(sources.at(-1)!.started![1], 0.01);
  assert.equal(active().length, 1);
  advance(3); player.update(clock({ timeSeconds: 3.01, clockEpoch: 1 }));
  assert.equal(sources.length, 2);
  player.update(clock({ timeSeconds: 0, clockEpoch: 0, generation: 2 }));
  near(sources.at(-1)!.started![1], 0);
  player.update(clock({ timeSeconds: 0.2, clockEpoch: 0, generation: 2, instanceId: 'runtime-b' }));
  assert.equal(sources.length, 4, 'a new runtime instance restarts the source');
  assert.equal(active().length, 1);
  player.update(null);
  assert.equal(active().length, 0, 'losing the runtime stops audio');
  player.update(clock({ playback: 'failed', timeSeconds: 1 }));
  assert.equal(active().length, 0);
});

test('late frames never re-seek; audio slipping beyond 50 ms on consecutive frames does', () => {
  const { player, sources, advance } = setup();
  player.update(clock({ timeSeconds: 10 }));
  for (let frame = 1; frame <= 30; frame++) {
    advance(1 / 60);
    // Frames sampled at scene time 10 + frame/60 arrive 0-90 ms late.
    player.update(clock({ timeSeconds: 10 + frame / 60 - (frame % 4) * 0.03 }));
  }
  assert.equal(sources.length, 1, 'arrival jitter is not drift');
  near(player.status().driftSeconds, 0);
  // The audio device stalls for 80 ms while scene time continues.
  advance(1 / 60, 1 / 60 - 0.08); player.update(clock({ timeSeconds: 10.5 + 1 / 60 }));
  assert.equal(sources.length, 1, 'one sample beyond tolerance waits for confirmation');
  advance(1 / 60); player.update(clock({ timeSeconds: 10.5 + 2 / 60 }));
  assert.equal(sources.length, 2);
  near(sources[1]!.started![1], 10.5 + 2 / 60);
  assert.equal(player.status().starts, 2);
  advance(1 / 60); player.update(clock({ timeSeconds: 10.5 + 3 / 60 }));
  near(player.status().driftSeconds, 0);
});

test('offset, volume and mute apply without changing scene playback', () => {
  const { player, sources, gain, advance } = setup(60);
  player.setSettings({ offsetSeconds: 12.5 });
  player.update(clock({ timeSeconds: 1 }));
  near(sources[0]!.started![1], 13.5);
  player.setSettings({ volume: 0.25 });
  assert.equal(gain.gain.value, 0.25);
  assert.equal(sources.length, 1, 'volume does not re-seek');
  player.setSettings({ muted: true });
  assert.equal(gain.gain.value, 0);
  assert.equal(player.status().playing, true, 'muted audio stays in sync');
  player.setSettings({ muted: false });
  assert.equal(gain.gain.value, 0.25);
  advance(1); player.setSettings({ offsetSeconds: 2 });
  near(sources[1]!.started![1], 4, 'offset change re-seeks immediately to offset + scene time now');
  advance(1); player.update(clock({ generation: 2, timeSeconds: 58.5 }));
  assert.equal(player.status().playing, false, 'past the end of the song plays nothing');
});

test('no buffer means no audio; removing the buffer stops the source', async () => {
  const audio = fakeAudio();
  const player = new SoundtrackPlayer({ createContext: () => audio.context as unknown as SoundtrackAudioContext, now: () => audio.clocks.nowMs });
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

test('position uses the extrapolated output timestamp and starts ahead by the output latency', () => {
  const audio = fakeAudio();
  let outputStamp = { contextTime: 99.96, performanceTime: 50_000 };
  const context = Object.assign(audio.context, { getOutputTimestamp: () => outputStamp });
  const player = new SoundtrackPlayer({ createContext: () => context as unknown as SoundtrackAudioContext, now: () => audio.clocks.nowMs });
  player.setBuffer({ duration: 300 });
  player.update(clock({ timeSeconds: 10 }));
  // currentTime 100 is processed now but heard 40 ms later: start 40 ms further into the song.
  assert.equal(audio.sources[0]!.started![0], 100);
  near(audio.sources[0]!.started![1], 10.04);
  near(player.status().outputLatencySeconds, 0.04);
  // currentTime advances in a 50 ms block; the heard position follows performance time smoothly.
  audio.clocks.nowMs += 30; context.currentTime = 100.05;
  player.update(clock({ timeSeconds: 10.03 }));
  near(player.status().driftSeconds, 0);
  audio.clocks.nowMs += 25; outputStamp = { contextTime: 100.01, performanceTime: audio.clocks.nowMs - 5 };
  player.update(clock({ timeSeconds: 10.055 }));
  near(player.status().driftSeconds, 0);
  assert.equal(audio.sources.length, 1, 'block-sized currentTime jumps do not cause re-seeks');
});

test('a start from a late frame settles to the timely scene estimate within the first second', () => {
  const { player, sources, advance } = setup();
  // The first playing frame arrives 35 ms after it was sampled; later frames arrive on time.
  player.update(clock({ timeSeconds: 5 }));
  advance(1 / 60); player.update(clock({ timeSeconds: 5.035 + 1 / 60 }));
  assert.equal(sources.length, 1);
  advance(1 / 60); player.update(clock({ timeSeconds: 5.035 + 2 / 60 }));
  assert.equal(sources.length, 2, 'two timely frames 35 ms ahead re-seek during settling');
  near(player.status().driftSeconds, 0);
  // After settling, the same 35 ms difference is within the 50 ms tolerance.
  for (let frame = 0; frame < 70; frame++) { advance(1 / 60); player.update(clock({ timeSeconds: 5.035 + (3 + frame) / 60 })); }
  advance(1 / 60, 1 / 60 - 0.035); player.update(clock({ timeSeconds: 5.035 + 73 / 60 }));
  advance(1 / 60); player.update(clock({ timeSeconds: 5.035 + 74 / 60 }));
  assert.equal(sources.length, 2);
});
