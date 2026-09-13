const check=(ok,message)=>{if(!ok)throw Error(message);};
const tick=x=>{check(typeof x==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(x)&&BigInt(x)<=0xffffffffffffffffn,'Invalid QPC');return BigInt(x);};
const quantiles=values=>{values.sort((a,b)=>a-b);const q=p=>values.length?values[Math.ceil(p*values.length)-1]:null;return {p50:q(.5),p95:q(.95),p99:q(.99),max:values.at(-1)??null};};
export function inspectCadence({experiment,probe,host,lifecycle,expected}){
 check(experiment?.outcome==='success'&&experiment.cleanupComplete===true&&experiment.result?.cleanupComplete===true&&experiment.result.exitCode===0&&experiment.result.timeout===false&&experiment.result.cancelled===false&&experiment.timeoutMs===30000,'Incomplete supervised run/budget');
 check(probe?.mode==='cadence-v1'&&probe.runId===experiment.id&&probe.hostPid===experiment.child?.pid&&probe.ok===true&&probe.deinstantiated===true&&probe.deinitialized===true&&probe.lostRecords===0,'Invalid probe identity/cleanup');
 check(expected&&/^[a-f0-9]{64}$/.test(expected.releaseId)&&/^[a-f0-9]{64}$/.test(expected.revisionId),'Missing immutable source identity');
 const f=tick(probe.clock?.frequency),start=tick(probe.start),end=tick(probe.end),coverageEnd=tick(probe.coverageEnd);
 check(probe.clock?.domain==='qpc'&&f>=60n&&f<=1000000000n&&end-start===10n*f&&coverageEnd>=end,'Invalid full 10 s window');
 const childStart=tick(experiment.child.startTicks),childEnd=tick(experiment.result.endTicks);
 check(Number.isSafeInteger(experiment.child.frequency)&&BigInt(experiment.child.frequency)===f&&childStart<=start&&coverageEnd<=childEnd,'Supervisor QPC envelope mismatch');
 check(Array.isArray(probe.slots)&&probe.slots.length===600&&Array.isArray(host)&&host.length<=10000,'Invalid bounded records');
 const ops=host.filter(x=>x.kind==='host-opportunity'),clocks=host.filter(x=>x.kind==='native-clock'),summaries=host.filter(x=>x.kind==='host-telemetry-summary');
 check(clocks.length===1&&clocks[0].domain==='qpc'&&tick(clocks[0].frequency)===f,'Host clock mismatch');
 check(summaries.length===1&&summaries[0].lostRecords===0&&summaries[0].recorded===ops.length,'Lost host records');
 const instanceId=summaries[0].instanceId;check(/^[a-f0-9]{32}$/.test(instanceId)&&!host.some(x=>['failure','bounded-unload-unsupported'].includes(x.kind)),'Host identity/failure');
 const ms=n=>Number(n)*1000/Number(f),spans=[],lateness=[];let calls=0,missed=0,previousAfter=start,previousAt=0n,noFrame=0,held=0,selected=0,lastIdentity=null,lastGeneration=0,lastFrame=0n,lastCopy=null;
 for(const [i,s] of probe.slots.entries()){
  const due=tick(s.due);check(s.slot===i&&due===start+BigInt(i)*f/60n,'Invalid slot/deadline');
  if(s.missed===true){check(s.sequence===0&&s.success===false&&s.before==='0'&&s.after==='0','Missed slot has fabricated callback');missed++;continue;}
  check(s.missed===false&&s.success===true&&s.sequence===calls+1,'Failed/reordered callback');
  const before=tick(s.before),after=tick(s.after),o=ops[calls++];check(o,'Missing callback opportunity');const at=tick(o.at);
  check(before>=due&&before>=previousAfter&&before<end&&after>=before&&after<=coverageEnd&&o.sequence===calls&&o.instanceId===instanceId&&at>=before&&at<=after&&at<end&&at>previousAt,'Callback ordinal/QPC join mismatch');
  // Never execute an old slot after a newer nominal slot became due.
  check(i===599||before<start+BigInt(i+1)*f/60n,'Catch-up callback uses obsolete slot');
  previousAfter=after;previousAt=at;spans.push(ms(after-before));lateness.push(ms(before-due));
  check(typeof o.present==='boolean'&&Number.isSafeInteger(o.generation)&&o.generation>=lastGeneration,'Invalid selected generation');
  const frame=tick(o.frameId),copy=tick(o.copyCompletedQpc);
  if(o.present){check(o.generation>0&&frame>0n&&copy>0n&&copy<=at,'Invalid selected frame');
   if(o.generation===lastGeneration)check(frame>=lastFrame,'Transport frame regressed');
   const identity=`${o.generation}:${frame}`;if(identity===lastIdentity){check(copy===lastCopy,'Held frame changed completion');held++;}else selected++;
   lastIdentity=identity;lastFrame=frame;lastCopy=copy;
  }else {check(frame===0n&&copy===0n,'Empty opportunity carries frame');noFrame++;}
  lastGeneration=o.generation;
 }
 check(calls===ops.length&&calls+missed===600&&calls>0,'Incomplete callback/slot coverage');
 check(Array.isArray(lifecycle)&&lifecycle.length>0&&lifecycle.length<=10&&lifecycle.every(x=>['restart-trigger','stop-requested','process-exit-observed'].includes(x.kind)&&x.instanceId===instanceId&&x.revisionId===expected.revisionId&&x.releaseId===expected.releaseId&&x.incomplete===false&&x.lostRecords===0&&x.clock?.domain==='qpc'&&tick(x.clock.frequency)===f),'Invalid source lifecycle');
 const starts=lifecycle.filter(x=>x.kind==='restart-trigger');check(starts.length===1&&/^[a-f0-9]{32}$/.test(starts[0].attemptId)&&tick(starts[0].clock.at)>=childStart&&tick(starts[0].clock.at)<end&&lifecycle.every(x=>x.attemptId===starts[0].attemptId),'Unexpected producer attempt');
 for(const o of ops)if(o.present)check(tick(o.at)>=tick(starts[0].clock.at)&&tick(o.copyCompletedQpc)>=tick(starts[0].clock.at),'Selected frame predates producer start');
 for(const row of lifecycle){const clockAt=tick(row.clock.at);check(clockAt>=childStart&&clockAt<=childEnd,'Lifecycle outside supervisor envelope');if(row.kind==='restart-trigger')continue;const at=tick(row.kind==='process-exit-observed'?row.observedExitAt:row.clock.at);check(at>=end&&at<=childEnd&&row.force!==true,'Fault/cleanup during observation');if(row.kind==='process-exit-observed')check(row.stopped===true&&row.activeProcesses===0,'Exit unconfirmed');}
 return {ok:true,scope:'10 s cold-start native fixture cadence and elapsed callback diagnostic',instanceId,...expected,expectedSlots:600,opportunities:calls,missedSlots:missed,rateHz:calls/10,noFrame,selectedTransport:selected,heldTransport:held,callbackMs:quantiles(spans),latenessMs:quantiles(lateness),window:{start:probe.start,end:probe.end,coverageEnd:probe.coverageEnd,overshootMs:ms(coverageEnd-end)},freshImageMeasured:false,performanceAcceptance:false,actualResolumeTested:false,callbackTiming:'QPC elapsed including descheduling and driver time; not exclusive CPU execution'};
}
