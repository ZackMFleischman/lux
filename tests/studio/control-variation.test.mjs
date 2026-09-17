import test from 'node:test';
import assert from 'node:assert/strict';
import {validateControlAnimationBindings} from '../../packages/runtime-contracts/src/control-animation.mjs';
import {controlVariationValue} from '../../apps/studio/src/controls/control-animation.mjs';

const hash='a'.repeat(64);
const definition={id:'size',type:'number',label:'Size',default:10,min:0,max:20,changeCost:'live'};
const binding=(distribution,amount=4)=>({kind:'variation',nodePath:[],definitionHash:hash,schemaHash:hash,controlId:'size',distribution,amount,enabled:true});

test('per-instance variation is stable, bounded, and supports all distributions',()=>{
  for(const distribution of ['random','centered','spread']){
    const admitted=validateControlAnimationBindings([binding(distribution)])[0];
    const first=controlVariationValue(10,definition,admitted,7);
    assert.equal(controlVariationValue(10,definition,admitted,7),first,`${distribution} must stay stable for an instance`);
    assert.ok(first>=6&&first<=14,`${distribution} must stay inside the configured range`);
    assert.notEqual(controlVariationValue(10,definition,admitted,8),first,`${distribution} must distinguish instances`);
  }
});

test('variation keeps numeric and string instance keys distinct',()=>{
  for(const distribution of ['random','centered','spread']){
    const admitted=validateControlAnimationBindings([binding(distribution)])[0];
    assert.notEqual(
      controlVariationValue(10,definition,admitted,1),
      controlVariationValue(10,definition,admitted,'1'),
      `${distribution} must preserve the instance key type`,
    );
  }
});

test('even spread distributes consecutive instances across the range and clamps at control limits',()=>{
  const admitted=validateControlAnimationBindings([binding('spread')])[0];
  const samples=[0,1,2,3].map(key=>controlVariationValue(10,definition,admitted,key));
  assert.equal(new Set(samples.map(value=>Math.floor((value-6)/2))).size,4);
  assert.equal(controlVariationValue(19,definition,{...admitted,amount:10},0)<=20,true);
  assert.equal(controlVariationValue(1,definition,{...admitted,amount:10},1)>=0,true);
});

test('variation rejects unsupported instance keys and malformed distribution settings',()=>{
  assert.throws(()=>validateControlAnimationBindings([{...binding('clustered')}]),/Invalid control animation binding/);
  const admitted=validateControlAnimationBindings([binding('random')])[0];
  assert.throws(()=>controlVariationValue(10,definition,admitted,{}),/instance key/);
});
