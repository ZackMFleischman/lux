import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { exportResolume } from './export-resolume.mjs';
import packageIO from '../packages/export/src/package.cjs';

// CPU-only preparation. Never installs a plugin, starts playback, or opens Studio.
const root = resolve(import.meta.dirname, '..');
const outputDirectory = join(root, 'artifacts/installed-package/qa-fixtures');
await mkdir(outputDirectory, { recursive: true });
const releases = [];
for (const [fixture, name, expectedImage] of [
  ['triangle', 'Lux QA Triangle', 'Cyan triangle rotating and moving horizontally on dark navy'],
  ['ring', 'Lux QA Ring', 'Gold ring moving horizontally on dark navy'],
]) {
  const scenePath = join(root, 'tests/fixtures/installed-sources', fixture, 'scene.lux-scene');
  const result = await exportResolume({ scenePath, name, outputDirectory, root });
  const verified = packageIO.validatePackage(result.path);
  assert.equal(verified.release.name, name);
  assert.equal(verified.release.savedControls.intensity, 0.8);
  releases.push({ fixture, name, expectedImage, ...result, sourceHash: verified.release.sourceHash,
    linkedHash: verified.release.linkedHash, runtimeFiles: verified.runtime.files.length });
}
assert.notEqual(releases[0].sourceHash, releases[1].sourceHash);
assert.notEqual(releases[0].releaseId, releases[1].releaseId);
assert.equal(releases[0].runtimeId, releases[1].runtimeId, 'both exports must pin the same runtime');
const report = { format: 'lux-installed-qa-fixtures', version: 1, preparationPassed: true,
  hostTested: false, gpuTested: false, requiredAssetCovered: false,
  assetGap: 'These triangle/ring fixtures contain TypeScript dependencies but no images; use the separate required-image and PNG/JPEG checks for asset coverage.',
  releases };
await writeFile(join(outputDirectory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
