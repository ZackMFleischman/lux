import test from 'node:test';
import assert from 'node:assert/strict';
import progress from '../../tools/gpu-spike/frame-progress.cjs';
test('responsive but stagnant heartbeats cannot hide a stalled frame',()=>{
 const p=new progress.FrameProgress();p.observe('1',100);
 p.observe('1',1000);p.observe('1',2200);assert.equal(p.expired(2200),true);
 p.observe('2',2300);assert.equal(p.expired(2400),false);
 p.observe('1',4000);assert.equal(p.expired(4400),true);
});
