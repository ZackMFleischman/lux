import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioPage } from '../../apps/studio/src/page.ts';
import { readFileSync } from 'node:fs';

test('Emotion styling is allowed only through a nonce while script and network policy stays restricted', () => {
  const template = readFileSync(new URL('../../apps/studio/src/index.html', import.meta.url), 'utf8');
  const page = createStudioPage(template, 'file:///C:/Lux/studio/dist/', 'abcdefghijklmnopqrstuvwx');
  assert.match(page, /style-src 'self' 'nonce-abcdefghijklmnopqrstuvwx'/);
  assert.match(page, /name="style-nonce" content="abcdefghijklmnopqrstuvwx"/);
  assert.match(page, /connect-src 'none'/);
  assert.match(page, /script-src 'self'/);
  assert.match(page, /file:\/\/\/C:\/Lux\/studio\/dist\/renderer.js/);
  assert.doesNotMatch(page, /unsafe-inline|__STYLE_NONCE__|__RENDERER_JS__/);
});

test('page generation refuses remote assets and injected nonce content', () => {
  assert.throws(() => createStudioPage('', 'https://example.com/', 'abcdefghijklmnopqrstuvwx'), /local/i);
  assert.throws(() => createStudioPage('', 'file:///C:/Lux/', 'bad" nonce'), /nonce/i);
});
