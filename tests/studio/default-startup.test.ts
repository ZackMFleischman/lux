import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('fresh Studio startup loads the checked-in noise sphere source', async () => {
  const main = await readFile(resolve('apps/studio/src/main.ts'), 'utf8');
  assert.match(main, /skills\/lux-visual-creation\/assets\/noise-sphere\.ts/);
  assert.doesNotMatch(main, /packages\/visual-sdk\/examples\/intensity\.ts/);
});
