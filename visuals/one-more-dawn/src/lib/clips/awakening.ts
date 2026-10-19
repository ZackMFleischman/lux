// Clip "awakening" (0 s – 19.3 s): Aria wakes on her pedestal; the doors open; obedient blinks (intro lines 1–4).
// This file owns everything on screen in its window: camera, lighting cues
// and every performer's pose. Start from defaultFrame and replace parts of
// it here; do not edit shared engine, cast or set files from a clip lane.

import type { PerspectiveCamera } from 'three/webgpu';
import { defaultFrame, type Cast } from '../show.ts';

export const clip = {
  id: 'awakening',
  start: 0,
  end: 19.3,
  frame(t: number, cast: Cast, cam: PerspectiveCamera): void {
    defaultFrame(t, cast, cam);
  },
};
