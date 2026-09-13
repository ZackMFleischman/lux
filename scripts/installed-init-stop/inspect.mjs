import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {inspectNativeInitStop} from '../../tools/gpu-spike/native-init-stop-inspect.mjs';
const out=import.meta.dirname,c=JSON.parse(fs.readFileSync(path.join(out,'configuration.json'))),read=f=>JSON.parse(fs.readFileSync(f));
const digest=file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
let report={ok:false,releaseId:c.releaseId,runtimeId:c.runtimeId,sourceHash:c.sourceHash};
try{
 const experiment=read(path.join(out,'last-experiment.json'));assert.equal(experiment.executable,c.host);assert.deepEqual(experiment.args,[c.registered.dllPath,c.final]);
 const markerFiles=fs.readdirSync(experiment.directory).filter(n=>/^installed-init-hang-entered-[a-f0-9]{32}\.json$/.test(n)).map(n=>path.join(experiment.directory,n));
 assert.ok(markerFiles.length>=1&&markerFiles.length<=2,'Expected bounded original/retry marker count');
 const markers=markerFiles.map(read).sort((a,b)=>BigInt(a.clock.at)<BigInt(b.clock.at)?-1:1),marker=markers[0];
 const lifecycleFile=path.join(c.installRoot,'instances',c.runtimeId,marker.instanceId+'.attempts',marker.attemptId+'.lifecycle.jsonl');
 const lifecycle=fs.readFileSync(lifecycleFile,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
 const result=inspectNativeInitStop({experiment,marker,lifecycle,expected:c.expected});
 const receiver=fs.readFileSync(c.hostLog,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
 assert.ok(!receiver.some(row=>['failure','bounded-unload-unsupported'].includes(row.kind)),'Native receiver failure');
 const opportunities=receiver.filter(r=>r.kind==='host-opportunity');
 assert.ok(opportunities.some(row=>BigInt(row.at)>BigInt(result.observedExitAt)),'No native callback after confirmed first-attempt stop');
 report={...report,...result,experimentId:experiment.id,markerCount:markers.length,firstAttemptOnly:true,callbacksAfterFirstStop:opportunities.filter(r=>BigInt(r.at)>BigInt(result.observedExitAt)).length,
  hashes:[...markerFiles,lifecycleFile,c.hostLog,path.join(out,'last-experiment.json')].map(digest),scope:'Initialization hang physical stop from main-observed entry; retry may be cut short by normal host exit. No recovered image or exact worker onset claim.'};
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
fs.writeFileSync(path.join(out,'inspection.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
