// Clip "question" (19.3 s – 40.3 s): Aria steps forward, the question, the dream star (intro lines 5–8).
// This file owns everything on screen in its window: camera, lighting cues
// and every performer's pose. Start from defaultFrame and replace parts of
// it here; do not edit shared engine, cast or set files from a clip lane.

import type { PerspectiveCamera } from 'three/webgpu';
import { defaultFrame, type Cast } from '../show.ts';

export const clip = {
  id: 'question',
  start: 19.3,
  end: 40.3,
  frame(t: number, cast: Cast, cam: PerspectiveCamera): void {
    defaultFrame(t, cast, cam);
  },
};
