const need=(condition,message)=>{if(!condition)throw Error(message);};
const uint=value=>{need(typeof value==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(value)&&BigInt(value)<=0xffffffffffffffffn,'Invalid GPU ticks');return BigInt(value);};
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const gcd=(a,b)=>{while(b){const remainder=a%b;a=b;b=remainder;}return a;};
export function summarizeQueryOverhead(evidence){
 need(evidence?.schema===1&&Array.isArray(evidence.batches)&&evidence.batches.length===40,'Expected8 warmup and32 measured batches');
 need(evidence.settings?.width===1920&&evidence.settings.height===1080&&evidence.settings.framesPerBatch===30&&evidence.settings.warmupBatches===8&&evidence.settings.abbaBlocks===8&&evidence.settings.batchLimitMs===100&&evidence.settings.shaderIterations===8,'Controlled workload settings changed');
 need(evidence.errors?.length===0&&evidence.timer?.completedSamples===20&&evidence.timer.failedSamples===0&&evidence.timer.droppedSamples===0&&evidence.timer.pendingSamples===0,'Incomplete actual timer samples');
 need(Array.isArray(evidence.samples)&&evidence.samples.length===20,'Missing routine sample inventory');
 const routineFrames=[],durations=[],rawTicks=[];let previousEnd=0n;
 for(const [i,b] of evidence.batches.entries()){
  const expectedMode=i<8?(i%2?'routine':'baseline'):['baseline','routine','routine','baseline'][(i-8)%4];
  need(b.index===i&&b.mode===expectedMode&&b.firstFrame===i*30+1&&b.frames===30&&b.warmup===(i<8),'Batch order/workload changed');
  const start=uint(b.start),end=uint(b.end);need(start>previousEnd&&end>start,'Reversed/unwritten/replayed GPU endpoints');previousEnd=end;
  const duration=Number(end-start)/1e6;need(duration<=100,'GPU batch exceeded100ms; cannot continue/drop it');durations.push(duration);rawTicks.push(start,end);
  const routine=b.mode==='routine';need(b.staging?.realSubmissions===1&&b.staging.commandBuffers===(routine?33:32)&&b.staging.logicalSubmissionGroups===(routine?31:30)&&b.staging.deferredMaps===(routine?1:0),'Batch staging omitted or added work');
  if(routine)routineFrames.push(b.firstFrame);
 }
 need(evidence.samples.every((s,i)=>s.frame===routineFrames[i]&&Number.isFinite(s.ms)&&s.ms>=0&&s.complete===true),'Routine frame sampling does not match actual eligible frames');
 const effects=[],baselineMeans=[],routineMeans=[];
 for(let block=0;block<8;block++){const index=8+block*4,baseline=(durations[index]+durations[index+3])/2,routine=(durations[index+1]+durations[index+2])/2;baselineMeans.push(baseline);routineMeans.push(routine);effects.push(routine-baseline);}
 const average=mean(effects),sd=Math.sqrt(effects.reduce((sum,x)=>sum+(x-average)**2,0)/7),half=2.364624251*sd/Math.sqrt(8);
 // Deliberately conservative, assumption-labelled. This is not calibration.
 // Chrome documents100us timestamp quantization; exact pinned precision can differ.
 const endpointEnvelopeNs=100000,deltaEnvelopeMs=4*endpointEnvelopeNs/1e6;
 const interval95Ms=[average-half,average+half],expanded95Ms=[interval95Ms[0]-deltaEnvelopeMs,interval95Ms[1]+deltaEnvelopeMs];
 const baselineMean=mean(baselineMeans);need(baselineMean>0,'Nonpositive baseline denominator');
 let lattice=0n;for(const value of rawTicks)lattice=gcd(lattice,value);
 return {scope:'Direct GPU query/resolve/copy cost on a controlled30-frame batch',batchEffectsMs:effects,meanDeltaMs:average,amortizedDeltaPerFrameMs:average/30,meanBaselineBatchMs:baselineMean,meanRoutineBatchMs:mean(routineMeans),
  deltaPercentOfBaseline:average/baselineMean*100,expanded95PercentOfBaseline:expanded95Ms.map(x=>x/baselineMean*100),percentDenominator:'Observed baseline mean held fixed; same conditional assumptions as delta interval',
  statistical95IntervalMs:interval95Ms,expanded95IntervalMs:expanded95Ms,amortizedExpanded95IntervalMs:expanded95Ms.map(x=>x/30),
  uncertainty:{method:'Student t across8 ABBA block effects; descriptive conditional interval',observedEndpointLatticeNs:lattice.toString(),assumedEndpointErrorEnvelopeNs:endpointEnvelopeNs,deltaEnvelopeMs,calibrated:false,source:'https://developer.chrome.com/blog/new-in-webgpu-121'},
  conclusion:expanded95Ms[0]>0?'Positive controlled GPU queue interval delta resolved':expanded95Ms[1]<0?'Negative controlled queue delta; no positive overhead established':'Inconclusive: sign and magnitude not resolved above noise/envelope',
  fullStudioOverheadAcceptance:'unavailable',cpuHookCostMeasured:false,activeGpuBusyTimeMeasured:false,quantizationDisabled:false};
}
