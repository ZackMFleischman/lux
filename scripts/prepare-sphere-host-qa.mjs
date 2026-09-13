import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prepareTransportScene } from './transport-prepare.mjs';
import { exportResolume } from './export-resolume.mjs';
import packageIO from '../packages/export/src/package.cjs';
import registration from '../packages/export/src/register.cjs';
import transportIO from '../tools/gpu-spike/transport-release.cjs';

// CPU-only fixture preparation. An explicit runtime root enables final export;
// without it, only source provenance, compilation and the QA sheet are prepared.
const [sceneArgument, outputArgument, runtimeArgument] = process.argv.slice(2);
if (!sceneArgument || !outputArgument) throw Error('Usage: node scripts/prepare-sphere-host-qa.mjs <sphere.lux-scene> <new-artifact-directory> [reviewed-runtime-checkout]');
const scenePath = path.resolve(sceneArgument), out = path.resolve(outputArgument);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
packageIO.noLinks(scenePath); packageIO.noLinks(out);
fs.mkdirSync(out, { recursive: true });
const original = fs.readFileSync(scenePath), scene = JSON.parse(original);
assert.equal(scene.version, 3);
assert.equal(scene.source.sdkVersion, '0.2.0');
assert.deepEqual(scene.controls.schema.map(row => row.id), ['spikeHeight', 'noiseScale', 'sharpness', 'motionSpeed', 'roughness']);
const copy = path.join(out, 'sphere.lux-scene');
if (fs.existsSync(copy)) assert.deepEqual(fs.readFileSync(copy), original, 'Existing fixture scene differs');
else fs.writeFileSync(copy, original, { flag: 'wx' });
const prepared = await prepareTransportScene(copy, path.join(out, 'prepared'));
const transport = transportIO.readTransportRelease(prepared.path);
assert.equal(prepared.sourceHash, scene.controls.sourceHash, 'Saved controls must belong to the accepted source');
assert.equal(transport.linked.linkedVersion, 3);
assert.deepEqual(transport.linked.controls, scene.controls.schema, 'Recompile must recover the exact authored schema');
assert.equal(transport.linked.controlSchemaHash, scene.controls.schemaHash);
assert.deepEqual(prepared.savedControls, scene.controls.values, 'Preserve all saved values, including non-default values');
const effects = {
  spikeHeight: '0 removes the displacement; increasing toward 2 makes taller spikes.',
  noiseScale: 'Lower values produce broad, sparse features; higher values produce denser, finer features.',
  sharpness: 'Higher values narrow the noise peaks; lower values broaden the displaced surface.',
  motionSpeed: '0 freezes noise drift; higher values accelerate drift. The source keeps its separate sphere rotation moving.',
  roughness: 'Lower values sharpen highlights; higher values soften and spread them.',
};
const parameters = scene.controls.schema.map((row, index) => ({ index, ...row, saved: scene.controls.values[row.id],
  normalizedSaved: Math.fround((scene.controls.values[row.id] - row.min) / (row.max - row.min)), expectedEffect: effects[row.id] }));
const report = { format: 'lux-sphere-host-qa', version: 1, preparedWithSourceCommit: 'f7d61249ec29eea12a51357777ba4967a5051fa9',
  originalScenePath: scenePath, scenePath: copy, sceneSha256: digest(original), sourceHash: prepared.sourceHash,
  schemaHash: scene.controls.schemaHash, linkedHash: prepared.linkedHash, transportPath: prepared.path,
  settings: scene.settings, parameters, hostTested: false, gpuTested: false, userPluginDirectoryModified: false };
