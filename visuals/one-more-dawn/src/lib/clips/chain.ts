// Clip "chain" (57.4 s – 72.5 s): The future in his hands, the chain, the soldiers, the bow (verse lines 5–8).
// This file owns everything on screen in its window: camera, lighting cues
// and every performer's pose. Start from defaultFrame and replace parts of
// it here; do not edit shared engine, cast or set files from a clip lane.

import type { PerspectiveCamera } from 'three/webgpu';
import { defaultFrame, type Cast } from '../show.ts';

export const clip = {
  id: 'chain',
  start: 57.4,
  end: 72.5,
  frame(t: number, cast: Cast, cam: PerspectiveCamera): void {
    defaultFrame(t, cast, cam);
  },
};
