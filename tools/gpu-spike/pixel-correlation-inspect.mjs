const check=(ok,message)=>{if(!ok)throw Error(message);};
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const tick=x=>{check(typeof x==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(x)&&BigInt(x)<=0xffffffffffffffffn,'Invalid QPC');return BigInt(x);};
export function decodePixelMarker(pixels){
 check(Array.isArray(pixels)&&pixels.length===32,'Invalid marker size');let bits=0;
 for(let i=0;i<32;i++){const p=pixels[i];check(Array.isArray(p)&&p.length===4&&p.every(x=>integer(x)&&x<=255)&&p[3]>=250,'Invalid marker pixel');
  const zero=p.slice(0,3).every(x=>x<=5),one=p.slice(0,3).every(x=>x>=250);check(zero||one,'Ambiguous marker pixel');if(one)bits=(bits|2**i)>>>0;
 }
 const step=bits&15,frame=(bits>>>4)&65535;
 check(step<=8&&frame>0&&((bits>>>20)&255)===0xa5&&((bits>>>28)&7)===((step+frame)&7)&&(bits>>>31)===(step&1),'Invalid marker guard/checksum/version');
 return {step,frame,effect:step%2};
}
export function inspectPixelCorrelation({experiment,probe,host,lifecycle,expected}){
 check(experiment?.outcome==='success'&&experiment.cleanupComplete===true&&experiment.result?.cleanupComplete===true&&experiment.result.exitCode===0&&experiment.result.timeout===false&&experiment.result.cancelled===false,'Incomplete supervised run');
 check(integer(experiment.timeoutMs)&&experiment.timeoutMs<=30000,'Invalid outer budget');
 check(probe?.mode==='pixel-correlation-v1'&&probe.runId===experiment.id&&probe.hostPid===experiment.child?.pid&&probe.ok===true&&probe.deinstantiated===true&&probe.deinitialized===true&&integer(probe.elapsedMs)&&probe.elapsedMs<=15000&&probe.lostRecords===0,'Invalid probe identity/bounds/cleanup');
 check(expected&&/^[a-f0-9]{64}$/.test(expected.revisionId)&&/^[a-f0-9]{64}$/.test(expected.releaseId),'Missing immutable fixture identity');
 const frequency=tick(probe.clock?.frequency);check(probe.clock?.domain==='qpc'&&frequency>0n,'Invalid probe clock');
 check(Array.isArray(probe.samples)&&probe.samples.length>0&&probe.samples.length<=1024&&Array.isArray(probe.controls)&&probe.controls.length===8&&Array.isArray(host)&&host.length<=10000,'Invalid bounded records');
 const opportunities=host.filter(x=>x.kind==='host-opportunity'),clocks=host.filter(x=>x.kind==='native-clock'),summaries=host.filter(x=>x.kind==='host-telemetry-summary');
 check(clocks.length===1&&clocks[0].domain==='qpc'&&tick(clocks[0].frequency)===frequency,'Host clock mismatch');
 check(summaries.length===1&&summaries[0].lostRecords===0&&summaries[0].recorded===probe.samples.length&&opportunities.length===probe.samples.length,'Missing host callback coverage');
 const instanceId=summaries[0].instanceId;check(/^[a-f0-9]{32}$/.test(instanceId)&&!host.some(x=>x.kind==='failure'||x.kind==='bounded-unload-unsupported'),'Invalid host identity/failure');
 check(Array.isArray(lifecycle)&&lifecycle.length>0&&lifecycle.length<=10&&lifecycle.every(x=>['restart-trigger','stop-requested','process-exit-observed'].includes(x.kind)&&x.instanceId===instanceId&&x.revisionId===expected.revisionId&&x.releaseId===expected.releaseId&&x.incomplete===false&&x.lostRecords===0),'Missing installed source identity');
 const starts=lifecycle.filter(x=>x.kind==='restart-trigger');check(starts.length===1&&/^[a-f0-9]{32}$/.test(starts[0].attemptId)&&lifecycle.every(x=>x.attemptId===starts[0].attemptId),'Unexpected producer restart');
 let previousAfter=0n,previousFrame=0,previousStep=0,previousTransportFrame=0n,initial=null,generation=null;
 const matches=new Map(),identities=new Map(),workerFrames=new Map();let readbackTicks=0n,duplicateWorkerImages=0;
 for(const [i,c] of probe.controls.entries()){
  check(c.step===i+1&&c.accepted===true,'Missing/reordered setter');const before=tick(c.before),after=tick(c.after),due=tick(c.due);
  check(due<=before&&before<=after&&(i===0||tick(probe.controls[i-1].after)<before),'Invalid setter ordering');
  if(i)check(due-tick(probe.controls[0].due)===BigInt(i)*frequency/2n,'Invalid 2 Hz schedule');
 }
 for(const [i,s] of probe.samples.entries()){
  const o=opportunities[i],before=tick(s.before),after=tick(s.after),readStart=tick(s.readStart),readEnd=tick(s.readEnd),at=tick(o.at);
  check(s.sequence===i+1&&o.sequence===i+1&&o.instanceId===instanceId&&before>previousAfter&&before<=at&&at<=after&&after<=readStart&&readStart<=readEnd,'Callback ordinal/QPC join mismatch');previousAfter=readEnd;readbackTicks+=readEnd-readStart;
  let marker;try{marker=decodePixelMarker(s.rgba);}catch(error){if(initial!==null)throw error;continue;}
  check(o.present===true&&integer(o.generation)&&o.generation>0&&tick(o.frameId)>0n,'Marker has no selected host frame');
  if(initial===null){check(marker.step===0&&readEnd<tick(probe.controls[0].before),'Missing initial step zero');initial=i;generation=o.generation;}
  check(o.generation===generation&&marker.frame>=previousFrame&&marker.step>=previousStep,'Marker generation/frame/version regression');previousFrame=marker.frame;previousStep=marker.step;
  check(tick(o.frameId)>=previousTransportFrame,'Selected transport frame regressed');previousTransportFrame=tick(o.frameId);
  const identity=`${o.generation}:${o.frameId}`,known=identities.get(identity),signature=JSON.stringify(marker);
  check(known===undefined||known===signature,'Same selected frame carries different pixels');identities.set(identity,signature);
  const priorWorker=workerFrames.get(marker.frame);check(priorWorker===undefined||priorWorker===signature,'Same worker frame carries different control pixels');
  if(priorWorker!==undefined)duplicateWorkerImages++;workerFrames.set(marker.frame,signature);
  if(marker.step){const c=probe.controls[marker.step-1];check(tick(c.after)<=before,'Marker predates actual setter');if(!matches.has(marker.step))matches.set(marker.step,{step:marker.step,workerFrame:marker.frame,generation:o.generation,frameId:o.frameId,callback:o.sequence,observedAt:s.readEnd,setterBefore:c.before,setterAfter:c.after});}
 }
 check(initial!==null&&matches.size===8,'Missing exact pixel-correlated versions');
 check(lifecycle.every(x=>x.clock?.domain==='qpc'&&tick(x.clock.frequency)===frequency),'Lifecycle clock mismatch');
 check(tick(starts[0].clock.at)<=tick(probe.samples[initial].before),'Initial marker predates producer start');
 for(const row of lifecycle){if(row.kind==='restart-trigger')continue;
  const at=tick(row.kind==='process-exit-observed'?row.observedExitAt:row.clock.at);
  check(at>=previousAfter&&row.force!==true,'Producer stopped during pixel observation');
  if(row.kind==='process-exit-observed')check(row.stopped===true&&row.activeProcesses===0,'Producer exit unconfirmed');
 }
 return {ok:true,instanceId,...expected,matchedVersions:[...matches.values()],readbackMs:Number(readbackTicks)*1000/Number(frequency),callbacks:probe.samples.length,
  scope:'Eight-step native fixture pixel correspondence only',mappingPolicy:'Multiple transport frames may repeat one identical worker image; these are not new renders',uniqueWorkerImages:workerFrames.size,selectedTransportFrames:identities.size,duplicateWorkerImages,intrusiveReadback:true,exactPluginReceiptMeasured:false,renderCompletionMeasured:false,latencyAcceptance:false,actualResolumeTested:false};
}
