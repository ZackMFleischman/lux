const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
test('independent Jobs preserve quoted paths, strip Electron Node mode and stop descendants',{skip:process.platform!=='win32'},async t=>{
 const bridge=require('../../native/build/Release/lux_texture_bridge.node'),root=fs.mkdtempSync(path.join(os.tmpdir(),'lux-independent-jobs-'));
 const entry=path.join(root,'child with spaces.cjs'),leaf=path.join(root,'grandchild.cjs');
 fs.writeFileSync(leaf,"require('node:fs').writeFileSync(process.argv[2]+'.leaf',String(process.pid));setInterval(()=>{},1000)");
 fs.writeFileSync(entry,"require('node:child_process').spawn(process.execPath,["+JSON.stringify(leaf)+",process.argv[2]],{windowsHide:true,stdio:'ignore'});require('node:fs').writeFileSync(process.argv[2],JSON.stringify({pid:process.pid,nodeMode:process.env.ELECTRON_RUN_AS_NODE}));setInterval(()=>{},1000)");
 const previous=process.env.ELECTRON_RUN_AS_NODE;process.env.ELECTRON_RUN_AS_NODE='1';const keys=new Set();
 const stop=async key=>{for(let i=0;i<200;++i){const result=bridge.installedStop(key);if(result.stopped){keys.delete(key);assert.equal(result.activeProcesses,0);return;}await new Promise(r=>setTimeout(r,10));}throw Error('Job did not stop');};
 try{
  const a=path.join(root,'a.json'),b=path.join(root,'b.json');const first=bridge.installedStart(process.execPath,entry,a);keys.add(first);const second=bridge.installedStart(process.execPath,entry,b);keys.add(second);
  for(let i=0;i<200&&![a,b,a+'.leaf',b+'.leaf'].every(x=>fs.existsSync(x));++i)await new Promise(r=>setTimeout(r,10));
  const firstState=JSON.parse(fs.readFileSync(a)),secondState=JSON.parse(fs.readFileSync(b));
  assert.notEqual(firstState.pid,secondState.pid);assert.equal(firstState.nodeMode,undefined);assert.equal(secondState.nodeMode,undefined);
  const firstLeaf=Number(fs.readFileSync(a+'.leaf'));assert.doesNotThrow(()=>process.kill(firstLeaf,0));
  await stop(first);assert.throws(()=>process.kill(firstLeaf,0));assert.equal(bridge.installedRunning(second),true);await stop(second);
 }finally{for(const key of [...keys])await stop(key);if(previous===undefined)delete process.env.ELECTRON_RUN_AS_NODE;else process.env.ELECTRON_RUN_AS_NODE=previous;fs.rmSync(root,{recursive:true,force:true});}
});
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
