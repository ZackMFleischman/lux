import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {inspectNativeAlpha,nativeAlphaPng} from '../../tools/gpu-spike/native-alpha-inspect.mjs';
const out=path.dirname(fileURLToPath(import.meta.url)),c=JSON.parse(fs.readFileSync(path.join(out,'configuration.json'),'utf8'));
let report={ok:false,releaseId:c.releaseId,runtimeId:c.runtimeId,actualResolumeTested:false,performanceAcceptance:false};
try{
 const pixels=fs.readFileSync(c.final),experiment=JSON.parse(fs.readFileSync(path.join(out,'last-experiment.json'),'utf8')),probe=JSON.parse(fs.readFileSync(c.final+'.alpha.json','utf8'));
 const result=inspectNativeAlpha({pixels,experiment,probe,captureMtimeMs:fs.statSync(c.final).mtimeMs});
 const rows=fs.readFileSync(c.hostLog,'utf8').trim().split(/\r?\n/).filter(Boolean).map(row=>JSON.parse(row));
 if(rows.some(row=>['failure','bounded-unload-unsupported'].includes(row.kind)))throw Error('Native receiver recorded failure');
 const counters=rows.findLast(row=>row.kind==='counters');if(!counters||counters.consumed<2)throw Error('Continuing native consumption was not observed');
 report={...report,...result,probe,counters,experiment:{id:experiment.id,outcome:experiment.outcome,cleanupComplete:experiment.cleanupComplete}};
 fs.writeFileSync(path.join(out,'host.png'),nativeAlphaPng(pixels));
}catch(error){report={...report,ok:false,error:String(error.stack||error)};process.exitCode=1;}
fs.writeFileSync(path.join(out,'inspection.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
