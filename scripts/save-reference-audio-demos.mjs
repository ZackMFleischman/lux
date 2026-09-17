import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SceneFileStore } from '../packages/core/src/scene-file.ts';
import { normalizeControlAnimations, createControlAnimationEvaluator } from '../apps/studio/src/controls/control-animation.mjs';

const [fiberInput, pigmentInput, destination] = process.argv.slice(2);
if (!destination) throw Error('Supply saved fiber scene, pigment scene, and destination directory');
const store = new SceneFileStore();
const analyzer = { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 };
const presets = [
  [fiberInput, 'Fiber Tracers and Glass Ribbons', [
    ['0001', 'brightness', 'kick', 1.3, 15, 400],
    ['0001', 'radius', 'bass', .018, 120, 500],
    ['0003', 'pulseStrength', 'kick', 1.8, 10, 500],
    ['0003', 'brightness', 'mids', .45, 100, 400],
    ['0004', 'brightness', 'highs', .45, 40, 250],
  ]],
  [pigmentInput, 'Pigment Bands and Ink Contours', [
    ['0001', 'fold', 'bass', .10, 700, 1600],
    ['0003', 'warmth', 'mids', .35, 500, 1200],
    ['0003', 'pooling', 'level', .20, 600, 1600],
    ['0006', 'contourStrength', 'highs', .18, 250, 600],
  ]],
];
await mkdir(resolve(destination), { recursive: true });
for (const [input, name, mappings] of presets) {
  const { document } = await store.open(resolve(input));
  const nodes = document.controls.nodes;
  const bindings = mappings.map(([suffix, controlId, band, amount, attackMs, releaseMs]) => {
    const matches = nodes.filter(node => node.nodePath.length === 1 && node.nodePath[0].endsWith(suffix));
    assert.equal(matches.length, 1);
    const { nodePath, definitionHash, schemaHash } = matches[0];
    const common = { nodePath, definitionHash, schemaHash, controlId, amount, attackMs, releaseMs, enabled: true };
    const source = { logicalInputId: 'primary-audio', analyzer };
    return band === 'kick'
      ? { ...common, kind: 'kick', source: { ...source, kind: 'audio-kick' }, sensitivity: .65, retriggerMs: 180, envelope: 'exponential' }
      : { ...common, kind: 'audio', source: { ...source, kind: 'audio-band', band } };
  });
  const profile = { nodes, publicControls: [], publicControlBindings: {} };
  const normalized = normalizeControlAnimations(bindings, profile);
  assert.deepEqual(normalized.issues, []);
  const nodeFor = path => nodes.find(node => JSON.stringify(node.nodePath) === JSON.stringify(path));
  const evaluator = createControlAnimationEvaluator(profile, { values: () => ({}), nodeValues: path => nodeFor(path).values }, normalized);
  evaluator.applyAudioSnapshot({ generation: 1, sequence: 1, available: true, level: 1, bass: 1, mids: 1, highs: 1, kickSequence: 1, kickStrength: 1 });
  for (const node of nodes) evaluator.nodeValues(node.nodePath, 0);
  // Synthetic analyzer snapshots exercise the real control evaluator, not a live device.
  for (const time of [.015, 2]) {
    for (const binding of bindings.filter(row => (time < 1) === (row.kind === 'kick'))) {
      const value = evaluator.nodeValues(binding.nodePath, time)[binding.controlId];
      const node = nodeFor(binding.nodePath);
      const definition = node.schema.find(row => row.id === binding.controlId);
      assert.ok(value > node.values[binding.controlId], `${name}: ${binding.controlId} responds`);
      assert.ok(value <= definition.max && value >= definition.min);
    }
  }
  evaluator.applyAudioSnapshot({ generation: 2, sequence: 0, available: false, level: 0, bass: 0, mids: 0, highs: 0, kickSequence: 0, kickStrength: 0 });
  for (const node of nodes) evaluator.nodeValues(node.nodePath, 3);
  for (const binding of bindings) assert.ok(Math.abs(evaluator.nodeValues(binding.nodePath, 40)[binding.controlId] - nodeFor(binding.nodePath).values[binding.controlId]) < 1e-6, 'disconnect returns to base');
  const path = join(resolve(destination), `${name}.lux-scene`);
  await store.saveAs(path, { ...document, controlAnimations: bindings }, { overwrite: false });
  const reopened = await store.open(path);
  assert.deepEqual(reopened.document.controlAnimations, bindings);
  console.log(JSON.stringify({ path, bindings: bindings.length, syntheticResponse: 'passed', disconnect: 'passed', fileRoundTrip: 'passed' }));
}
