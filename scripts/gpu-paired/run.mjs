import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import {_electron} from 'playwright';import {summarize} from './method.mjs';
if(process.argv[2]!=='--hardware-authorized'||!process.argv[3])throw Error('Root authorization required: --hardware-authorized <prepared-output>');
if(process.env.LUX_PAIRED_JOB!=='1'||process.env.LUX_EXPERIMENT_TIMEOUT_MS!=='120000')throw Error('Dedicated reviewed120-second Job ownership required');
const out=path.resolve(process.argv[3]),manifest=JSON.parse(fs.readFileSync(path.join(out,'plan.json'))),resultPath=path.join(out,'result.json');
if(fs.existsSync(resultPath))throw Error('Refusing reused output');
for(const row of manifest.files)if(createHash('sha256').update(fs.readFileSync(row.path)).digest('hex')!==row.sha256)throw Error('Prepared hash changed: '+row.path);
const env={...process.env,LUX_PAIRED_OUT:out};for(const k of Object.keys(env))if((k.startsWith('LUX_')&&k!=='LUX_PAIRED_OUT')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH'].includes(k))delete env[k];
let app,timer;const report={ok:false,manifest,errors:[],totalGpuOverheadGate:'unavailable'};
try{
 const run=async()=>{
  app=await _electron.launch({executablePath:manifest.electronExecutable,args:[path.join(import.meta.dirname,'main.cjs')],env,timeout:15000});
  const page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(error.stack??error.message));
  await page.waitForFunction(()=>typeof window.runPaired==='function');
  const transport=JSON.parse(fs.readFileSync(path.join(out,'transport.json')));
  report.actual=await page.evaluate(value=>window.runPaired(value),transport);report.analysis=summarize(report.actual.legs);
  report.ok=report.errors.length===0&&report.analysis.validity==='diagnostic';
 };
 await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('110-second host harness deadline')),110000);})]);
}catch(error){report.errors.push(String(error.stack??error));
 if(app)try{const page=await app.firstWindow();report.partial=await Promise.race([page.evaluate(()=>window.pairedProgress),new Promise(resolve=>setTimeout(()=>resolve(null),1000))]);}catch{}
}finally{
 clearTimeout(timer);if(app)try{await Promise.race([app.close(),new Promise((_,reject)=>setTimeout(()=>reject(Error('App close deadline')),5000))]);report.appClosed=true;}catch(error){report.appClosed=false;report.errors.push(String(error));app.process().kill();}
 report.measurementValid=report.ok&&report.appClosed===true&&report.errors.length===0;
 report.ok=false;report.pendingSupervisorCleanup=true;
 fs.writeFileSync(resultPath,JSON.stringify(report,null,2));
}
 console.log(JSON.stringify({measurementValid:report.measurementValid,resultPath,analysis:report.analysis,errors:report.errors},null,2));process.exitCode=report.measurementValid?0:1;
