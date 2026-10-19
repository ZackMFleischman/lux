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
  contextState: string | null; starts: number;
}>;

/** Link and settings only; stable between changes so React can subscribe to it. */
export type SoundtrackView = Pick<SoundtrackStatus, 'file' | 'state' | 'message' | 'offsetSeconds' | 'volume' | 'muted' | 'durationSeconds'>;
export const soundtrackDriftToleranceSeconds = 0.05;

export class SoundtrackPlayer {
  private readonly createContext: () => SoundtrackAudioContext;
  private readonly tolerance: number;
  private context: SoundtrackAudioContext | null = null;
  private gain: GainNodeLike | null = null;
  private source: SourceNodeLike | null = null;
  private buffer: SoundtrackBuffer | null = null;
  private settings: SoundtrackSettings = Object.freeze({ offsetSeconds: 0, volume: 1, muted: false });
  private link: { file: string | null; state: SoundtrackLinkState; message: string | null } = { file: null, state: 'none', message: null };
  private runtime: SoundtrackClockView | null = null;
  private startedKey: string | null = null;
  private startedAt = { contextTime: 0, position: 0 };
  private lastExpected: number | null = null;
  private lastDrift: number | null = null;
  private driftSamples = 0;
  private starts = 0;
  private readonly listeners = new Set<() => void>();
  private view: SoundtrackView = this.createView();

  constructor(options: { createContext: () => SoundtrackAudioContext; driftToleranceSeconds?: number }) {
    this.createContext = options.createContext;
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
    if (reseek) { this.stopSource(); this.update(this.runtime); }
    this.notify();
  }

  /** Follow one Studio runtime snapshot. Call on every published frame. */
  update(runtime: SoundtrackClockView | null): void {
    this.runtime = runtime;
    const buffer = this.buffer;
    if (!buffer || !runtime || runtime.playback !== 'playing' || typeof runtime.timeSeconds !== 'number' || !Number.isFinite(runtime.timeSeconds)) {
      this.lastExpected = null; this.stopSource(); return;
    }
    const expected = this.settings.offsetSeconds + Math.max(0, runtime.timeSeconds);
    this.lastExpected = expected;
    if (expected >= buffer.duration) { this.stopSource(); return; }
    const context = this.audio();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    const key = `${runtime.instanceId}:${runtime.generation}:${runtime.clockEpoch}`;
    if (!this.source || this.startedKey !== key) { this.start(expected, key); return; }
    const drift = this.position()! - expected;
    this.lastDrift = drift;
    // One late frame is not drift. Two consecutive samples beyond tolerance are.
    if (Math.abs(drift) > this.tolerance) { if (++this.driftSamples >= 2) this.start(expected, key); }
    else this.driftSamples = 0;
  }

  private position(): number | null {
    if (!this.source || !this.context) return null;
    return this.startedAt.position + (this.context.currentTime - this.startedAt.contextTime);
  }

  private start(position: number, key: string): void {
    this.stopSource();
    const context = this.audio(), source = context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain);
    source.start(0, position);
    this.source = source; this.startedKey = key;
    this.startedAt = { contextTime: context.currentTime, position };
    this.lastDrift = 0; this.driftSamples = 0; this.starts++;
  }

  private stopSource(): void {
    const source = this.source;
    this.source = null; this.startedKey = null; this.lastDrift = null; this.driftSamples = 0;
    if (!source) return;
    try { source.stop(); } catch { /* A source that already ended cannot stop again. */ }
    source.disconnect();
  }

  status(): SoundtrackStatus {
    return Object.freeze({
      file: this.link.file, state: this.link.state, message: this.link.message,
      offsetSeconds: this.settings.offsetSeconds, volume: this.settings.volume, muted: this.settings.muted,
      durationSeconds: this.buffer?.duration ?? null,
      playing: !!this.source, positionSeconds: this.position(), expectedSeconds: this.lastExpected, driftSeconds: this.lastDrift,
      contextState: this.context?.state ?? null, starts: this.starts,
    });
  }

  getSettings(): SoundtrackSettings { return this.settings; }
}
