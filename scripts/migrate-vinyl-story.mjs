import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { compileVisual } from '../apps/build-worker/src/compile.mjs';
import { normalizeControlAnimations } from '../apps/studio/src/controls/control-animation.mjs';
import { SceneFileStore, createSceneDocument } from '../packages/core/src/scene-file.ts';
import { validateStoryAgainstCapability } from '../packages/runtime-contracts/src/story.mjs';

const root = resolve(import.meta.dirname, '..');
const checkTransform = process.argv.includes('--check-transform');
const positional = process.argv.slice(2).filter(value => value !== '--check-transform');
const inputPath = resolve(positional[0] ?? join(root, '..', '..', 'visuals', 'Vinyl Cosmos.lux-scene'));
const outputPath = resolve(positional[1] ?? join(root, 'artifacts', 'story-controls', 'Vinyl Cosmos Story.lux-scene'));
const sha256 = value => createHash('sha256').update(value).digest('hex');

const inputBytes = await readFile(inputPath);
const original = JSON.parse(inputBytes.toString('utf8'));
assert.equal(original.format, 'lux-scene');
assert.equal(original.version, 3);
assert.equal(original.source?.sourceVersion, 2);
assert.equal(original.source?.sdkVersion, '0.2.0');
assert.equal(original.source?.entry, 'collision-story.ts');
assert.deepEqual(Object.keys(original.source.files).sort(), [
  'cinematic-atmosphere.ts', 'collision-aftermath.ts', 'collision-story.ts', 'comet-orbits.ts',
  'flag.ts', 'flare-rig.ts', 'gaussian-blur.ts', 'pilot-pixels.ts', 'planet-visitor.ts',
  'record-comets.ts', 'saucer.ts', 'solar-polish.ts',
].sort());
assert.deepEqual(Object.keys(original.source.assets).sort(), [
  'assets/hippo-alien.png', 'assets/hippo-original.png', 'assets/record.png', 'assets/vinyl.png',
].sort());

const story = {
  version: 1,
  beats: [
    { id: 'arrival', label: 'Arrival', timing: { kind: 'timed', durationSeconds: 12 } },
    { id: 'orbit', label: 'Orbit and tidal distortion', timing: { kind: 'sustained' } },
    { id: 'chaos', label: 'Planetary chaos', timing: { kind: 'timed', durationSeconds: 10 } },
    { id: 'inspiral', label: 'Solar inspiral', timing: { kind: 'timed', durationSeconds: 10 } },
    { id: 'kilonova', label: 'Kilonova', timing: { kind: 'timed', durationSeconds: 8 } },
    { id: 'aftermath', label: 'Black hole aftermath', timing: { kind: 'sustained' } },
  ],
  sequence: [
    { id: 'arrival-1', beatId: 'arrival', follow: { kind: 'after', seconds: 12 } },
    { id: 'orbit-1', beatId: 'orbit', follow: { kind: 'after', seconds: 14 } },
    { id: 'chaos-1', beatId: 'chaos', follow: { kind: 'after', seconds: 10 } },
    { id: 'inspiral-1', beatId: 'inspiral', follow: { kind: 'after', seconds: 10 } },
    { id: 'kilonova-1', beatId: 'kilonova', follow: { kind: 'after', seconds: 8 } },
    { id: 'aftermath-1', beatId: 'aftermath', follow: { kind: 'manual' } },
  ],
};

const replaceOnce = (source, before, after, label) => {
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `${label}: source anchor is missing`);
  assert.equal(source.indexOf(before, first + before.length), -1, `${label}: source anchor is ambiguous`);
  return source.slice(0, first) + after + source.slice(first + before.length);
};

let entry = original.source.files['collision-story.ts'].replaceAll('\r\n', '\n');
entry = replaceOnce(entry, 'export default defineVisual({\n  controls: {', `export default defineVisual({
  story: {
    version: 1,
    beats: {
      arrival: { kind: 'timed', seek: 'direct' },
      orbit: { kind: 'sustained', seek: 'none' },
      chaos: { kind: 'timed', seek: 'direct' },
      inspiral: { kind: 'timed', seek: 'direct' },
      kilonova: { kind: 'timed', seek: 'direct' },
      aftermath: { kind: 'sustained', seek: 'none' },
    },
  },
  controls: {`, 'Story capability');

const removedControls = ['phaseMode', 'phaseSelect', 'phasePosition', 'phaseSeconds', 'phaseReplay', 'storyDuration'];
for (const id of removedControls) {
  const line = new RegExp(`^    ${id}: \\{[^\\n]+\\},\\n`, 'm');
  const matches = entry.match(new RegExp(line.source, 'gm')) ?? [];
  assert.equal(matches.length, 1, `Expected one ${id} declaration`);
  entry = entry.replace(line, '');
}

