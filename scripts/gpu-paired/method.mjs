export const plan=Object.freeze({pairs:5,warmupFrames:60,measuredFrames:240,totalFrames:300,trialDeadlineMs:100000,processDeadlineMs:120000,
 referencePhase:16,sampleEvery:30,quantumNs:65536,framePeriodMs:1000/60,
 metric:'render/compute pass perturbation on reference frames',totalGpuOverheadGate:'unavailable'});
export const order=Object.freeze(Array.from({length:5},(_,pair)=>({pair,modes:pair%2?['routine','baseline']:['baseline','routine']})));
export const referenceFrame=frame=>frame>=16&&(frame-16)%30===0;
export function completeWithJob(result,job){return {...result,pendingSupervisorCleanup:false,job,
 ok:result.measurementValid===true&&result.appClosed===true&&result.errors?.length===0&&job.cleanupComplete===true&&job.exitCode===0&&job.timeout===false&&job.cancelled===false};}
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
export function summarize(legs){
 const issues=[],summaries=[];
 if(JSON.stringify(legs.map(row=>[row.pair,row.mode]))!==JSON.stringify(order.flatMap(p=>p.modes.map(mode=>[p.pair,mode]))))issues.push('Leg order differs from declared alternating order');
 if(legs.length!==10)issues.push('Expected ten complete legs');
 const identities=new Set(),first=legs[0]?.data;
 for(const leg of legs){
  const identity=leg.pair+'/'+leg.mode;if(identities.has(identity)||!order.some(p=>p.pair===leg.pair&&p.modes.includes(leg.mode)))issues.push('Duplicate/unknown leg '+identity);identities.add(identity);
  if(leg.data.performanceMode!==leg.mode||leg.data.frameId!=='300'||leg.data.timeSeconds!==0||leg.data.controlSequence!==0)issues.push(identity+': runtime mode/frame/clock mismatch');
  for(const field of ['adapter','controls','controlSchemaHash','revisionId'])if(JSON.stringify(leg.data[field])!==JSON.stringify(first?.[field]))issues.push(identity+': changed '+field);
  if(leg.data.reference.timestampQueryEnabled!==true||leg.data.routine.timestampQueryEnabled!==(leg.mode==='routine'))issues.push(identity+': query capability mismatch');
  const expected=Array.from({length:plan.totalFrames},(_,i)=>i+1).filter(referenceFrame);
  const samples=leg.data.raw.filter(r=>r.timer==='reference'),frames=samples.map(r=>r.frame).sort((a,b)=>a-b);
  if(JSON.stringify(frames)!==JSON.stringify(expected))issues.push(`pair${leg.pair}/${leg.mode}: missing/duplicate reference frames`);
  const normal=leg.data.raw.filter(r=>r.timer==='routine').map(r=>r.frame).sort((a,b)=>a-b);
  const normalExpected=leg.mode==='routine'?Array.from({length:10},(_,i)=>1+i*30):[];
  if(JSON.stringify(normal)!==JSON.stringify(normalExpected))issues.push(`pair${leg.pair}/${leg.mode}: routine schedule mismatch`);
  for(const key of ['reference','routine']){const s=leg.data[key];if(s.failedSamples||s.droppedSamples||s.pendingSamples)issues.push(`pair${leg.pair}/${leg.mode}: ${key} missing/invalid queries`);}
  const measured=samples.filter(r=>r.frame>plan.warmupFrames),durations=[],errors=[];
  for(const row of measured){
   if(!Number.isInteger(row.raw?.passCount)||row.raw.passCount<1||row.raw.timestampsNs.length!==row.raw.passCount*2)throw Error('Invalid raw pass population');
   let ns=0n;for(let i=0;i<row.raw.timestampsNs.length;i+=2){const a=BigInt(row.raw.timestampsNs[i]),b=BigInt(row.raw.timestampsNs[i+1]);if(a<=0n||b<a)throw Error('Invalid raw timestamp');ns+=b-a;}
   const ms=Number(ns)/1e6;if(Math.abs(ms-row.ms)>1e-12)throw Error('GPU duration disagrees with raw queries');
   durations.push(ms);errors.push(2*plan.quantumNs*row.raw.passCount/1e6);
  }
  summaries.push({pair:leg.pair,mode:leg.mode,samples:durations.length,meanMs:durations.length?mean(durations):null,
   quantizationErrorBoundMs:errors.length?mean(errors):null,passCounts:measured.map(r=>r.raw.passCount),
   copiesUploadsAndClearsExcluded:true,completeFlags:measured.map(r=>r.complete)});
 }
 const pairs=[];
 for(let pair=0;pair<plan.pairs;pair++){
  const b=summaries.find(r=>r.pair===pair&&r.mode==='baseline'),r=summaries.find(r=>r.pair===pair&&r.mode==='routine');
  if(!b||!r||!b.meanMs||!r.meanMs){issues.push(`pair${pair}: incomplete`);continue;}
  if(JSON.stringify(b.passCounts)!==JSON.stringify(r.passCounts))issues.push(`pair${pair}: reference pass population changed`);
  const lowB=Math.max(0,b.meanMs-b.quantizationErrorBoundMs),highB=b.meanMs+b.quantizationErrorBoundMs;
  const lowR=Math.max(0,r.meanMs-r.quantizationErrorBoundMs),highR=r.meanMs+r.quantizationErrorBoundMs;
  pairs.push({pair,ratio:r.meanMs/b.meanMs,percent:(r.meanMs/b.meanMs-1)*100,
   quantizationPercentBounds:[(lowR/highB-1)*100,lowB>0?(highR/lowB-1)*100:null]});
 }
 // Resample whole pairs, never individual autocorrelated frames. Deterministic seed.
 let seed=0x18273645;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const bootstrap=[];
 if(pairs.length===5)for(let i=0;i<10000;i++)bootstrap.push(mean(Array.from({length:5},()=>pairs[Math.floor(random()*5)].percent)));
 bootstrap.sort((a,b)=>a-b);
 return {metric:plan.metric,validity:issues.length?'incomplete':'diagnostic',issues,legs:summaries,pairs,
  meanPairedPercent:pairs.length?mean(pairs.map(p=>p.percent)):null,
  pairedBootstrap95Percent:bootstrap.length?[bootstrap[249],bootstrap[9749]]:null,
  systematicQuantizationPercentBounds:pairs.length?[mean(pairs.map(p=>p.quantizationPercentBounds[0])),pairs.some(p=>p.quantizationPercentBounds[1]===null)?null:mean(pairs.map(p=>p.quantizationPercentBounds[1]))]:null,
  quantizationAssumption:'Prior observed65536ns quantum treated as endpoint uncertainty; sum bound2*quantum per pass. Null upper bound means unbounded. Bootstrap does not remove this systematic bound.',
  totalGpuOverheadGate:'unavailable',reason:'Reference frames exclude real routine query frames; pass sums omit uploads/copies/query resolve/readback. This is not direct collector GPU overhead or total visual GPU cost.'};
}
