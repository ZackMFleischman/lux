/** Pure animation clock for TR-03. The caller supplies monotonic milliseconds
 * (for example performance.now); there is no wall-clock or scheduler dependency.
 * Service adapters own generation guards and request-ID deduplication. A call
 * to reset means one already-admitted reset, not a retryable wire request. */
export type PlaybackState = 'paused' | 'playing';
export type ClockSnapshot = Readonly<{
  playback: PlaybackState;
  timeSeconds: number;
  clockEpoch: number;
}>;

export class RuntimeClock {
  private readonly nowMs: () => number;
  private playback: PlaybackState;
  private accumulatedMs = 0;
  private anchorMs = 0;
  private lastSampleMs = 0;
  private epoch = 0;

  constructor(nowMs: () => number, initialPlayback: PlaybackState = 'paused') {
    if (typeof nowMs !== 'function') throw TypeError('An injected monotonic clock is required');
    if (initialPlayback !== 'paused' && initialPlayback !== 'playing') throw TypeError('Invalid initial playback state');
    this.nowMs = nowMs;
    this.playback = initialPlayback;
    this.anchorMs = this.sample();
  }

  snapshot(): ClockSnapshot { return this.at(this.sample()); }

  play(): ClockSnapshot {
    const now = this.sample();
    if (this.playback === 'paused') {
      this.anchorMs = now;
      this.playback = 'playing';
    }
    return this.at(now);
  }

  pause(): ClockSnapshot {
    const now = this.sample();
    if (this.playback === 'playing') {
      this.accumulatedMs += now - this.anchorMs;
      this.playback = 'paused';
    }
    return this.at(now);
  }

  reset(): ClockSnapshot {
    const now = this.sample();
    if (this.epoch === Number.MAX_SAFE_INTEGER) throw RangeError('Clock epoch exhausted; a new runtime generation is required');
    this.accumulatedMs = 0;
    this.anchorMs = now;
    this.epoch++;
    return this.at(now);
  }

  private sample(): number {
    const now = this.nowMs();
    if (!Number.isFinite(now) || now < this.lastSampleMs || now > Number.MAX_SAFE_INTEGER) {
      throw RangeError('Monotonic clock must provide finite nonnegative nondecreasing milliseconds within the safe range');
    }
    this.lastSampleMs = now;
    return now;
  }

  private at(now: number): ClockSnapshot {
    const elapsed = this.accumulatedMs + (this.playback === 'playing' ? now - this.anchorMs : 0);
    return Object.freeze({ playback: this.playback, timeSeconds: elapsed / 1000, clockEpoch: this.epoch });
  }
}
