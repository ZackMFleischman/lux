const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../apps/render-host/src/main.ts'),'utf8');
const start=source.indexOf('function persistHangProbe('),end=source.indexOf('\nfunction publishHealth()',start);
function fixture(t){
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'lux-hang-marker-')),runId='12345678-1234-1234-1234-123456789abc',directory=path.join(parent,runId);fs.mkdirSync(directory);
 t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
 const context={fs,path,hangProbeWritten:false,visualReady:true,completedFrames:3,workerHeartbeat:2,
  installed:{attemptId:'b'.repeat(32),requestPath:path.join(parent,'a'.repeat(32)+'.json'),hostPid:42},release:{sourceHash:'c'.repeat(64)},
  bridge:{clock:()=>({domain:'qpc',frequency:'10000000',at:'1'})},process:{env:{LUX_STANDALONE_HANG_CONTROL:'1',LUX_EXPERIMENT_MODE:'hardware',LUX_EXPERIMENT_RUN_ID:runId,LUX_EXPERIMENT_DIRECTORY:directory,LUX_EXPERIMENT_TIMEOUT_MS:'30000'}}};
 const record=vm.runInNewContext(source.slice(start,end)+'\npersistHangProbe;',context);
 return {context,record,directory,filename:path.join(directory,'installed-hang-entered.json')};
}
test('only the opt-in fixed token persists one bounded record with trusted attempt identity',t=>{
 const f=fixture(t);f.record('ordinary authored console');f.record(JSON.stringify({path:'../../escape',message:'LUX_QA_INSTALLED_HANG_ENTERED'}));assert.deepEqual(fs.readdirSync(f.directory),[]);
 f.record('LUX_QA_INSTALLED_HANG_ENTERED');const first=fs.readFileSync(f.filename,'utf8'),record=JSON.parse(first);
 assert.equal(record.instanceId,'a'.repeat(32));assert.equal(record.attemptId,'b'.repeat(32));assert.equal(record.hostPid,42);assert.equal(record.revisionId,'c'.repeat(64));assert.ok(first.length<1024);
 f.record('LUX_QA_INSTALLED_HANG_ENTERED');assert.equal(fs.readFileSync(f.filename,'utf8'),first);assert.deepEqual(fs.readdirSync(f.directory),['installed-hang-entered.json']);
});
test('default production mode ignores the token without filesystem or clock work',t=>{
 const f=fixture(t);delete f.context.process.env.LUX_STANDALONE_HANG_CONTROL;f.context.fs={};f.context.bridge={};f.record('LUX_QA_INSTALLED_HANG_ENTERED');assert.deepEqual(fs.readdirSync(f.directory),[]);
});
test('identity, readiness, redirected paths, stale records and budget violations fail closed',t=>{
 for(const change of [f=>f.context.visualReady=false,f=>f.context.installed.attemptId='old',f=>f.context.installed.requestPath='other.json',f=>f.context.process.env.LUX_EXPERIMENT_DIRECTORY=path.dirname(f.directory),f=>f.context.process.env.LUX_EXPERIMENT_MODE='cpu',f=>f.context.process.env.LUX_EXPERIMENT_TIMEOUT_MS='30001',f=>f.context.fs={...fs,lstatSync:()=>({isSymbolicLink:()=>true})},f=>fs.writeFileSync(f.filename,'stale')]){
  const f=fixture(t);change(f);assert.throws(()=>f.record('LUX_QA_INSTALLED_HANG_ENTERED'));assert.equal(f.context.hangProbeWritten,true);
 }
});
