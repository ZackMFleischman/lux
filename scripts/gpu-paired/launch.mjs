// Dedicated120-second Studio diagnostic wrapper. Generic experiment-runner's
//30-second cap remains unchanged; this uses its review/lock and existing Job helper.
import fs from 'node:fs/promises';import path from 'node:path';import {spawn,execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
import {lockPath,validateReviewedInputs,assertNoConflictingActivity} from '../experiment-runner.mjs';
import {completeWithJob} from './method.mjs';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[2]??''),reviewFile=path.resolve(process.argv[3]??'');
if(!process.argv[2]||!process.argv[3])throw Error('Usage: node scripts/gpu-paired/launch.mjs <prepared-output> <authorized-review>');
const review=JSON.parse(await fs.readFile(reviewFile,'utf8'));
const args=[path.join(import.meta.dirname,'run.mjs'),'--hardware-authorized',out];
if(review.executable!==process.execPath||JSON.stringify(review.args)!==JSON.stringify(args)||review.diagnosticTimeoutMs!==120000)throw Error('Review changed paired diagnostic target/bound');
await validateReviewedInputs(review);
const jobDir=path.join(out,'job');
for(const file of [jobDir,path.join(out,'result.json'),path.join(out,'job-report.json')])try{await fs.stat(file);throw Error('Refusing reused output '+file);}catch(error){if(error.code!=='ENOENT')throw error;}
await fs.mkdir(path.dirname(lockPath),{recursive:true});const lock=await fs.open(lockPath,'wx');let dispatched=false,cleanupComplete=false;
const id=randomUUID(),report={id,scope:'120-second paired Studio GPU pass diagnostic; owned Node/Electron descendants',reviewFile,timeoutMs:120000,ok:false};
try{
 await lock.writeFile(JSON.stringify({id,pid:process.pid,directory:jobDir,startUtc:new Date().toISOString()}));
 await validateReviewedInputs(review);
 const processJson=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-CimInstance Win32_Process -ErrorAction Stop | Select-Object ProcessId,Name,ExecutablePath,@{Name='CreationUtc';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}}) | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:8388608});
 const inventory=JSON.parse(processJson.trim()||'[]');report.activity=Array.isArray(inventory)?inventory:[inventory];assertNoConflictingActivity(report.activity);
 await fs.mkdir(jobDir);
 const quote=value=>'"'+value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/g,'$1$1')+'"';
 const config={executable:process.execPath,commandLine:[process.execPath,...args].map(quote).join(' '),cwd:root,directory:jobDir,timeoutMs:120000};
 await fs.writeFile(path.join(jobDir,'config.json'),JSON.stringify(config,null,2));
 const env={...process.env,LUX_PAIRED_JOB:'1',LUX_EXPERIMENT_RUN_ID:id,LUX_EXPERIMENT_MODE:'hardware',LUX_EXPERIMENT_TIMEOUT_MS:'120000'};
 if(Date.parse(review.expiresUtc)<=Date.now())throw Error('Hardware review expired before dispatch');
 dispatched=true;
 await new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/experiment-job.ps1'),'-Config',path.join(jobDir,'config.json')],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',b=>{if(stderr.length<65536)stderr+=b;});child.stdout.on('data',()=>{});
  const timer=setTimeout(()=>{child.kill();reject(Error('Job helper unresponsive; retain experiment lock; cleanup unconfirmed'));},135000);
  child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Job helper failed: '+stderr));});
 });
 const job=JSON.parse(await fs.readFile(path.join(jobDir,'result.json'),'utf8'));report.job=job;cleanupComplete=job.cleanupComplete===true;
 const result=completeWithJob(JSON.parse(await fs.readFile(path.join(out,'result.json'),'utf8')),job);
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));report.ok=result.ok;
}catch(error){report.error=String(error.stack??error);}
finally{
 report.cleanupComplete=cleanupComplete;await fs.writeFile(path.join(out,'job-report.json'),JSON.stringify(report,null,2));
 if(!dispatched||cleanupComplete)await fs.unlink(lockPath);await lock.close();
}
console.log(JSON.stringify(report,null,2));process.exitCode=report.ok?0:1;
