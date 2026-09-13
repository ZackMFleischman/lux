const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('supervisor retains draining ownership on idle and retries rejected close before exiting',async()=>{
 const runtimeId='a'.repeat(64),local=path.resolve('fixture/local'),root=path.join(local,'Lux/Installed'),runtime=path.join(root,'runtimes',runtimeId);
 let now=0,tick,closeCalls=0,releaseRetry;const handlers=new Map(),exits=[],writes=[];
 class Registry{
  entries=new Map();errors=new Map();draining=new Map([['owned',{}]]);
  async reconcile(){}
  async close(){closeCalls++;if(closeCalls===1)throw Error('exit remains unconfirmed');this.draining.clear();}
 }
 const context={__dirname:path.join(runtime,'apps/installed-runtime/src'),performance:{now:()=>now},Date:{now:()=>now},
  setInterval(callback){tick=callback;return 1;},clearInterval(){},setTimeout(callback,ms){assert.equal(ms,250);releaseRetry=callback;},
  process:{argv:['node','supervisor','--lux-runtime-id',runtimeId],env:{LOCALAPPDATA:local},on:(name,fn)=>handlers.set(name,fn),exit:code=>exits.push(code)},
  require(name){
   if(name==='node:path'||name==='node:crypto')return require(name);
   if(name==='node:fs')return {mkdirSync(){},readdirSync:()=>[],writeFileSync:(file,value)=>writes.push(value),rmSync(){}};
   if(name==='./registry.cjs')return {InstanceRegistry:Registry,ProducerHealth:class{},sameInstalledPath:(a,b)=>a===b};
   if(name.endsWith('.node'))return {lockSupervisor:()=>true};
   if(name.endsWith('package.cjs'))return {validateRuntime(){}};
   throw Error('Unexpected dependency '+name);
  }};
 const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../apps/installed-runtime/src/supervisor.cjs'),'utf8'),context);
 await flush();now=31000;tick();await flush();assert.equal(closeCalls,0,'retained drains prevent idle shutdown');
 handlers.get('SIGINT')();await flush();assert.equal(closeCalls,1);assert.deepEqual(exits,[]);assert.ok(writes.some(value=>/exit remains unconfirmed/.test(value)));
 handlers.get('SIGTERM')();await flush();assert.equal(closeCalls,1,'concurrent close shares cleanup ownership');
 releaseRetry();await flush();assert.equal(closeCalls,2);assert.deepEqual(exits,[0]);
});
