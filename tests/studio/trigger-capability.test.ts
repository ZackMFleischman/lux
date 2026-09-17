import test from 'node:test';
import assert from 'node:assert/strict';
import {studioCapabilities,supportsControlTriggersCapability} from '../../apps/studio/src/capabilities.ts';

test('trigger discovery requires running command receipt and paused-frame support',()=>{
  assert.equal(supportsControlTriggersCapability(studioCapabilities),true);
  for(const value of [undefined,{}, {...studioCapabilities,controlTriggers:undefined},
    {...studioCapabilities,controlTriggers:{commandReceipts:true,pausedFrame:false,maxCommandIds:16384}},
    {...studioCapabilities,controlTriggers:{commandReceipts:false,pausedFrame:true,maxCommandIds:16384}},
    {...studioCapabilities,controlTriggers:{commandReceipts:true,pausedFrame:true,maxCommandIds:0}}]){
    assert.equal(supportsControlTriggersCapability(value),false);
  }
});
