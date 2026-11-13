import test from 'node:test';
import assert from 'node:assert/strict';
import * as analysis from '../../apps/studio/src/audio/audio-analysis.mjs';
import * as contract from '../../packages/runtime-contracts/src/audio-input.mjs';
const config={version:1,fftSize:2048,minDecibels:-100,maxDecibels:-20};
const snapshot=(sequence,spectrum,available=true)=>({generation:1,sequence,available,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0,...(spectrum?{spectrum}:{})});
test('real FFT tones populate their logarithmic frequency buckets without invented oscillations',()=>{
 const fft=new Float32Array(1024).fill(-Infinity);fft[43]=-20; // 1007.8125Hz at 48kHz.
 assert.equal(typeof analysis.analyzeAudioSpectrum,'function');
 const spectrum=analysis.analyzeAudioSpectrum(fft,48000,config);
 assert.equal(spectrum.magnitudes.length,128);assert.equal(spectrum.sampleRate,48000);assert.equal(spectrum.maxFrequency,24000);
 const peak=spectrum.magnitudes.indexOf(1);assert.ok(peak>=0);
 const low=20*Math.pow(1200,peak/128),high=20*Math.pow(1200,(peak+1)/128);
 assert.ok(low<1050&&high>960,'the peak must lie near the measured 1kHz FFT tone');
 assert.equal(spectrum.magnitudes[0],0);assert.equal(spectrum.magnitudes[127],0);
 fft.fill(-Infinity);assert.ok(analysis.analyzeAudioSpectrum(fft,48000,config).magnitudes.every(value=>value===0));
});
test('spectrum snapshot bounds reject malformed values and the frame view freezes paused data and clears disconnect',()=>{
 assert.equal(typeof contract.createAudioSpectrumFrameState,'function');
 const data={sampleRate:48000,fftSize:2048,scale:'log',minFrequency:20,maxFrequency:24000,magnitudes:Array(128).fill(.5)};
 const state=contract.createAudioSpectrumFrameState();
 assert.equal(state.apply(snapshot(1,data)),true);const first=state.frame(true);
 assert.equal(first.magnitudes[4],.5);assert.ok(Object.isFrozen(first));assert.ok(Object.isFrozen(first.magnitudes));
 data.magnitudes[4]=.9;assert.equal(first.magnitudes[4],.5);
 state.apply(snapshot(2,{...data,magnitudes:Array(128).fill(.8)}));assert.equal(state.frame(false),first);
 assert.equal(state.frame(true).magnitudes[4],.8);assert.equal(state.apply(snapshot(1,data)),false);
 state.reset();assert.ok(state.frame(true).magnitudes.every(value=>value===0));
 state.apply(snapshot(3,null,false));assert.equal(state.frame(false).available,false);assert.ok(state.frame(false).magnitudes.every(value=>value===0));
 for(const magnitudes of [Array(129).fill(0),Array(128).fill(NaN),Array(128).fill(2)])assert.throws(()=>contract.normalizeAudioBandSnapshot(snapshot(4,{...data,magnitudes})));
 assert.throws(()=>contract.normalizeAudioBandSnapshot(snapshot(4,{...data,magnitudes:Array(128).fill(.1)},false)));
});
