const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
test('installed process stop observes the terminated Job and records QPC proof before releasing ownership',{skip:process.platform!=='win32'},async t=>{
 const bridge=require('../../native/build/Release/lux_texture_bridge.node');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lux-job-stop-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const script=path.join(root,'cpu-child.cjs'),ready=path.join(root,'ready');
 fs.writeFileSync(script,"require('node:fs').writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);");
 const key=bridge.installedStart(process.execPath,script,ready);let closed=false;
 try{
  for(let i=0;i<100&&!fs.existsSync(ready);++i)await new Promise(r=>setTimeout(r,10));
  assert.equal(fs.existsSync(ready),true);assert.equal(bridge.installedRunning(key),true);
  let result;
  for(let i=0;i<200;++i){result=bridge.installedStop(key);if(result?.stopped){closed=true;break;}await new Promise(r=>setTimeout(r,10));}
  assert.equal(result.stopped,true);assert.equal(result.activeProcesses,0);assert.equal(result.clock.domain,'qpc');
  assert.ok(BigInt(result.observedExitAt)>=BigInt(result.requestedAt));assert.ok(BigInt(result.clock.frequency)>0n);
 }finally{if(!closed){try{bridge.installedStop(key);}catch{}}}
});