entry = replaceOnce(entry, `    const phaseEdges = [0, 0.18, 0.49, 0.65, 0.8, 0.9, 1];
    let phaseEpoch = -1;
    let lastAutomaticReveal = 1;
    let heldReveal = 0;
    let lastPhase = -1;
    let lastMode = -1;
    let lastReplay = -1;
    let resetToOpening = false;
    let resetMode = -1;
    let resetReplay = -1;
    let rawMode = 0;
    let rawReplay = 0;`, `    let openingEpoch = -1;
    let lastStoryEpoch = -1;
    let lastAutomaticReveal = 1;
    let heldReveal = 0;`, 'Story state variables');

entry = replaceOnce(entry, `        const rawControls = frame.controls;
        rawMode = rawControls.phaseMode;
        rawReplay = rawControls.phaseReplay;
        if (resetToOpening && (rawControls.phaseMode !== resetMode || rawControls.phaseReplay !== resetReplay)) resetToOpening = false;
        const c = resetToOpening ? { ...rawControls, phaseMode: 0, automatic: 1 } : rawControls;
        for (const logo of logoMeshes) logo.scale.setScalar(c.hippoSize);
        alienTintColor.setHSL(c.alienHue, 0.45, 0.72);
        alienMaterial.color.setRGB(1, 1, 1).lerp(alienTintColor, c.alienTint);
        const smoothing = 1 - Math.exp(-Math.min(frame.deltaSeconds, 0.1) / 0.9);
        calmBass += (c.bass - calmBass) * smoothing;
        calmMids += (c.mids - calmMids) * smoothing;
        calmHighs += (c.highs - calmHighs) * smoothing;
        const selectedPhase = Math.max(1, Math.min(6, Math.round(c.phaseSelect)));
        if (phaseEpoch < 0 || (c.phaseMode >= 2 && selectedPhase !== lastPhase) || c.phaseMode !== lastMode || c.phaseReplay !== lastReplay) {
          phaseEpoch = frame.timeSeconds;
          lastPhase = selectedPhase;
          lastMode = c.phaseMode;
          lastReplay = c.phaseReplay;
        }
        let elapsed = Math.max(0, frame.timeSeconds - phaseEpoch);
        const phaseElapsed = c.phaseMode === 2 ? elapsed % (c.phaseSeconds + 1.5) : elapsed;
        const phaseFraction = c.phaseMode === 3 ? c.phasePosition : Math.min(1, phaseElapsed / c.phaseSeconds);
        const phaseStart = phaseEdges[selectedPhase - 1];
        const phaseEnd = phaseEdges[selectedPhase];`, `        const c = frame.controls;
        if (openingEpoch < 0) openingEpoch = frame.timeSeconds;
        if (frame.story.storyEpoch !== lastStoryEpoch) {
          lastStoryEpoch = frame.story.storyEpoch;
          calmBass = c.bass;
          calmMids = c.mids;
          calmHighs = c.highs;
        }
        for (const logo of logoMeshes) logo.scale.setScalar(c.hippoSize);
        alienTintColor.setHSL(c.alienHue, 0.45, 0.72);
        alienMaterial.color.setRGB(1, 1, 1).lerp(alienTintColor, c.alienTint);
        const smoothing = 1 - Math.exp(-Math.min(frame.deltaSeconds, 0.1) / 0.9);
        calmBass += (c.bass - calmBass) * smoothing;
        calmMids += (c.mids - calmMids) * smoothing;
        calmHighs += (c.highs - calmHighs) * smoothing;
        let elapsed = Math.max(0, frame.timeSeconds - openingEpoch);`, 'Story frame input');

entry = entry.replaceAll('c.phaseMode === 0', "frame.story.state === 'normal'");
entry = entry.replaceAll('phaseEpoch = frame.timeSeconds - elapsed;', 'openingEpoch = frame.timeSeconds - elapsed;');
entry = replaceOnce(entry, `        const story = frame.story.state === 'normal' ? 0
          : c.phaseMode === 1 ? Math.min(1, elapsed / c.storyDuration)
          : c.phaseMode === 4 ? Math.min(1, phaseStart + elapsed / c.storyDuration)
          : phaseStart + (phaseEnd - phaseStart) * phaseFraction;`, `        let story = 0;
        if (frame.story.state === 'active') {
          const progress = frame.story.progress ?? 0;
          if (frame.story.beatId === 'arrival') story = 0.18 * progress;
          else if (frame.story.beatId === 'orbit') story = 0.18 + 0.31 * ease(frame.story.elapsedSeconds / 12);
          else if (frame.story.beatId === 'chaos') story = 0.49 + 0.16 * progress;
          else if (frame.story.beatId === 'inspiral') story = 0.65 + 0.15 * progress;
          else if (frame.story.beatId === 'kilonova') story = 0.8 + 0.12 * progress;
          else story = 0.92 + 0.08 * ease(frame.story.elapsedSeconds / 6);
        }`, 'Direct Story pose');

