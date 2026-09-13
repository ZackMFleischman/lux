const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../apps/render-host/src/main.ts'),'utf8');
function fixture(t){
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'lux-init-marker-')),runId='12345678-1234-1234-1234-123456789abc',directory=path.join(parent,runId);fs.mkdirSync(directory);
 t.after(()=>{assert.equal(path.dirname(path.resolve(parent)),path.resolve(os.tmpdir()));assert.ok(path.basename(parent).startsWith('lux-init-marker-'));fs.rmSync(parent,{recursive:true,force:true});});
 const context={fs,path,initHangProbeWritten:false,initHangProbeArmed:false,visualReady:false,completedFrames:0,workerHeartbeat:1,
  installed:{attemptId:'b'.repeat(32),requestPath:path.join(parent,'a'.repeat(32)+'.json'),hostPid:42},release:{sourceHash:'c'.repeat(64)},
  bridge:{clock:()=>({domain:'qpc',frequency:'10000000',at:'100'})},process:{env:{LUX_STANDALONE_INIT_HANG:'1',LUX_EXPERIMENT_MODE:'hardware',LUX_EXPERIMENT_RUN_ID:runId,LUX_EXPERIMENT_DIRECTORY:directory,LUX_EXPERIMENT_TIMEOUT_MS:'30000'}}};
 const start=source.indexOf('function persistInitHangProbe('),end=source.indexOf('\nfunction publishHealth()',start);assert.ok(start>=0);
 const record=vm.runInNewContext(source.slice(start,end)+'\npersistInitHangProbe;',context);
 return {context,record,directory,filename:path.join(directory,'installed-init-hang-entered-'+context.installed.attemptId+'.json')};
}
test('pre-ready marker records the main-observed QPC and isolates retry attempts',t=>{
 const f=fixture(t);f.record('LUX_QA_INSTALLED_INIT_HANG_ENTERED');const bytes=fs.readFileSync(f.filename,'utf8'),row=JSON.parse(bytes);
 assert.equal(row.ready,false);assert.equal(row.completedFrames,0);assert.equal(row.workerHeartbeat,1);assert.equal(row.clock.at,'100');assert.equal(row.stage,'create');
 f.record('LUX_QA_INSTALLED_INIT_HANG_ENTERED');assert.equal(fs.readFileSync(f.filename,'utf8'),bytes);
 f.context.installed.attemptId='d'.repeat(32);f.context.initHangProbeWritten=false;f.record('LUX_QA_INSTALLED_INIT_HANG_ENTERED');assert.equal(fs.readdirSync(f.directory).length,2);assert.equal(fs.readFileSync(f.filename,'utf8'),bytes);
});
test('default mode and nonexact console messages do no filesystem or clock work',t=>{
 const f=fixture(t);f.context.fs={};f.context.bridge={};f.record('ordinary console');f.record('{"message":"LUX_QA_INSTALLED_INIT_HANG_ENTERED"}');
 delete f.context.process.env.LUX_STANDALONE_INIT_HANG;f.record('LUX_QA_INSTALLED_INIT_HANG_ENTERED');
});
test('armed evidence is persisted separately before its returned dispatch permission',t=>{
 const f=fixture(t),armed=f.record('LUX_QA_INSTALLED_INIT_HANG_ENTERED','armed');
 const file=path.join(f.directory,'installed-init-hang-armed-'+f.context.installed.attemptId+'.json');
 assert.equal(JSON.parse(fs.readFileSync(file)).clock.at,armed.clock.at);assert.equal(armed.stage,'before-create');
 assert.equal(f.record('LUX_QA_INSTALLED_INIT_HANG_ENTERED','armed'),undefined);
 f.record('LUX_QA_INSTALLED_INIT_HANG_ENTERED');assert.equal(fs.readdirSync(f.directory).length,2);
});
test('main dispatches GO only after successful owned marker persistence and requires a true relay acknowledgment',async t=>{
 for(const mode of ['success','wrong-owner','write-failed','ack-rejected']){
  const f=fixture(t),failures=[];let dispatches=0;
  const armedFile=path.join(f.directory,'installed-init-hang-armed-'+f.context.installed.attemptId+'.json');
  f.context.message=JSON.stringify({kind:'init-probe-ready',attemptId:mode==='wrong-owner'?'old':f.context.installed.attemptId,revisionId:f.context.release.sourceHash});
  f.context.persistInitHangProbe=f.record;f.context.failure=e=>failures.push(String(e));
  f.context.win={webContents:{executeJavaScript(script){dispatches++;assert.ok(fs.existsSync(armedFile));assert.match(script,/window.goInitProbe/);return Promise.resolve(mode!=='ack-rejected');}}};
  if(mode==='write-failed')f.context.fs={...fs,writeFileSync(){throw Error('injected write failure');}};
  const start=source.indexOf("    if(process.env.LUX_STANDALONE_INIT_HANG==='1'&&typeof message"),end=source.indexOf("    if(typeof message==='string'&&message.includes('runtime-heartbeat'))",start);
  vm.runInNewContext(source.slice(start,end),f.context);await Promise.resolve();
  assert.equal(dispatches,['success','ack-rejected'].includes(mode)?1:0);assert.equal(failures.length,['write-failed','ack-rejected'].includes(mode)?1:0);
 }
});
test('wrong readiness, unarmed heartbeat, identity, path, budget and stale marker fail closed',t=>{
 for(const change of [f=>f.context.visualReady=true,f=>f.context.completedFrames=1,f=>f.context.workerHeartbeat=0,
  f=>f.context.installed.attemptId='bad',f=>f.context.process.env.LUX_EXPERIMENT_MODE='cpu',f=>f.context.process.env.LUX_EXPERIMENT_TIMEOUT_MS='30001',
  f=>f.context.process.env.LUX_EXPERIMENT_DIRECTORY=path.dirname(f.directory),f=>f.context.fs={...fs,lstatSync:()=>({isSymbolicLink:()=>true})},f=>fs.writeFileSync(f.filename,'stale')]){
  const f=fixture(t);change(f);assert.throws(()=>f.record('LUX_QA_INSTALLED_INIT_HANG_ENTERED'));
 }
});
