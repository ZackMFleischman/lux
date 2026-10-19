/** Plays a decoded soundtrack in lock-step with the visual runtime clock.
 * Scene time is authoritative: the player never changes runtime playback. It
 * follows (playback, timeSeconds, clockEpoch, generation) from Studio snapshots
 * and starts, stops or re-seeks one AudioBufferSourceNode to match. */
export type SoundtrackBuffer = Readonly<{ duration: number }>;
type GainNodeLike = { gain: { value: number }; connect(target: unknown): unknown };
type SourceNodeLike = {
  buffer: SoundtrackBuffer | null;
  connect(target: unknown): unknown;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
  disconnect(): void;
};
export type SoundtrackAudioContext = {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  createGain(): GainNodeLike;
  createBufferSource(): SourceNodeLike;
  decodeAudioData(data: ArrayBuffer): Promise<SoundtrackBuffer>;
  /** When present, maps the context time now leaving the speakers to performance.now(). */
  getOutputTimestamp?(): { contextTime?: number; performanceTime?: number };
};
export type SoundtrackClockView = Readonly<{
  instanceId: string; generation: number; clockEpoch: number;
  playback: 'playing' | 'paused' | 'starting' | 'failed'; timeSeconds?: number;
}>;
export type SoundtrackLinkState = 'none' | 'loading' | 'loaded' | 'missing' | 'mismatch' | 'error';
export type SoundtrackSettings = Readonly<{ offsetSeconds: number; volume: number; muted: boolean }>;
export type SoundtrackStatus = Readonly<{
  file: string | null; state: SoundtrackLinkState; message: string | null;
  offsetSeconds: number; volume: number; muted: boolean; durationSeconds: number | null;
  playing: boolean; positionSeconds: number | null; expectedSeconds: number | null; driftSeconds: number | null;
  contextState: string | null; outputLatencySeconds: number | null; starts: number;
}>;

/** Link and settings only; stable between changes so React can subscribe to it. */
export type SoundtrackView = Pick<SoundtrackStatus, 'file' | 'state' | 'message' | 'offsetSeconds' | 'volume' | 'muted' | 'durationSeconds'>;
export const soundtrackDriftToleranceSeconds = 0.05;
/** Frames arrive after they are sampled; the least-delayed recent frame best estimates scene time now. */
const sceneWindowMs = 1000;
/** Just after a start the first scene sample may be a late frame; settle to a tighter bound once. */
const settleMs = 1000, settleToleranceSeconds = 0.02;

export class SoundtrackPlayer {
  private readonly createContext: () => SoundtrackAudioContext;
  private readonly now: () => number;
  private readonly tolerance: number;
  private context: SoundtrackAudioContext | null = null;
  private gain: GainNodeLike | null = null;
  private source: SourceNodeLike | null = null;
  private buffer: SoundtrackBuffer | null = null;
  private settings: SoundtrackSettings = Object.freeze({ offsetSeconds: 0, volume: 1, muted: false });
  private link: { file: string | null; state: SoundtrackLinkState; message: string | null } = { file: null, state: 'none', message: null };
  private runtime: SoundtrackClockView | null = null;
  private startedKey: string | null = null;
  private startedAt = { outputTime: 0, position: 0 };
  private outputLatency: number | null = null;
  private sceneKey: string | null = null;
  private sceneSamples: { atMs: number; offsetSeconds: number }[] = [];
  private driftSamples = 0;
  private starts = 0;
  private startedAtMs = 0;
  private readonly listeners = new Set<() => void>();
  private view: SoundtrackView = this.createView();

