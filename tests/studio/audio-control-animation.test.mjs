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

function kick(overrides={}){
  return {kind:'kick',nodePath:[],definitionHash:node.definitionHash,schemaHash:node.schemaHash,controlId:'gain',
    source:{kind:'audio-kick',logicalInputId:'primary-audio',analyzer},amount:.5,attackMs:100,releaseMs:400,
    sensitivity:1,retriggerMs:200,envelope:'linear',enabled:true,...overrides};
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
  assert.deepEqual(validateControlAnimationBindings([kick()]),[kick()]);
  assert.throws(()=>validateControlAnimationBindings([{...kick(),band:'bass'}]),/Invalid control animation/);
  assert.throws(()=>validateControlAnimationBindings([kick({sensitivity:1.1})]),/supported range/);
});

test('one scene audio configuration remains active and incompatible bindings stay disabled', () => {
  const incompatible = kick({ controlId: 'other', source: { ...kick().source, analyzer: { ...analyzer, minDecibels: -90 } } });
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

  evaluator.applyAudioSnapshot({ generation: 1, sequence: 1, available: true, level: 0, bass: 1, mids: 0, highs: 0,kickSequence:0,kickStrength:0 });
  assert.equal(evaluator.values(0).gain, 0.2);
  assert.ok(Math.abs(evaluator.values(1).gain - 0.5160602794142788) < 1e-12);

  baseValue = 0.4;
  assert.ok(Math.abs(evaluator.values(1).gain - 0.7160602794142788) < 1e-12, 'base changes without resetting the filter');
  evaluator.applyAudioSnapshot({ generation: 2, sequence: 0, available: false, level: 0, bass: 0, mids: 0, highs: 0,kickSequence:0,kickStrength:0 });
  assert.ok(Math.abs(evaluator.values(1).gain - 0.7160602794142788) < 1e-12, 'paused scene time freezes the contribution');
  assert.ok(Math.abs(evaluator.values(2).gain - 0.5162720789674148) < 1e-12);
});

test('audio snapshots reject stale sequence and reset sequence on a newer generation', () => {
  const evaluator = createControlAnimationEvaluator(profile, { values: () => ({ gain: 0 }), nodeValues: () => ({ gain: 0 }) },
    normalizeControlAnimations([audio({ attackMs: 0, releaseMs: 0 })], profile));

  assert.equal(evaluator.applyAudioSnapshot({ generation: 3, sequence: 2, available: true, level: 0, bass: 0.8, mids: 0, highs: 0,kickSequence:0,kickStrength:0 }), true);
  assert.equal(evaluator.applyAudioSnapshot({ generation: 3, sequence: 2, available: true, level: 0, bass: 0.1, mids: 0, highs: 0,kickSequence:0,kickStrength:0 }), false);
  assert.equal(evaluator.values(1).gain, 0.4);
  assert.equal(evaluator.applyAudioSnapshot({ generation: 4, sequence: 0, available: true, level: 0, bass: 0.2, mids: 0, highs: 0,kickSequence:0,kickStrength:0 }), true);
  assert.ok(Math.abs(evaluator.values(2).gain - 0.1) < 1e-12);
});

test('kick envelope uses rendered time, finite shapes, retrigger interval, and smooth disconnect release',()=>{
  const evaluator=createControlAnimationEvaluator(profile,{values:()=>({gain:0}),nodeValues:()=>({gain:0})},normalizeControlAnimations([kick()],profile));
  evaluator.applyAudioSnapshot({generation:1,sequence:1,available:true,level:0,bass:0,mids:0,highs:0,kickSequence:1,kickStrength:1},{playing:true,timeSeconds:0});
  assert.equal(evaluator.values(0).gain,0);
  assert.ok(Math.abs(evaluator.values(.1).gain-.5)<1e-12,'attack reaches the peak at its exact boundary');
  assert.ok(Math.abs(evaluator.values(.3).gain-.25)<1e-12,'linear release reaches half at its midpoint');
  evaluator.applyAudioSnapshot({generation:1,sequence:2,available:true,level:0,bass:0,mids:0,highs:0,kickSequence:2,kickStrength:1},{playing:true,timeSeconds:.3});
  assert.ok(Math.abs(evaluator.values(.3).gain-.25)<1e-12,'retrigger at the boundary remains continuous');
  evaluator.applyAudioSnapshot({generation:2,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0},{playing:true,timeSeconds:.35});
  const atDisconnect=evaluator.values(.35).gain;
  assert.ok(atDisconnect>0);
  assert.equal(evaluator.values(.75).gain,0);
});

test('paused, reset, and disabled kick bindings consume events without replay',()=>{
  let normalized=normalizeControlAnimations([kick({attackMs:0,releaseMs:100})],profile);
  const evaluator=createControlAnimationEvaluator(profile,{values:()=>({gain:0}),nodeValues:()=>({gain:0})},normalized);
  const duringPause={generation:1,sequence:1,available:true,level:0,bass:0,mids:0,highs:0,kickSequence:1,kickStrength:1};
  evaluator.applyAudioSnapshot(duringPause,{playing:false,timeSeconds:0});
  assert.equal(evaluator.values(1).gain,0,'paused event is fenced before resume');
  evaluator.applyAudioSnapshot({...duringPause,sequence:2,kickSequence:2},{playing:true,timeSeconds:1});
  assert.equal(evaluator.values(1).gain,.5);
  evaluator.restart([], 'gain', 1);
  assert.equal(evaluator.values(1).gain,0,'reset clears the envelope and fences the current event');
  normalized=normalizeControlAnimations([kick({enabled:false,attackMs:0,releaseMs:100})],profile);
  evaluator.replace(normalized,1);
  evaluator.applyAudioSnapshot({...duringPause,sequence:3,kickSequence:3},{playing:true,timeSeconds:1});
  normalized=normalizeControlAnimations([kick({enabled:true,attackMs:0,releaseMs:100})],profile);
  evaluator.replace(normalized,1);
  assert.equal(evaluator.values(1).gain,0,'enabling does not replay an event received while disabled');
});

test('kick exponential envelope completes exactly and preserves audio configuration compatibility',()=>{
  const extendedNode={...node,schema:[...schema,{...schema[0],id:'other',label:'Other'}]};
  const normalized=normalizeControlAnimations([audio(),kick({controlId:'other',envelope:'exponential',attackMs:0,releaseMs:100})],{...profile,nodes:[extendedNode]});
  assert.deepEqual(normalized.issues,[]);
  const evaluator=createControlAnimationEvaluator({...profile,nodes:[extendedNode]},{values:()=>({gain:0}),nodeValues:()=>({gain:0,other:0})},normalized);
  evaluator.applyAudioSnapshot({generation:1,sequence:1,available:true,level:0,bass:0,mids:0,highs:0,kickSequence:1,kickStrength:1},{playing:true,timeSeconds:0});
  assert.equal(evaluator.nodeValues([],0).other,.5);
  const halfway=evaluator.nodeValues([],.05).other;
  assert.ok(halfway>0&&halfway<.25,'exponential release falls faster than linear');
  assert.equal(evaluator.nodeValues([],.1).other,0);
});
