import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createStudioQaAttempt } from './studio-qa.mjs';

const root = resolve(import.meta.dirname, '..');
const attempt = await createStudioQaAttempt({ root, expectedWorkspace: root, label: 'smoke' });
let page;
try {
  ({ page } = await attempt.launch({ viewport: { width: 640, height: 360 }, ready: page => page.waitForFunction(() => {
    const build = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Build');
    return !!build && !build.disabled && window.innerWidth > 0 && window.innerHeight > 0;
  }) }));
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.locator('.preview-surface canvas').waitFor();
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight, canvas: document.querySelector('.preview-surface canvas')?.getBoundingClientRect().toJSON() }));
  assert.equal(viewport.width, 640); assert.equal(viewport.height, 360); assert.ok(viewport.canvas.width > 0 && viewport.canvas.height > 0);
  attempt.manifest.preview = { width: viewport.canvas.width, height: viewport.canvas.height };
  await page.screenshot({ path: join(attempt.directory, 'ready-640x360.png') });
  await attempt.finish({ ok: true });
} catch (error) {
  await attempt.finish({ error: String(error.stack ?? error) });
  throw error;
}
await writeFile(join(attempt.directory, 'result.json'), JSON.stringify(attempt.manifest, null, 2));
console.log(JSON.stringify(attempt.manifest));