  constructor(options: { createContext: () => SoundtrackAudioContext; driftToleranceSeconds?: number; now?: () => number }) {
    this.createContext = options.createContext;
    this.now = options.now ?? (() => performance.now());
    this.tolerance = options.driftToleranceSeconds ?? soundtrackDriftToleranceSeconds;
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private createView(): SoundtrackView {
    return Object.freeze({ file: this.link.file, state: this.link.state, message: this.link.message, offsetSeconds: this.settings.offsetSeconds,
      volume: this.settings.volume, muted: this.settings.muted, durationSeconds: this.buffer?.duration ?? null });
  }
  private notify(): void { this.view = this.createView(); for (const listener of this.listeners) listener(); }
  getView = (): SoundtrackView => this.view;

  private audio(): SoundtrackAudioContext {
    if (!this.context) {
      this.context = this.createContext();
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
      this.applyGain();
    }
    return this.context;
  }
  private applyGain(): void { if (this.gain) this.gain.gain.value = this.settings.muted ? 0 : this.settings.volume; }

  /** Decodes file bytes. The caller's buffer is copied because decoding detaches it. */
  decode(bytes: ArrayBuffer | Uint8Array): Promise<SoundtrackBuffer> {
    const copy = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes.slice(0);
    return this.audio().decodeAudioData(copy);
  }

  /** Call from a user gesture; Chromium may keep a new AudioContext suspended until one. */
  unlock(): void {
    const context = this.context;
    if (!context) return;
    if (context.state === 'suspended') void context.resume().catch(() => {});
  }

  setBuffer(buffer: SoundtrackBuffer | null): void {
    if (buffer === this.buffer) return;
    this.stopSource();
    this.buffer = buffer;
    this.update(this.runtime);
    this.notify();
  }

  setLink(file: string | null, state: SoundtrackLinkState, message: string | null = null): void {
    this.link = { file, state, message };
    this.notify();
  }

  setSettings(patch: Partial<SoundtrackSettings>): void {
    const next = Object.freeze({ ...this.settings, ...patch });
    if (next.offsetSeconds === this.settings.offsetSeconds && next.volume === this.settings.volume && next.muted === this.settings.muted) return;
    const reseek = next.offsetSeconds !== this.settings.offsetSeconds;
    this.settings = next;
    this.applyGain();
    if (reseek && this.source && this.startedKey) { const key = this.startedKey, expected = this.expected(); this.stopSource();
      if (expected !== null && this.buffer && expected < this.buffer.duration) this.start(expected, key); }
    this.notify();
  }

  /** Follow one Studio runtime snapshot. Call on every published frame. */
  update(runtime: SoundtrackClockView | null): void {
    this.runtime = runtime;
    if (!runtime || runtime.playback !== 'playing' || typeof runtime.timeSeconds !== 'number' || !Number.isFinite(runtime.timeSeconds)) {
      this.sceneKey = null; this.sceneSamples = []; this.stopSource(); return;
    }
    // Reset, rebuild and restart change this key; their clocks restart independently.
    const key = `${runtime.instanceId}:${runtime.generation}:${runtime.clockEpoch}`, now = this.now();
    if (key !== this.sceneKey) { this.sceneKey = key; this.sceneSamples = []; }
    this.sceneSamples.push({ atMs: now, offsetSeconds: Math.max(0, runtime.timeSeconds) - now / 1000 });
    while (this.sceneSamples.length > 1 && now - this.sceneSamples[0]!.atMs > sceneWindowMs) this.sceneSamples.shift();
    const buffer = this.buffer, expected = this.expected();
    if (!buffer || expected === null || expected >= buffer.duration) { this.stopSource(); return; }
    const context = this.audio();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    if (!this.source || this.startedKey !== key) { this.start(expected, key); return; }
    // A brief audio or frame hiccup is not drift. Two consecutive samples beyond tolerance are.
    const tolerance = now - this.startedAtMs < settleMs ? Math.min(this.tolerance, settleToleranceSeconds) : this.tolerance;
    if (Math.abs(this.position()! - expected) > tolerance) { if (++this.driftSamples >= 2) this.start(expected, key); }
    else this.driftSamples = 0;
  }

  /** Song position that matches scene time now, or null while scene time is unknown or paused. */
  private expected(): number | null {
    if (!this.sceneSamples.length) return null;
    let offset = -Infinity;
    for (const sample of this.sceneSamples) offset = Math.max(offset, sample.offsetSeconds);
    return this.settings.offsetSeconds + offset + this.now() / 1000;
  }

  /** Context time now audible at the output. currentTime advances in device-sized
   * blocks (tens of milliseconds on some Windows devices) and leads the speakers by
   * the output latency, so prefer the output timestamp extrapolated to now. */
  private audibleTime(context: SoundtrackAudioContext): number {
    const stamp = context.getOutputTimestamp?.();
    if (stamp && typeof stamp.contextTime === 'number' && typeof stamp.performanceTime === 'number' && stamp.contextTime > 0 && stamp.performanceTime > 0) {
      const estimate = stamp.contextTime + Math.max(0, this.now() - stamp.performanceTime) / 1000;
      if (Number.isFinite(estimate)) return Math.min(estimate, context.currentTime);
    }
    return context.currentTime;
  }
  /** Song position currently heard. */
  private position(): number | null {
    if (!this.source || !this.context) return null;
    return this.startedAt.position + (this.audibleTime(this.context) - this.startedAt.outputTime);
  }

  private start(position: number, key: string): void {
    this.stopSource();
    const context = this.audio(), source = context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain);
    // Audio scheduled now is heard after the output latency. Start that far into the
    // song so what the user hears matches the current scene time.
    const when = context.currentTime, audible = this.audibleTime(context), lead = Math.min(0.5, Math.max(0, when - audible));
    this.outputLatency = lead;
    source.start(when, position + lead);
    this.source = source; this.startedKey = key;
    this.startedAt = { outputTime: audible, position };
    this.driftSamples = 0; this.starts++; this.startedAtMs = this.now();
  }

  private stopSource(): void {
    const source = this.source;
    this.source = null; this.startedKey = null; this.driftSamples = 0;
    if (!source) return;
    try { source.stop(); } catch { /* A source that already ended cannot stop again. */ }
    source.disconnect();
  }

  /** Live probe: heard position, scene-matched position and their difference now. */
  status(): SoundtrackStatus {
    const position = this.position(), expected = this.source ? this.expected() : null;
    return Object.freeze({
      file: this.link.file, state: this.link.state, message: this.link.message,
      offsetSeconds: this.settings.offsetSeconds, volume: this.settings.volume, muted: this.settings.muted,
      durationSeconds: this.buffer?.duration ?? null,
      playing: !!this.source, positionSeconds: position, expectedSeconds: expected,
      driftSeconds: position !== null && expected !== null ? position - expected : null,
      contextState: this.context?.state ?? null, outputLatencySeconds: this.outputLatency, starts: this.starts,
    });
  }

  getSettings(): SoundtrackSettings { return this.settings; }
}
