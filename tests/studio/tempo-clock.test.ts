import test from 'node:test';
import assert from 'node:assert/strict';
import {createTempoClock} from '../../apps/studio/src/controls/tempo-clock.mjs';

const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);

test('tempo clock derives beat position and phase from visual time',()=>{
  const clock=createTempoClock({nowMs:()=>0});
  assert.deepEqual(clock.snapshot(0),{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:0});
  assert.deepEqual(clock.snapshot(.5),{bpm:120,beatPosition:1,beatPhase:0,tempoSequence:0});
  assert.deepEqual(clock.snapshot(.75),{bpm:120,beatPosition:1.5,beatPhase:.5,tempoSequence:0});
});

test('manual BPM changes preserve phase and acknowledge same-BPM writes',()=>{
  const clock=createTempoClock({nowMs:()=>0,bpm:120});
  const applied=clock.setBpm(60,2.25);
  assert.equal(applied.tempoResult,'applied');
  assert.equal(applied.tempoSequence,1);
  near(applied.beatPosition,4.5);near(applied.beatPhase,.5);
  const later=clock.snapshot(2.75);near(later.beatPosition,5);near(later.beatPhase,0);
  assert.deepEqual(clock.setBpm(60,3),{bpm:60,beatPosition:5.25,beatPhase:.25,tempoSequence:2,tempoResult:'same-bpm'});
});

test('reset keeps BPM and sequence while establishing beat zero at supplied visual time',()=>{
  const clock=createTempoClock({nowMs:()=>0,bpm:90,tempoSequence:4});
  clock.setBpm(120,2);
  assert.deepEqual(clock.reset(7),{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:5});
  assert.deepEqual(clock.snapshot(7.5),{bpm:120,beatPosition:1,beatPhase:0,tempoSequence:5});
});

test('tempo clock rejects invalid settings and visual times before mutation',()=>{
  for(const bpm of [19,301,NaN,Infinity])assert.throws(()=>createTempoClock({nowMs:()=>0,bpm}),/BPM/);
  for(const tempoSequence of [-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>createTempoClock({nowMs:()=>0,tempoSequence}),/sequence/);
  assert.throws(()=>createTempoClock({nowMs:null as never}),/monotonic clock/);
  const clock=createTempoClock({nowMs:()=>0});
  for(const time of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER/1000+1,Number.MAX_VALUE]){
    assert.throws(()=>clock.snapshot(time),/visual time/);
    assert.throws(()=>clock.setBpm(100,time),/visual time/);
    assert.throws(()=>clock.reset(time),/visual time/);
  }
  assert.deepEqual(clock.snapshot(0),{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:0});
  assert.throws(()=>clock.setBpm(19,0),/BPM/);
  assert.deepEqual(clock.snapshot(0),{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:0});
});

test('tempo clock accepts the RuntimeClock upper time boundary without overflowing',()=>{
  const time=Number.MAX_SAFE_INTEGER/1000,clock=createTempoClock({nowMs:()=>0,bpm:300});
  const snapshot=clock.snapshot(time);
  assert.equal(snapshot.beatPosition,Number.MAX_SAFE_INTEGER/200);
  assert.ok(Number.isFinite(snapshot.beatPhase));
});

test('tempo sequence exhaustion rejects an admitted set before mutation',()=>{
  const clock=createTempoClock({nowMs:()=>0,bpm:100,tempoSequence:Number.MAX_SAFE_INTEGER});
  assert.throws(()=>clock.setBpm(120,1),/sequence exhausted/);
  const after=clock.snapshot(1);assert.equal(after.bpm,100);assert.equal(after.tempoSequence,Number.MAX_SAFE_INTEGER);
  near(after.beatPosition,5/3);near(after.beatPhase,2/3);
});

test('first and paused taps rephase beat zero before an accepted interval sets BPM',()=>{
  let now=1000;const clock=createTempoClock({nowMs:()=>now,bpm:90});
  assert.deepEqual(clock.tap(4),{bpm:90,beatPosition:0,beatPhase:0,tempoSequence:1,tempoResult:'restarted'});
  now=1500;
  assert.deepEqual(clock.tap(4),{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:2,tempoResult:'accepted'});
  assert.deepEqual(clock.snapshot(4.5),{bpm:120,beatPosition:1,beatPhase:0,tempoSequence:2});
});

test('tap window retains only the newest four accepted intervals',()=>{
  let now=0;const clock=createTempoClock({nowMs:()=>now});
  clock.tap(0);
  for(const interval of [500,1000,1500,2000,500]){now+=interval;clock.tap(now/1000);}
  const after=clock.snapshot(now/1000);
  assert.equal(after.bpm,48);assert.equal(after.tempoSequence,6);near(after.beatPosition,0);near(after.beatPhase,0);
});

