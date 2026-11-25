import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {summarizeQueryOverhead} from '../../tools/gpu-spike/query-overhead/report.mjs';
const out=path.dirname(fileURLToPath(import.meta.url));
const read=(file,cap)=>{if(fs.statSync(file).size>cap)throw Error('Evidence exceeds bound');return JSON.parse(fs.readFileSync(file,'utf8'));};
let raw;try{
 const experiment=read(path.join(out,'last-experiment.json'),8*1024*1024);
 if(path.resolve(experiment.directory)!==path.join(out,'experiments',experiment.id))throw Error('Experiment directory mismatch');
 raw=read(path.join(experiment.directory,'query-overhead.json'),128*1024);
 if(experiment.outcome!=='success'||!experiment.cleanupComplete||!experiment.result.cleanupComplete||experiment.result.exitCode!==0||experiment.result.timeout||experiment.result.cancelled||experiment.timeoutMs!==30000||raw.runId!==experiment.id||raw.pid!==experiment.child.pid||!raw.ok)throw Error('Incomplete/failed supervised collection');
 const summary=summarizeQueryOverhead(raw);fs.writeFileSync(path.join(out,'inspection.json'),JSON.stringify({ok:true,runId:experiment.id,...summary},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
}catch(error){const result={ok:false,reason:String(error.message),partialBatches:raw?.batches?.length??null,rawErrors:raw?.errors??[],acceptance:'unavailable'};fs.writeFileSync(path.join(out,'inspection.json'),JSON.stringify(result,null,2)+'\n');console.error(JSON.stringify(result,null,2));process.exitCode=1;}
