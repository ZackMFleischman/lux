const freeze=Object.freeze,finite=Number.isFinite,safe=Number.isSafeInteger,maxSequence=Number.MAX_SAFE_INTEGER;
const RuntimeRangeError=RangeError,RuntimeTypeError=TypeError,call=Function.prototype.call;
const arrayPush=call.bind(Array.prototype.push),arrayShift=call.bind(Array.prototype.shift);

function bpmValue(value){if(!finite(value)||value<20||value>300)throw new RuntimeRangeError('Tempo BPM must be from 20 through 300');return value;}
function sequenceValue(value){if(!safe(value)||value<0)throw new RuntimeRangeError('Tempo sequence must be a nonnegative safe integer');return value;}
function visualTime(value){if(!finite(value)||value<0)throw new RuntimeRangeError('Tempo visual time must be finite and nonnegative');return value;}
const phase=value=>((value%1)+1)%1;

export function createTempoClock({nowMs,bpm=120,tempoSequence=0}={}){
 if(typeof nowMs!=='function')throw new RuntimeTypeError('An injected monotonic clock is required');
 bpm=bpmValue(bpm);tempoSequence=sequenceValue(tempoSequence);
 let anchorTimeSeconds=0,anchorBeat=0,lastSampleMs=0,acceptedTapMs,intervals=[];
 const position=timeSeconds=>anchorBeat+(visualTime(timeSeconds)-anchorTimeSeconds)*bpm/60;
 const snapshot=timeSeconds=>{const beatPosition=position(timeSeconds);return freeze({bpm,beatPosition,beatPhase:phase(beatPosition),tempoSequence});};
 const clearTaps=()=>{acceptedTapMs=undefined;intervals=[];};
 const rephase=timeSeconds=>{anchorTimeSeconds=timeSeconds;anchorBeat=0;};
 const nextSequence=()=>{if(tempoSequence===maxSequence)throw new RuntimeRangeError('Tempo sequence exhausted');};
 function setBpm(nextBpm,timeSeconds){
  nextBpm=bpmValue(nextBpm);timeSeconds=visualTime(timeSeconds);
  nextSequence();
  const beatPosition=position(timeSeconds),same=nextBpm===bpm;
  if(!same){anchorBeat=beatPosition;anchorTimeSeconds=timeSeconds;bpm=nextBpm;clearTaps();}
  tempoSequence++;
  return freeze({...snapshot(timeSeconds),tempoResult:same?'same-bpm':'applied'});
 }
 function tap(timeSeconds){
  timeSeconds=visualTime(timeSeconds);nextSequence();
  const sample=nowMs();if(!finite(sample)||sample<0||sample<lastSampleMs)throw new RuntimeRangeError('Tempo monotonic clock returned an invalid sample');lastSampleMs=sample;
  let tempoResult;
  if(acceptedTapMs===undefined){acceptedTapMs=sample;intervals=[];rephase(timeSeconds);tempoResult='restarted';}
  else {
   const interval=sample-acceptedTapMs;
   if(interval<200)tempoResult='ignored-short';
   else if(interval>2000){acceptedTapMs=sample;intervals=[];rephase(timeSeconds);tempoResult='restarted';}
   else {acceptedTapMs=sample;arrayPush(intervals,interval);if(intervals.length>4)arrayShift(intervals);let total=0;for(let index=0;index<intervals.length;index++)total+=intervals[index];bpm=60000/(total/intervals.length);rephase(timeSeconds);tempoResult='accepted';}
  }
  tempoSequence++;return freeze({...snapshot(timeSeconds),tempoResult});
 }
 function reset(timeSeconds){timeSeconds=visualTime(timeSeconds);rephase(timeSeconds);clearTaps();return snapshot(timeSeconds);}
 return freeze({snapshot,setBpm,tap,reset});
}
