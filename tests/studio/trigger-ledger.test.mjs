import test from 'node:test';
import assert from 'node:assert/strict';
import {createTriggerLedger} from '../../apps/studio/src/controls/trigger-ledger.mjs';

test('trigger ledger is non-evicting, target-bound, and rejects saturation',()=>{
 const ledger=createTriggerLedger(2),first=ledger.begin('a','leaf-a'),originalFreeze=Object.freeze,OriginalError=globalThis.Error;
 assert.equal(first.duplicate,false);ledger.complete(first.entry,{sequence:1});
 try{
  Object.freeze=value=>value;globalThis.Error=()=>new TypeError('mutated Error');
  const duplicate=ledger.begin('a','leaf-a');assert.equal(duplicate.duplicate,true);assert.equal(Object.isFrozen(duplicate),true);assert.deepEqual(duplicate.entry.receipt,{sequence:1});
  assert.throws(()=>ledger.begin('a','leaf-b'),error=>error instanceof OriginalError&&/another target/.test(error.message));
  ledger.begin('b','leaf-b');assert.equal(ledger.size(),2);
  assert.throws(()=>ledger.begin('c','leaf-c'),error=>error instanceof OriginalError&&/full/.test(error.message));
 }finally{Object.freeze=originalFreeze;globalThis.Error=OriginalError;}
 assert.equal(ledger.size(),2);
});

test('default trigger ledger admits exactly the advertised 16,384 command IDs',()=>{
 const ledger=createTriggerLedger(),first=ledger.begin('command-0','leaf');ledger.complete(first.entry,{sequence:1});
 for(let index=1;index<16384;index++)ledger.begin(`command-${index}`,'leaf');
 assert.equal(ledger.size(),16384);assert.throws(()=>ledger.begin('command-16384','leaf'),/full/);
 assert.equal(ledger.begin('command-0','leaf').entry.receipt.sequence,1,'saturation never evicts an accepted receipt');
});
