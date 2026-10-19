// GPU smoke test for the headless render pool: renders two frames of the
// shipped example sphere at exact times and checks the PNG files.
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderFrames } from './lux-render.mjs';

const root = resolve(import.meta.dirname, '..');
const work = await mkdtemp(join(tmpdir(), 'lux-render-smoke-'));
try {
  const src = join(work, 'src');
  await mkdir(src);
  await copyFile(join(root, 'skills/lux-visual-creation/assets/noise-sphere.ts'), join(src, 'visual.ts'));
  const result = await renderFrames({ src, out: join(work, 'out'), times: [0, 1.5], width: 320, height: 180 });
  assert.equal(result.failed.length, 0, JSON.stringify(result.failed));
  assert.equal(result.rendered, 2);
  for (const name of ['t0000.0000.png', 't0001.5000.png']) {
    const png = await readFile(join(work, 'out', name));
    assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47], `${name} is a PNG`);
    assert.equal(png.readUInt32BE(16), 320);
    assert.equal(png.readUInt32BE(20), 180);
  }
  const a = await readFile(join(work, 'out', 't0000.0000.png')), b = await readFile(join(work, 'out', 't0001.5000.png'));
  assert.ok(!a.equals(b), 'frames at different times differ (seek works)');
  console.log(`render pool smoke ok (${JSON.stringify(result.timing.at(-1))})`);
} finally {
  await rm(work, { recursive: true, force: true });
}
