// QA frame capture for the One More Dawn show.
// Renders frames at exact song times through the warm headless render pool
// (scripts/lux-render.mjs): no Studio launch, no default scene, no retries.
// The pool starts on first use and is reused by later calls (and by other
// lanes on this checkout); it exits after 20 idle minutes.
//
// Usage (from the checkout root):
//   node visuals/one-more-dawn/tools/qa-capture.mjs <outDir> <t1> <t2> ...
// Env: SHOW_SRC (default visuals/one-more-dawn/src) selects the source tree,
//      e.g. a lane worktree's src folder.

import { resolve } from 'node:path';
import { renderFrames } from '../../../scripts/lux-render.mjs';

const root = resolve(import.meta.dirname, '../../..');
const [outDir, ...times] = process.argv.slice(2);
if (!outDir || times.length === 0) {
  console.error('usage: qa-capture.mjs <outDir> <songTime...>');
  process.exit(2);
}
const result = await renderFrames({
  src: resolve(root, process.env.SHOW_SRC ?? 'visuals/one-more-dawn/src'),
  out: resolve(outDir),
  times: times.map(Number),
  controls: { startAt: 0 },
});
for (const f of result.failed) console.error(`failed t=${f.t}: ${f.error}`);
console.log(`rendered ${result.rendered}/${times.length} frames into ${resolve(outDir)}`);
if (result.failed.length) process.exitCode = 1;
