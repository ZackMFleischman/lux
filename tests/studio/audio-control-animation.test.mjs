import test from 'node:test';
import assert from 'node:assert/strict';
import { validateControlAnimationBindings } from '../../packages/runtime-contracts/src/control-animation.mjs';
import { normalizeControlAnimations, createControlAnimationEvaluator } from '../../apps/studio/src/controls/control-animation.mjs';

const hash = value => value.repeat(64);
const schema = Object.freeze([{ id: 'gain', type: 'number', label: 'Gain', default: 0.2, min: 0, max: 1, changeCost: 'live' }]);
const node = Object.freeze({ nodePath: Object.freeze([]), definitionHash: hash('a'), schemaHash: hash('b'), schema });
const profile = Object.freeze({ nodes: Object.freeze([node]), publicControls: schema,
  publicControlBindings: Object.freeze({ gain: Object.freeze([Object.freeze({ nodePath: node.nodePath, controlId: 'gain', active: true })]) }) });
const analyzer = Object.freeze({ version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 });

function audio(overrides = {}) {
  return {
    kind: 'audio', nodePath: [], definitionHash: node.definitionHash, schemaHash: node.schemaHash, controlId: 'gain',
    source: { kind: 'audio-band', logicalInputId: 'primary-audio', band: 'bass', analyzer },
    amount: 0.5, attackMs: 1000, releaseMs: 1000, enabled: true, ...overrides,
  };
}

function lfo() {
  return { nodePath: [], definitionHash: node.definitionHash, schemaHash: node.schemaHash, controlId: 'gain',
    shape: 'sine', periodSeconds: 2, amount: 0.5, phase: 0, enabled: true };
}

test('audio binding is a strict variant while the legacy LFO record stays exact', () => {
  assert.deepEqual(validateControlAnimationBindings([lfo(), audio({ controlId: 'other' })]), [lfo(), audio({ controlId: 'other' })]);
  assert.throws(() => validateControlAnimationBindings([{ ...lfo(), kind: 'lfo' }]), /Invalid control animation/);
  assert.throws(() => validateControlAnimationBindings([{ ...audio(), phase: 0 }]), /Invalid control animation/);
  assert.throws(() => validateControlAnimationBindings([audio({ attackMs: -1 })]), /supported range/);
  assert.throws(() => validateControlAnimationBindings([audio(), lfo()]), /Duplicate control animation binding/);
});

test('one scene audio configuration remains active and incompatible bindings stay disabled', () => {
  const incompatible = audio({ controlId: 'other', source: { ...audio().source, analyzer: { ...analyzer, minDecibels: -90 } } });
  const extendedProfile = { ...profile, nodes: [{ ...node, schema: [...schema, { ...schema[0], id: 'other', label: 'Other' }] }] };
  const normalized = normalizeControlAnimations([audio(), incompatible], extendedProfile);

  assert.deepEqual(normalized.bindings, [audio(), incompatible]);
  assert.deepEqual(normalized.issues, [{ index: 1, nodePath: [], controlId: 'other', message: 'Audio binding uses an unavailable input configuration.' }]);
});

test('audio attack and release use rendered frame time while manual base remains live', () => {
  let baseValue = 0.2;
  const normalized = normalizeControlAnimations([audio()], profile);
  const evaluator = createControlAnimationEvaluator(profile, {
    values: () => ({ gain: baseValue }),
    nodeValues: () => ({ gain: baseValue }),
  }, normalized);

  evaluator.applyAudioSnapshot({ generation: 1, sequence: 1, available: true, level: 0, bass: 1, mids: 0, highs: 0 });
  assert.equal(evaluator.values(0).gain, 0.2);
  assert.ok(Math.abs(evaluator.values(1).gain - 0.5160602794142788) < 1e-12);

  baseValue = 0.4;
  assert.ok(Math.abs(evaluator.values(1).gain - 0.7160602794142788) < 1e-12, 'base changes without resetting the filter');
  evaluator.applyAudioSnapshot({ generation: 2, sequence: 0, available: false, level: 0, bass: 0, mids: 0, highs: 0 });
  assert.ok(Math.abs(evaluator.values(1).gain - 0.7160602794142788) < 1e-12, 'paused scene time freezes the contribution');
  assert.ok(Math.abs(evaluator.values(2).gain - 0.5162720789674148) < 1e-12);
});

test('audio snapshots reject stale sequence and reset sequence on a newer generation', () => {
  const evaluator = createControlAnimationEvaluator(profile, { values: () => ({ gain: 0 }), nodeValues: () => ({ gain: 0 }) },
    normalizeControlAnimations([audio({ attackMs: 0, releaseMs: 0 })], profile));

  assert.equal(evaluator.applyAudioSnapshot({ generation: 3, sequence: 2, available: true, level: 0, bass: 0.8, mids: 0, highs: 0 }), true);
  assert.equal(evaluator.applyAudioSnapshot({ generation: 3, sequence: 2, available: true, level: 0, bass: 0.1, mids: 0, highs: 0 }), false);
  assert.equal(evaluator.values(1).gain, 0.4);
  assert.equal(evaluator.applyAudioSnapshot({ generation: 4, sequence: 0, available: true, level: 0, bass: 0.2, mids: 0, highs: 0 }), true);
  assert.ok(Math.abs(evaluator.values(2).gain - 0.1) < 1e-12);
});
