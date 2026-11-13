import {audioSpectrumBins} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
import { normalizeAudioAnalyzerConfig } from './audio-contract.mjs';

const freeze = Object.freeze;
const finite = Number.isFinite;
const sqrt = Math.sqrt;
const pow = Math.pow;
const min = Math.min;
const max = Math.max;
const exp = Math.exp;

function rms(sum, count) {
  return count === 0 ? 0 : sqrt(sum / count);
}

function unitAmplitude(decibels, floorAmplitude, ceilingAmplitude, span) {
  if (decibels === -Infinity) return 0;
  if (!finite(decibels)) throw new Error('Invalid audio sample');
  const amplitude = pow(10, decibels / 20);
  return min(1, max(0, (amplitude - floorAmplitude) / span));
}

export function analyzeAudioFrame(timeDomain, frequencyDecibels, sampleRate, inputConfig) {
  const config = normalizeAudioAnalyzerConfig(inputConfig);
  if (!(timeDomain instanceof Float32Array) || timeDomain.length !== config.fftSize) {
    throw new Error('Invalid audio time-domain frame');
  }
  if (!(frequencyDecibels instanceof Float32Array) || frequencyDecibels.length !== config.fftSize / 2) {
    throw new Error('Invalid audio frequency frame');
  }
  if (!finite(sampleRate) || sampleRate < 8000 || sampleRate > 384000) throw new Error('Invalid audio sample rate');

  let levelSum = 0;
  for (const value of timeDomain) {
    if (!finite(value)) throw new Error('Invalid audio sample');
    const bounded = min(1, max(-1, value));
    levelSum += bounded * bounded;
  }

  const floorAmplitude = pow(10, config.minDecibels / 20);
  const ceilingAmplitude = pow(10, config.maxDecibels / 20);
  const amplitudeSpan = ceilingAmplitude - floorAmplitude;
  let bassSum = 0, bassCount = 0, midsSum = 0, midsCount = 0, highsSum = 0, highsCount = 0;
  for (let index = 0; index < frequencyDecibels.length; index++) {
    const frequency = index * sampleRate / config.fftSize;
    if (frequency < 20) continue;
    const value = unitAmplitude(frequencyDecibels[index], floorAmplitude, ceilingAmplitude, amplitudeSpan);
    if (frequency < 250) { bassSum += value * value; bassCount++; }
    else if (frequency < 2000) { midsSum += value * value; midsCount++; }
    else { highsSum += value * value; highsCount++; }
  }
  return freeze({ level: rms(levelSum, timeDomain.length), bass: rms(bassSum, bassCount),
    mids: rms(midsSum, midsCount), highs: rms(highsSum, highsCount) });
}

export function createKickTransientDetector() {
  let initialized=false,baseline=0,lastSampleMs=0,armed=true,tracking=false,episodePeak=0;
  return freeze({
    sample(bass,timeMs) {
      if(!finite(bass)||bass<0||bass>1)throw new Error('Invalid kick detector sample');
      if(!finite(timeMs)||timeMs<0||(initialized&&timeMs<lastSampleMs))throw new Error('Invalid kick detector time');
      if(!initialized){initialized=true;baseline=bass;lastSampleMs=timeMs;return 0;}
      const deltaMs=min(250,max(0,timeMs-lastSampleMs));
      const score=min(1,max(0,(bass-baseline)/max(.25,1-baseline)));
      const tau=bass>baseline?500:1500,alpha=deltaMs===0?0:1-exp(-deltaMs/tau);
      baseline+= (bass-baseline)*alpha;lastSampleMs=timeMs;
      if(tracking){
        if(score>=episodePeak){episodePeak=score;return 0;}
        const emitted=episodePeak;tracking=false;episodePeak=0;armed=false;return emitted;
      }
      if(!armed){if(score<.025)armed=true;return 0;}
      if(score>=.05){tracking=true;episodePeak=score;}
      return 0;
    },
    reset(){initialized=false;baseline=0;lastSampleMs=0;armed=true;tracking=false;episodePeak=0;},
  });
}

export function createWebAudioBandAnalyzer(context, stream, inputConfig) {
  const config = normalizeAudioAnalyzerConfig(inputConfig);
  if (!context || !finite(context.sampleRate) || typeof context.createMediaStreamSource !== 'function' ||
      typeof context.createAnalyser !== 'function') throw new Error('Invalid Web Audio context');
  const source = context.createMediaStreamSource(stream);
  const analyzer = context.createAnalyser();
  analyzer.fftSize = config.fftSize;
  analyzer.minDecibels = config.minDecibels;
  analyzer.maxDecibels = config.maxDecibels;
  analyzer.smoothingTimeConstant = 0;
  if (analyzer.frequencyBinCount !== config.fftSize / 2 || typeof analyzer.getFloatTimeDomainData !== 'function' ||
      typeof analyzer.getFloatFrequencyData !== 'function') throw new Error('Invalid Web Audio analyzer');
  source.connect(analyzer);
  const timeDomain = new Float32Array(config.fftSize);
  const frequency = new Float32Array(config.fftSize / 2);
  const kick=createKickTransientDetector();
  let disposed = false;
  return freeze({
    sample(timeMs) {
      if (disposed) throw new Error('Audio analyzer is disposed');
      analyzer.getFloatTimeDomainData(timeDomain);
      analyzer.getFloatFrequencyData(frequency);
      const bands=analyzeAudioFrame(timeDomain, frequency, context.sampleRate, config);
      return freeze({...bands,kickStrength:kick.sample(bands.bass,timeMs),spectrum:analyzeAudioSpectrum(frequency,context.sampleRate,config)});
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      kick.reset();
      source.disconnect();
      analyzer.disconnect();
    },
  });
}

export function analyzeAudioSpectrum(frequencyDecibels,sampleRate,inputConfig){
 const config=normalizeAudioAnalyzerConfig(inputConfig);
 if(!(frequencyDecibels instanceof Float32Array)||frequencyDecibels.length!==config.fftSize/2||!finite(sampleRate)||sampleRate<8000||sampleRate>384000)throw new Error('Invalid audio frequency frame');
 const floorAmplitude=pow(10,config.minDecibels/20),ceilingAmplitude=pow(10,config.maxDecibels/20),span=ceilingAmplitude-floorAmplitude;
 const minFrequency=20,maxFrequency=sampleRate/2,ratio=maxFrequency/minFrequency,magnitudes=[];
 for(let bucket=0;bucket<audioSpectrumBins;bucket++){
  const low=minFrequency*pow(ratio,bucket/audioSpectrumBins),high=minFrequency*pow(ratio,(bucket+1)/audioSpectrumBins);
  const first=min(frequencyDecibels.length-1,max(1,Math.floor(low*config.fftSize/sampleRate))),end=min(frequencyDecibels.length,max(first+1,Math.ceil(high*config.fftSize/sampleRate)));
  let peak=0;for(let index=first;index<end;index++)peak=max(peak,unitAmplitude(frequencyDecibels[index],floorAmplitude,ceilingAmplitude,span));magnitudes[bucket]=peak;
 }
 return freeze({sampleRate,fftSize:2048,scale:'log',minFrequency,maxFrequency,magnitudes:freeze(magnitudes)});
}
