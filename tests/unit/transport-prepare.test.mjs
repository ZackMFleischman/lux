import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareTransportScene } from '../../scripts/transport-prepare.mjs';

test('saved-scene preparation rejects forbidden imports without publishing a release', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-prepare-rejection-'));
  const filename = join(directory, 'invalid.lux-scene'), output = join(directory, 'releases');
  await writeFile(filename, JSON.stringify({ format: 'lux-scene', version: 1,
    source: { sdkVersion: '0.1.0', entry: 'main.ts', files: {
      'main.ts': "import fs from 'node:fs'; export default fs;",
    } }, settings: { width: 1920, height: 1080, fps: 60, seed: 7 }, controls: { intensity: 0.91 },
  }));
  await assert.rejects(prepareTransportScene(filename, output), /import|allow|node:fs/i);
  await assert.rejects(access(output), { code: 'ENOENT' });
});
