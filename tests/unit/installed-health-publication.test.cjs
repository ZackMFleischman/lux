const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {ProducerHealth}=require('../../apps/installed-runtime/src/registry.cjs');
const source=fs.readFileSync(path.join(__dirname,'../../apps/render-host/src/main.ts'),'utf8');
const start=source.indexOf('function publishHealth()'),end=source.indexOf('\n// Start reporting',start);
function fixture(){
 const files=new Map();let renameError=null,writeError=null;
 const context={installed:{attemptId:'a'.repeat(32),healthPath:'health.status'},finishing:false,healthSequence:0,workerHeartbeat:1,visualReady:true,completedFrames:1,backpressureFrames:0,progress:{frame:1n},
  fs:{writeFileSync(file,bytes){if(writeError)throw Object.assign(Error(writeError),{code:writeError});files.set(file,bytes);},renameSync(from,to){if(renameError)throw Object.assign(Error(renameError),{code:renameError});files.set(to,files.get(from));files.delete(from);}}};
 const publish=vm.runInNewContext(source.slice(start,end)+'\npublishHealth;',context),health=new ProducerHealth({attemptId:context.installed.attemptId,startedAt:0});
 return {context,publish,health,files,sample:()=>JSON.parse(files.get('health.status')),renameFailure:value=>{renameError=value;},writeFailure:value=>{writeError=value;}};
}
test('transient rename contention retains the last published sample and cannot renew watchdogs',()=>{
 for(const code of ['EPERM','EACCES','EBUSY']){
  const f=fixture();f.publish();f.health.observe(f.sample(),0);const original=f.files.get('health.status');f.renameFailure(code);
  for(const now of [250,500,750,1000]){f.context.workerHeartbeat++;assert.equal(f.publish(),false);assert.equal(f.files.get('health.status'),original);assert.equal(f.health.observe(f.sample(),now),false);}
  assert.equal(f.health.failure(1249),null);assert.match(f.health.failure(1250),/main heartbeat/);
  f.renameFailure(null);f.publish();assert.equal(f.health.observe(f.sample(),1500),false,'expired producer cannot be revived by late publication');
 }
});
test('next successful publication contains the latest worker counter and gaps do not fake worker liveness',()=>{
 const f=fixture();f.publish();f.health.observe(f.sample(),0);f.renameFailure('EPERM');
 f.context.workerHeartbeat=2;f.publish();f.context.workerHeartbeat=3;f.publish();f.renameFailure(null);f.context.workerHeartbeat=4;f.publish();
 assert.equal(f.sample().sequence,4);assert.equal(f.sample().workerHeartbeat,4);assert.equal(f.health.observe(f.sample(),750),true);
 for(const now of [1000,1250,1500,1750]){f.publish();f.health.observe(f.sample(),now);}
 assert.equal(f.health.failure(1999),null);assert.match(f.health.failure(2000),/worker heartbeat/);
});
test('write failures and unexpected rename errors retain fatal error handling',()=>{
 const f=fixture();for(const code of ['EIO','ENOSPC']){f.renameFailure(code);assert.throws(()=>f.publish(),error=>error.code===code);}
 f.renameFailure(null);for(const code of ['EPERM','EACCES','EBUSY','EIO']){f.writeFailure(code);assert.throws(()=>f.publish(),error=>error.code===code);}
});