if (runtimeArgument) {
  const runtimeRoot = path.resolve(runtimeArgument);
  const result = await exportResolume({ scenePath: copy, name: 'Lux Spike Sphere', root: runtimeRoot,
    outputDirectory: path.join(out, 'packages'), preparedPath: prepared.path, savedControls: prepared.savedControls });
  const verified = packageIO.validatePackage(result.path);
  assert.equal(verified.release.sourceHash, report.sourceHash);
  assert.equal(verified.release.controlSchemaHash, report.schemaHash);
  assert.deepEqual(verified.release.savedControls, scene.controls.values);
  assert.deepEqual(verified.release.controls, scene.controls.schema);
  const local = path.join(out, 'profile', 'local'), installRoot = path.join(local, 'Lux', 'Installed');
  const installed = packageIO.installPackage(result.path, installRoot);
  const previousLocal = process.env.LOCALAPPDATA;
  let registered;
  try {
    process.env.LOCALAPPDATA = local;
    registered = registration.registerSource({ installRoot, releaseId: result.releaseId, pluginDirectory: path.join(out, 'plugins') });
  } finally {
    if (previousLocal === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previousLocal;
  }
  assert.equal(registered.sidecar.split('\n')[6], '5');
  Object.assign(report, { package: result, runtimeRoot, runtimeFiles: verified.runtime.files.length, installed, registration: registered,
    runtimeInventorySha256: digest(fs.readFileSync(path.join(result.path, 'runtime', 'runtime.json'))),
    registeredDllSha256: digest(fs.readFileSync(registered.dllPath)) });
}
assert.deepEqual(fs.readFileSync(scenePath), original, 'Original saved scene changed during preparation');
fs.writeFileSync(path.join(out, 'preparation.json'), JSON.stringify(report, null, 2) + '\n');
const rows = parameters.map(row => `| ${row.index} | ${row.label} (${row.id}) | ${row.min}–${row.max} | ${row.saved} | ${row.normalizedSaved} | ${row.expectedEffect} |`).join('\n');
fs.writeFileSync(path.join(out, 'QA.md'), `# Spiky sphere: real-host multi-control QA\n\nCPU preparation only; real-host checks below remain pending. Source and saved control cache are copied byte-for-byte from the accepted Studio scene. SDK 0.2 controls are extracted from its code. No image assets are required.\n\nSource: \`${report.sourceHash}\`\n\nSchema: \`${report.schemaHash}\`\n\nRuntime: \`${report.package?.runtimeId ?? 'pending reviewed health-publish fix'}\`\n\nSource display name: Lux Spike Sphere. Settings: 1920×1080, 60 fps, seed 0. Initial appearance should be a lit purple, finely displaced sphere on a dark navy background. Visual effects below are source-derived expectations, not host observations.\n\n| Index | Parameter | Concrete range | Saved value | FFGL normalized initial | Expected visual effect |\n|---|---|---|---|---|---|\n${rows}\n\n1. After root review and separate authorization for real-folder registration, load the source in Resolume with Studio closed. Verify all five labels appear and the sphere renders. Host sliders are normalized 0–1; use the table to distinguish host positions from concrete visual values.\n2. Change Spike height alone to 0, then 0.425 (concrete 0.85); confirm smooth versus spiky shape. Keep all other controls fixed.\n3. With height nonzero, change Noise scale alone from 0 (concrete 0.5) to 1 (concrete 12); confirm broad versus fine features. Confirm height and the other three slider positions did not change. Restore its saved normalized value.\n4. Change Sharpness, Motion speed and Roughness separately; confirm the expected effect and unchanged other slider positions. Motion speed 0 must not be mistaken for a full animation pause.\n5. Set two distinct non-default positions, save the Resolume composition, close normally, reopen with Studio closed, and verify both positions and appearance restore. Record actual observed values and screenshots before and after reopening.\n6. Remove the source and close the host normally. Record cleanup evidence separately; pixels or a closed window alone do not prove complete GPU resource cleanup.\n\nPrivate registration is confined to this artifact's plugins folder and profile/local/Lux/Installed. These paths are preparation only and are not the user's real Resolume plugin directory. No host performance, recovery, offline-distribution or cleanup gate is certified by this preparation. Exact identities and paths are in preparation.json.\n`);
console.log(JSON.stringify(report, null, 2));
