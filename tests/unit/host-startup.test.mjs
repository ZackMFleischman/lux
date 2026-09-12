import test from 'node:test';
import assert from 'node:assert/strict';
import startup from '../../tools/gpu-spike/host-startup.cjs';
function fixture(){
  let resolve, stopped=false;
  const calls=[];
  const gate=new startup.HostStartup({revisionId:'revision',init:value=>{calls.push(['init',value]);return new Promise(done=>{resolve=done;});},
    promote:(result,value)=>calls.push(['paint',value]),update:async value=>calls.push(['update',value]),observe:()=>{},stopped:()=>stopped});
  return {gate,calls,stop:()=>{stopped=true;},complete:(value=.17)=>resolve({type:'ready',intensity:value,frameId:'1',revisionId:'revision'})};
}
test('host startup waits for a nondefault snapshot and matching completed first frame',async()=>{
  const f=fixture();await f.gate.apply(null);assert.deepEqual(f.calls,[]);
  const applying=f.gate.apply(.17);assert.deepEqual(f.calls,[['init',.17]]);
  f.complete();await applying;assert.deepEqual(f.calls,[['init',.17],['paint',.17]]);
  await f.gate.apply(.17);await f.gate.apply(.9);assert.deepEqual(f.calls.at(-1),['update',.9]);
});
test('stop during initialization never promotes or reopens painting',async()=>{
  const f=fixture();const applying=f.gate.apply(.17);f.stop();f.complete();await applying;
  assert.deepEqual(f.calls,[['init',.17]]);
});
test('wrong initial control acknowledgement never opens painting',async()=>{
  const f=fixture();const applying=f.gate.apply(.17);f.complete(.65);
  await assert.rejects(applying,/acknowledgement/);assert.deepEqual(f.calls,[['init',.17]]);
});
