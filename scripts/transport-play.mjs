import { spawn, execFileSync } from 'node:child_process';
import { open, mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareTransportScene } from './transport-prepare.mjs';
import { prepareGpuReview } from './prepare-gpu-review.mjs';
import { assertNoConflictingActivity, validateReviewedInputs, lockPath } from './experiment-runner.mjs';
import releaseIO from '../tools/gpu-spike/transport-release.cjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const quote=value=>'"'+value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/g,'$1$1')+'"';
const ps=code=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',windowsHide:true,timeout:15000});
async function main(){
  const input=process.argv[2];if(!input)throw Error('Usage: pnpm transport:play <saved.lux-scene or prepared release.json>');
  const releasePath=input.endsWith('.lux-scene')?(await prepareTransportScene(input)).path:resolve(input);
  const release=releaseIO.readTransportRelease(releasePath);
  const processes=JSON.parse(ps("@(Get-CimInstance Win32_Process | Select-Object Name,ProcessId,ExecutablePath,@{Name='CreationUtc';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}}) | ConvertTo-Json -Compress"));
  const hosts=processes.filter(p=>/^(Avenue|Arena)\.exe$/i.test(p.Name));
  if(hosts.length!==1)throw Error('Open exactly one Resolume host and trigger one Lux TR02 Probe source first');
  const p=hosts[0],host={pid:p.ProcessId,executable:p.ExecutablePath,creationUtc:p.CreationUtc};
  assertNoConflictingActivity(processes,host);
  // CIM rounds creation times to microseconds. The Job helper compares the
  // full .NET process lifetime, so capture that value rather than rounding its
  // check. The fresh CIM identity check before dispatch still pins this host.
  const hostLifetimeUtc=ps(`(Get-Process -Id ${host.pid}).StartTime.ToUniversalTime().ToString('o')`).trim();
  const loaded=JSON.parse(ps(`ConvertTo-Json -Compress -InputObject @((Get-Process -Id ${host.pid}).Modules | Where-Object ModuleName -eq 'LuxTracerTR02.dll' | Select-Object FileName)`));
  const modules=Array.isArray(loaded)?loaded:[loaded];
  if(modules.length!==1||!modules[0]?.FileName)throw Error('Trigger the Lux TR02 Probe source in Resolume before playback');
  const staged=modules[0].FileName;
  if(releaseIO.hash(await readFile(staged))!==releaseIO.hash(await readFile(join(root,'native/build/Release/LuxTracerTR02.dll'))))throw Error('Installed Lux plugin differs from this build; close Resolume and install the current DLL');
  const id=randomUUID(),directory=join(root,'artifacts/transport/sessions',id),stopFile=join(directory,'stop');
  await mkdir(directory,{recursive:true});
  const review=await prepareGpuReview({root,output:join(directory,'review.json')});
  Object.assign(review,{authorized:true,reviewer:'Local operator invoked transport:play',testKind:'resolume-playback',hostClosedConfirmed:false,host,
    hypothesis:'Explicit saved visual playback; stop on user request, owner exit or host exit',expiresUtc:new Date(Date.now()+60000).toISOString(),
    executable:join(root,'node_modules/electron/dist/electron.exe'),args:[join(root,'apps/render-host/src/main.cjs')],transportRelease:releasePath});
  for(const path of [releasePath,join(root,'scripts/transport-play.mjs')])review.sources.push({path,sha256:releaseIO.hash(await readFile(path))});
  for(const path of [host.executable,staged])review.binaries.push({path,sha256:releaseIO.hash(await readFile(path))});
  await writeFile(join(directory,'review.json'),JSON.stringify(review,null,2));
  await validateReviewedInputs(review);
  await mkdir(dirname(lockPath),{recursive:true});const lock=await open(lockPath,'wx');
  let cleanup=false,started=false;
  const stop=()=>{void writeFile(stopFile,'stop').catch(console.error);};
  try{
    await lock.writeFile(JSON.stringify({id,pid:process.pid,directory,kind:'transport-playback'}));
    await validateReviewedInputs(review);
    const current=JSON.parse(ps("@(Get-CimInstance Win32_Process | Select-Object Name,ProcessId,ExecutablePath,@{Name='CreationUtc';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}}) | ConvertTo-Json -Compress"));
    assertNoConflictingActivity(current,host);
    if(Date.parse(review.expiresUtc)<=Date.now())throw Error('Playback review expired');
    const executable=join(root,'node_modules/electron/dist/electron.exe');
    await writeFile(join(directory,'config.json'),JSON.stringify({executable,commandLine:[executable,join(root,'apps/render-host/src/main.cjs')].map(quote).join(' '),
      cwd:root,directory,timeoutMs:-1,stopFile,ownerPid:process.pid,hostPid:host.pid,hostCreatedUtc:hostLifetimeUtc}));
    process.on('SIGINT',stop);process.on('SIGTERM',stop);
    console.log(`Playing ${release.sourceHash.slice(0,12)} in Resolume. Press Ctrl+C to stop.\nSession: ${directory}`);
    const env={...process.env,LUX_EXPERIMENT_MODE:'hardware',LUX_EXPERIMENT_RUN_ID:id,LUX_EXPERIMENT_DIRECTORY:directory,
      LUX_TRANSPORT_PLAYBACK:'1',LUX_TRANSPORT_BUNDLE:releasePath,LUX_TRANSPORT_STOP:stopFile,LUX_GPU_OUTPUT:directory};
    delete env.ELECTRON_RUN_AS_NODE;started=true;
    await new Promise((done,reject)=>{
      const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',join(root,'scripts/experiment-job.ps1'),'-Config',join(directory,'config.json')],
        {cwd:root,env,windowsHide:true,stdio:['ignore','ignore','pipe']});
      let error='';child.stderr.on('data',bytes=>{error=(error+bytes).slice(-8000);});
      child.once('error',reject);child.once('exit',code=>code===0?done():reject(Error(error||'Playback supervisor failed')));
    });
    const result=JSON.parse(await readFile(join(directory,'result.json'),'utf8'));cleanup=result.cleanupComplete===true;
    if(!cleanup||result.forcedStop||result.exitCode!==0)throw Error(`Playback did not stop cleanly; inspect ${directory}`);
    console.log('Playback stopped; producer resources released.');
  }finally{
    process.off('SIGINT',stop);process.off('SIGTERM',stop);
    if(!started||cleanup)await unlink(lockPath);await lock.close();
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
