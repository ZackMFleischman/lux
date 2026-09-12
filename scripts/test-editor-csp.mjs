import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const env = { ...process.env, LUX_NODE_EXECUTABLE: process.execPath };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ executablePath: require('electron'), args: ['apps/studio/dist/main.cjs'], cwd: process.cwd(), env, chromiumSandbox: true });
try {
  const page = await app.firstWindow();
  const violations = [];
  page.on('console', message => { if (/violates.*Content Security Policy/.test(message.text())) violations.push(message.text()); });
  const editor = page.locator('.cm-content');
  await editor.waitFor();
  await page.evaluate(() => {
    window.__editorCsp = [];
    document.addEventListener('securitypolicyviolation', event => window.__editorCsp.push(event.effectiveDirective));
  });
  const initial = 'export const value = 3;';
  await editor.fill(initial);
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('export const value = 5;');
  assert.equal(await editor.innerText(), 'export const value = 5;');
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await editor.innerText(), initial);
  await page.keyboard.press('ControlOrMeta+y');
  assert.equal(await editor.innerText(), 'export const value = 5;');
  // Also replace a highlighted token with a backwards selection.
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.type('7');
  assert.equal(await editor.innerText(), 'export const value = 7;');
  await page.waitForTimeout(200);
  assert.deepEqual(violations, []);
  assert.deepEqual(await page.evaluate(() => window.__editorCsp), []);
  console.log('Editor native selection replacement, undo/redo and CSP passed');
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}


