import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import releaseIO from '../../tools/gpu-spike/transport-release.cjs';
test('transport release binds linked code and output settings to immutable bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-release-'));
  const body = { code: 'export default {};', sourceMap: '{}', bundleHash: 'a'.repeat(64), linker: {version:'test'} };
  const release = {format:'lux-transport',version:1,sourceHash:'b'.repeat(64),settings:{width:1920,height:1080,fps:60,seed:7},
    linked:{...body,linkedHash:releaseIO.hash(JSON.stringify(body))}};
  const bytes = JSON.stringify(release), filename = join(directory, releaseIO.hash(bytes) + '.json');
  await writeFile(filename, bytes);
  assert.equal(releaseIO.readTransportRelease(filename).settings.seed, 7);
  await writeFile(filename, bytes + ' ');
  assert.throws(() => releaseIO.readTransportRelease(filename), /content hash/);
  release.linked.code += 'changed';
  const changed = JSON.stringify(release), changedPath = join(directory, releaseIO.hash(changed) + '.json');
  await writeFile(changedPath, changed);
  assert.throws(() => releaseIO.readTransportRelease(changedPath), /Linked module hash/);
});
