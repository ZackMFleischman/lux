import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { desktopSourceFile } from '../../scripts/studio-package.mjs';

test('Studio build emits its bundled Inter font for custom distribution roots', async t => {
  const root = resolve(import.meta.dirname, '../..');
  const dist = await mkdtemp(join(tmpdir(), 'lux-inter-build-'));
  t.after(() => rm(dist, { recursive: true, force: true }));

  execFileSync(process.execPath, [join(root, 'apps/studio/build.mjs')], {
    cwd: root,
    env: { ...process.env, LUX_STUDIO_DIST: dist },
    stdio: 'pipe',
  });

  const css = await readFile(join(dist, 'renderer.css'), 'utf8');
  const html = await readFile(join(dist, 'index.html'), 'utf8');
  const assets = await readdir(join(dist, 'assets'));
  const font = assets.find(name => /^InterVariable-[A-Z0-9]+\.woff2$/.test(name));
  assert.ok(font, `Expected an emitted Inter variable font, found: ${assets.join(', ')}`);
  assert.match(css, /@font-face/);
  assert.match(css, /font-family:\s*Inter/);
  assert.match(css, /font-weight:\s*100 900/);
  assert.match(css, new RegExp(`assets/${font.replace('.', '\\.').replace('-', '\\-')}`));
  assert.match(html, /font-src 'self'/);
  assert.match(await readFile(join(dist, 'licenses', 'Inter-OFL.txt'), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.equal(desktopSourceFile('apps/studio/src/fonts/InterVariable.woff2'), true);
  assert.equal(desktopSourceFile('apps/studio/src/fonts/OFL.txt'), true);
});