entry = replaceOnce(entry, `        resetToOpening = true;
        resetMode = rawMode;
        resetReplay = rawReplay;
        visitor.reset();
        phaseEpoch = -1;`, `        visitor.reset();
        openingEpoch = -1;
        lastStoryEpoch = -1;`, 'Reset Story state');

for (const id of removedControls) assert.doesNotMatch(entry, new RegExp(`\\b${id}\\b`));
assert.match(entry, /frame\.story\.state === 'active'/);
assert.match(entry, /storyEpoch/);

const nextSource = structuredClone(original.source);
nextSource.files['collision-story.ts'] = entry;
assert.deepEqual(nextSource.assets, original.source.assets, 'Embedded asset records must remain byte-for-byte equal');
for (const [name, text] of Object.entries(original.source.files)) {
  if (name !== 'collision-story.ts') assert.equal(nextSource.files[name], text, `${name} must be unchanged`);
}
if (checkTransform) {
  console.log(JSON.stringify({ ok: true, mode: 'check-transform', input: inputPath, inputSha256: sha256(inputBytes), entrySha256: sha256(entry), files: Object.keys(nextSource.files).length, assets: Object.keys(nextSource.assets).length }, null, 2));
  process.exit(0);
}

const compile = await compileVisual({ source: nextSource });
assert.equal(compile.ok, true, JSON.stringify(compile));
const { artifact } = compile;
assert.ok(artifact.storyCapability, 'Compiler must publish the Story capability');
validateStoryAgainstCapability(story, artifact.storyCapability);
assert.ok(Array.isArray(artifact.controls));
assert.equal(typeof artifact.controlSchemaHash, 'string');

const retainedValues = Object.fromEntries(artifact.controls
  .filter(control => control.type !== 'trigger')
  .map(control => {
    assert.ok(Object.hasOwn(original.controls.values, control.id), `Missing retained value for ${control.id}`);
    return [control.id, original.controls.values[control.id]];
  }));
assert.equal(Object.keys(retainedValues).length, Object.keys(original.controls.values).length - removedControls.length);
const controls = {
  sourceHash: artifact.sourceHash,
  schema: artifact.controls,
  schemaHash: artifact.controlSchemaHash,
  values: retainedValues,
};

assert.deepEqual(original.controlAnimations.map(binding => binding.controlId).sort(), ['bass', 'highs', 'kick', 'mids']);
for (const binding of original.controlAnimations) {
  assert.deepEqual(binding.nodePath, []);
  assert.equal(binding.definitionHash, original.controls.schemaHash);
  assert.equal(binding.schemaHash, original.controls.schemaHash);
  assert.ok(artifact.controls.some(control => control.id === binding.controlId && control.type === 'number'));
}
const controlAnimations = original.controlAnimations.map(binding => ({
  ...binding,
  definitionHash: artifact.controlSchemaHash,
  schemaHash: artifact.controlSchemaHash,
}));
const sceneNode = { nodePath: [], definitionHash: artifact.controlSchemaHash, schemaHash: artifact.controlSchemaHash, schema: artifact.controls };
const publicControlBindings = Object.fromEntries(artifact.controls.map(control => [control.id, [{ nodePath: [], controlId: control.id, active: true }]]));
const animationCheck = normalizeControlAnimations(controlAnimations, { nodes: [sceneNode], publicControls: artifact.controls, publicControlBindings });
assert.deepEqual(animationCheck.issues, [], 'Migrated audio bindings must target the compiled copied scene');

const document = createSceneDocument(nextSource, original.settings, controls, [], controlAnimations, original.tempo, story);
assert.equal(document.version, 6);
assert.deepEqual(document.source.assets, original.source.assets);
await mkdir(dirname(outputPath), { recursive: true });
const saved = await new SceneFileStore().saveAs(outputPath, document, { overwrite: true });
const reopened = await new SceneFileStore().open(outputPath);
assert.deepEqual(reopened.document, saved.document);
assert.deepEqual(reopened.document.controlAnimations, controlAnimations);

console.log(JSON.stringify({
  ok: true,
  input: inputPath,
  inputSha256: sha256(inputBytes),
  output: outputPath,
  outputSha256: sha256(await readFile(outputPath)),
  sourceHash: artifact.sourceHash,
  controlSchemaHash: artifact.controlSchemaHash,
  storyCapabilityHash: artifact.storyCapabilityHash,
  story: { beats: story.beats.length, occurrences: story.sequence.length },
  preserved: { files: Object.keys(nextSource.files).length, assets: Object.keys(nextSource.assets).length, audioBindings: controlAnimations.length },
}, null, 2));
