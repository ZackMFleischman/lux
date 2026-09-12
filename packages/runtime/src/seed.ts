/** Deterministic Mulberry32 stream for creative state, not cryptography.
 * Each runtime owns a separate instance. Reset belongs to runtime orchestration,
 * alongside the clock reset; this class owns no clock, controls or GPU resources. */
export class SeededRandom {
  private seed: number;
  private state: number;
  constructor(seed: number) {
    this.seed = this.validate(seed);
    this.state = this.seed;
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  }
  reset(seed: number = this.seed): void {
    const validated = this.validate(seed);
    this.seed = validated;
    this.state = validated;
  }
  private validate(seed: number): number {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw RangeError('Seed must be an unsigned 32-bit integer');
    return seed;
  }
}
