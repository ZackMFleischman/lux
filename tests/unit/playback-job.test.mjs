import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const quote=value=>'"'+value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/g,'$1$1')+'"';
async function run(action,ignore=false){
 const directory=await mkdtemp(join(tmpdir(),'lux-playback-cpu-')),stopFile=join(directory,'stop');
 const host=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});
 const owner=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});
 const hostCreatedUtc=execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${host.pid}).StartTime.ToUniversalTime().ToString('o')`],{encoding:'utf8',windowsHide:true}).trim();
 const commandLine=[process.execPath,resolve('tests/unit/fixtures/playback.cjs'),stopFile,ignore?'ignore':'graceful'].map(quote).join(' ');
 await writeFile(join(directory,'config.json'),JSON.stringify({executable:process.execPath,commandLine,cwd:directory,directory,timeoutMs:-1,
   stopFile,ownerPid:owner.pid,hostPid:host.pid,hostCreatedUtc}));
 const helper=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/experiment-job.ps1'),'-Config',join(directory,'config.json')],
   {stdio:['ignore','ignore','pipe'],windowsHide:true});
 let stderr='';helper.stderr.on('data',d=>{stderr+=d;});
 const done=new Promise((resolve,reject)=>{helper.once('error',reject);helper.once('exit',code=>code===0?resolve():reject(Error(stderr)));});
 try{
   const deadline=Date.now()+15000;
   for(;;){try{if((await readFile(join(directory,'stdout.log'),'utf8')).includes('descendant'))break;}catch{}
     if(Date.now()>deadline)throw Error('Fixture startup deadline');await new Promise(r=>setTimeout(r,30));}
   if(action==='stop')await writeFile(stopFile,'stop');else (action==='host'?host:owner).kill();
   await done;
   const result=JSON.parse(await readFile(join(directory,'result.json'),'utf8'));
   assert.equal(result.cleanupComplete,true);assert.equal(result.timeout,false);assert.equal(result.forcedStop,ignore);
   const descendant=Number((await readFile(join(directory,'stdout.log'),'utf8')).match(/descendant (\d+)/)[1]);
   assert.throws(()=>process.kill(descendant,0),{code:'ESRCH'});
 }finally{host.kill();owner.kill();helper.kill();}
}
test('playback stop drains a responsive producer and removes descendants',()=>run('stop'));
test('closing host requests graceful producer stop',()=>run('host'));
test('owner exit bounds a producer that ignores shutdown',()=>run('owner',true));
