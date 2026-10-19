// Clip "teaching" (40.3 s – 57.4 s): Band enters; Barnaby walks on; children walk, dance, sing; the king rises (verse lines 1–4).
// This file owns everything on screen in its window: camera, lighting cues
// and every performer's pose. Start from defaultFrame and replace parts of
// it here; do not edit shared engine, cast or set files from a clip lane.

import type { PerspectiveCamera } from 'three/webgpu';
import { defaultFrame, type Cast } from '../show.ts';

export const clip = {
  id: 'teaching',
  start: 40.3,
  end: 57.4,
  frame(t: number, cast: Cast, cam: PerspectiveCamera): void {
    defaultFrame(t, cast, cam);
  },
};