test('ignored short tap does not advance accepted timestamp, history or phase',()=>{
  let now=1000;const clock=createTempoClock({nowMs:()=>now,bpm:100});
  clock.tap(2);now=1199;
  const ignored=clock.tap(2.1);
  assert.equal(ignored.tempoResult,'ignored-short');assert.equal(ignored.bpm,100);assert.equal(ignored.tempoSequence,2);
  near(ignored.beatPosition,1/6);near(ignored.beatPhase,1/6);
  now=1500;
  assert.deepEqual(clock.tap(2.5),{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:3,tempoResult:'accepted'});
});

test('long tap gap restarts history and keeps BPM until a new accepted interval',()=>{
  let now=1000;const clock=createTempoClock({nowMs:()=>now,bpm:100});
  clock.tap(1);now=3001;
  assert.deepEqual(clock.tap(3),{bpm:100,beatPosition:0,beatPhase:0,tempoSequence:2,tempoResult:'restarted'});
  now=3501;
  assert.deepEqual(clock.tap(3.5),{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:3,tempoResult:'accepted'});
});

test('manual BPM set and reset clear prior tap history',()=>{
  let now=1000;const clock=createTempoClock({nowMs:()=>now});
  clock.tap(1);now=1500;clock.tap(1.5);
  clock.setBpm(100,2);now=2000;
  assert.equal(clock.tap(2.5).tempoResult,'restarted');
  now=2500;assert.equal(clock.tap(3).tempoResult,'accepted');
  clock.reset(4);now=3000;
  assert.equal(clock.tap(4).tempoResult,'restarted');
});

test('tap rejects invalid monotonic samples and sequence exhaustion before mutation',()=>{
  let now=-1;const clock=createTempoClock({nowMs:()=>now,bpm:80,tempoSequence:3});
  assert.throws(()=>clock.tap(0),/monotonic/);assert.equal(clock.snapshot(0).tempoSequence,3);
  now=1000;assert.equal(clock.tap(0).tempoSequence,4);
  now=NaN;assert.throws(()=>clock.tap(0),/monotonic/);assert.equal(clock.snapshot(0).tempoSequence,4);
  now=999;assert.throws(()=>clock.tap(0),/monotonic/);assert.equal(clock.snapshot(0).tempoSequence,4);
  now=Number.MAX_SAFE_INTEGER+1;assert.throws(()=>clock.tap(0),/monotonic/);assert.equal(clock.snapshot(0).tempoSequence,4);
  now=Number.MAX_VALUE;assert.throws(()=>clock.tap(0),/monotonic/);assert.equal(clock.snapshot(0).tempoSequence,4);
  const exhausted=createTempoClock({nowMs:()=>1000,bpm:80,tempoSequence:Number.MAX_SAFE_INTEGER});
  assert.throws(()=>exhausted.tap(0),/sequence exhausted/);
  assert.equal(exhausted.snapshot(0).tempoSequence,Number.MAX_SAFE_INTEGER);
});

test('tap accepts the RuntimeClock safe millisecond boundary',()=>{
  const clock=createTempoClock({nowMs:()=>Number.MAX_SAFE_INTEGER,bpm:80});
  assert.deepEqual(clock.tap(0),{bpm:80,beatPosition:0,beatPhase:0,tempoSequence:1,tempoResult:'restarted'});
});

test('replacement initialization accepts acknowledged BPM and sequence with fresh phase',()=>{
  const clock=createTempoClock({nowMs:()=>5000,bpm:137.5,tempoSequence:9});
  assert.deepEqual(clock.snapshot(0),{bpm:137.5,beatPosition:0,beatPhase:0,tempoSequence:9});
  assert.equal(clock.tap(0).tempoResult,'restarted');
  assert.equal(clock.snapshot(0).tempoSequence,10);
});

test('candidate synchronization adopts the acknowledged sequence with fresh beat and tap history',()=>{
  let now=1000;const clock=createTempoClock({nowMs:()=>now,bpm:120,tempoSequence:2});clock.tap(1);now=1500;clock.tap(1.5);
  assert.deepEqual(clock.synchronize(137.5,9,3),{bpm:137.5,beatPosition:0,beatPhase:0,tempoSequence:9});
  now=2000;assert.equal(clock.tap(3).tempoResult,'restarted');assert.equal(clock.snapshot(3).tempoSequence,10);
});
