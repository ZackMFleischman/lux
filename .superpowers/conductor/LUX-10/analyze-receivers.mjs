import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root='C:/Users/zFlei/repos/lux/.worktrees';
const quant=a=>{a.sort((x,y)=>x-y);return {count:a.length,median:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)}};
const result=[];
for(const [branch,folder] of [['receiver-worker-timing','receiver-timing-baseline'],['receiver-timing-treatment','receiver-timing-treatment']]){
 const dir=path.join(root,branch,'artifacts',folder),read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
 const c=read('configuration.json'),e=read('last-experiment.json'),p=read('cadence.cadence.json'),rows=fs.readFileSync(path.join(dir,'receiver.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse);
 const ops=rows.filter(r=>r.kind==='host-opportunity'),s=rows.find(r=>r.kind==='receiver-worker-timing-summary'),f=Number(p.clock.frequency),ms=x=>Number(x)*1000/f;
 let joined=0,held=0,selected=0,empty=0,last=null,prevAt=null,maxSelectionGap=0,lastSelect=null;
 for(const slot of p.slots){if(slot.missed)continue;const o=ops[joined];if(o.sequence!==slot.sequence||BigInt(o.at)<BigInt(slot.before)||BigInt(o.at)>BigInt(slot.after))throw Error('Join mismatch');joined++;if(!o.present){empty++;continue;}const id=o.generation+':'+o.frameId;if(id===last)held++;else{selected++;if(lastSelect!==null)maxSelectionGap=Math.max(maxSelectionGap,ms(BigInt(o.at)-lastSelect));lastSelect=BigInt(o.at);}last=id;prevAt=o.at;}
 const stage={};for(const r of rows.filter(r=>r.kind==='receiver-worker-timing'&&r.complete)){(stage[r.stage]??=[]).push(ms(BigInt(r.end)-BigInt(r.start)));}
 const {inspectReceiverWorkerTiming}=await import(pathToFileURL(path.join(root,branch,'tools/gpu-spike/receiver-worker-timing-inspect.mjs')));
 let strictTiming;try{strictTiming=inspectReceiverWorkerTiming(rows.filter(r=>r.kind.startsWith('receiver-worker-timing')),s.instanceId,p.clock.frequency,{start:e.child.startTicks,end:e.result.endTicks,frequency:String(e.child.frequency)})}catch(error){strictTiming={ok:false,reason:error.message.split('\n')[0]};}
 const {inspectCadence}=await import(pathToFileURL(path.join(root,branch,'tools/gpu-spike/cadence-inspect.mjs')));
 const attempts=path.join(c.installRoot,'instances',c.runtimeId,s.instanceId+'.attempts');const lifecycleFiles=fs.readdirSync(attempts).filter(x=>x.endsWith('.lifecycle.jsonl')).map(x=>path.join(attempts,x));const lifecycle=lifecycleFiles.flatMap(file=>fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(JSON.parse));
 let strictCadence;try{strictCadence=inspectCadence({experiment:e,probe:p,host:rows.filter(r=>!r.kind.startsWith('receiver-worker-timing')),lifecycle,expected:c.expected})}catch(error){strictCadence={ok:false,reason:error.message}}
 result.push({branch,dir,preparedCommit:c.preparedCommit,experimentId:e.id,manifestCommit:e.commit,child:e.child,result:e.result,releaseId:c.releaseId,runtimeId:c.runtimeId,expected:c.expected,strictCadence,strictTiming,hostSummary:rows.filter(r=>r.kind==='host-telemetry-summary'),failures:rows.filter(r=>r.kind==='failure'),timingSummary:s,partialDiagnostic:{joined,slots:p.slots.length,selectedTransport:selected,heldTransport:held,noFrame:empty,maxBetweenSelectedTransportMs:maxSelectionGap,callbackMs:quant(p.slots.filter(s=>!s.missed).map(s=>ms(BigInt(s.after)-BigInt(s.before)))),completeSpanMs:Object.fromEntries(Object.entries(stage).map(([k,v])=>[k,quant(v)]))},incomplete:rows.filter(r=>r.kind==='receiver-worker-timing'&&!r.complete),lifecycle,hashes:['configuration.json','last-experiment.json','cadence.cadence.json','receiver.jsonl',...lifecycleFiles].map(file=>{const full=path.isAbsolute(file)?file:path.join(dir,file);return {path:full,sha256:crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')}})});
}
fs.writeFileSync('.superpowers/conductor/LUX-10/receiver-analysis.json',JSON.stringify({executor:'/root/reliability_plan',analysisOnly:true,acceptance:false,results:result},null,2)+'\n');
console.log(JSON.stringify(result.map(({branch,strictCadence,strictTiming,partialDiagnostic,incomplete})=>({branch,strictCadence,strictTiming,partialDiagnostic,incomplete})),null,2));
