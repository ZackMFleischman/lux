// Shared jelly state, published by bell.ts in update() and read by other parts (fish.ts).
//
// Contract:
// - Space: the bell shader's aspect-corrected space,
//   p = (uv - (0.5, 0.42)) * (aspect, 1) * 2, with p.y up (screen height spans 2 units).
// - count: jellies valid this frame (0 = unavailable; readers must degrade gracefully).
// - frame: the bell's timeSeconds at the last publish (readers can detect staleness).
// - x, y: bell centre. angle: bell heading in radians (0 = upright; local down is (sin a, -cos a)).
// - radius: approximate bell radius in world units. tentacleLen: approximate tentacle length in world units.
// - Shockwaves: waveCount active rings with centre (waveX, waveY) and current radius waveR.
// Readers must not write to it.
// theme: master Aquarium(0) -> Space(1) blend, published by bell.ts from its `theme` control.
export const jellyShared = {
  theme: 0,
  count: 0,
  frame: -1,
  x: new Float32Array(64),
  y: new Float32Array(64),
  radius: new Float32Array(64),
  angle: new Float32Array(64),
  tentacleLen: new Float32Array(64),
  waveCount: 0,
  waveX: new Float32Array(16),
  waveY: new Float32Array(16),
  waveR: new Float32Array(16),
  // Optional per-wave extras (readers default when 0): strength multiplier (0 -> 1),
  // scale of the band width (0 -> 1), reach radius where the wave dies (0 -> 2.5).
  waveStrength: new Float32Array(16),
  waveScale: new Float32Array(16),
  waveReach: new Float32Array(16),
};
