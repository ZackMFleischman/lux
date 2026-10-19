// Picks the clip that owns the current song time. Each clip lives in its
// own file so clip lanes can be developed in parallel without conflicts.
// Boundary hand-offs are agreed in visuals/one-more-dawn/BLOCKING.md.

import type { PerspectiveCamera } from 'three/webgpu';
import { clip as awakening } from './clips/awakening.ts';
import { clip as chain } from './clips/chain.ts';
import { clip as question } from './clips/question.ts';
import { clip as teaching } from './clips/teaching.ts';
import type { Cast } from './show.ts';

const CLIPS = [awakening, question, teaching, chain];

export function runShow(t: number, cast: Cast, cam: PerspectiveCamera): void {
  const active = CLIPS.find(c => t < c.end) ?? CLIPS[CLIPS.length - 1];
  active.frame(t, cast, cam);
}
