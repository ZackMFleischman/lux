import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeControlDeclarations,canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import {validateControlAnimationBindings} from '../../packages/runtime-contracts/src/control-animation.mjs';
import {prepareWorkerControlState} from '../../apps/studio/src/controls/worker-control-state.mjs';
import {LEGACY_CONTROL_SCHEMA_HASH} from '../../apps/studio/src/controls/control-state.ts';

const schema=normalizeControlDeclarations({height:{type:'number',label:'Height',default:1,min:0,max:4},speed:{type:'number',label:'Speed',default:.5,min:0,max:2}});
const hash=value=>createHash('sha256').update(value).digest('hex');
const schemaHash=hash(canonicalControlSchemaJson(schema));
const binding=(overrides={})=>({nodePath:[],definitionHash:schemaHash,schemaHash,controlId:'height',shape:'sine',periodSeconds:2,amount:1,phase:.25,enabled:true,...overrides});

test('scene animation bindings use the empty path as a distinct validated target',()=>{
 const scene=validateControlAnimationBindings([binding()]);
 assert.deepEqual(scene,[binding()]);
 assert.throws(()=>validateControlAnimationBindings([binding(),binding({amount:.5})]),/duplicate/i);
});

test('SDK 0.2 worker animates effective scene controls while retaining authored base controls',async()=>{
 const state=await prepareWorkerControlState({sdkVersion:'0.2.0',controlSchema:schema,controlSchemaHash:schemaHash,controls:{height:1,speed:.5},controlAnimations:[binding()]});
 assert.deepEqual(state.values(0),{height:2,speed:.5});
 assert.deepEqual(state.state(0),{sdkVersion:'0.2.0',controlSchemaHash:schemaHash,controls:{height:1,speed:.5},controlSequence:0,effectiveControls:{height:2,speed:.5},controlAnimations:[binding()],controlAnimationIssues:[],animationSequence:0});
 state.apply({height:2,speed:1},1,schemaHash);
 assert.deepEqual(state.values(0),{height:3,speed:1});
 state.applyAnimations([{...binding(),enabled:false}],1,.5);
 assert.deepEqual(state.values(12),{height:2,speed:1});
 state.applyAnimations([binding()],2,10);
 assert.equal(state.values(10).height,2);
 state.restartAnimation([], 'height',10);
 assert.equal(state.values(10).height,3);
 state.resetAnimations(11);
 assert.equal(state.values(11).height,3);
});

test('legacy intensity uses the same scene animation evaluator',async()=>{
 const legacyBinding={nodePath:[],definitionHash:LEGACY_CONTROL_SCHEMA_HASH,schemaHash:LEGACY_CONTROL_SCHEMA_HASH,controlId:'intensity',shape:'sine',periodSeconds:2,amount:.25,phase:.25,enabled:true};
 const state=await prepareWorkerControlState({controls:{intensity:.5},controlAnimations:[legacyBinding]});
 assert.deepEqual(state.values(0),{intensity:.75});
 assert.deepEqual(state.state(0).controls,{intensity:.5});
 assert.deepEqual(state.state(0).effectiveControls,{intensity:.75});
 assert.equal(state.state(0).intensity,.5);
 assert.deepEqual(state.state(0).controlAnimations,[legacyBinding]);
});

test('changed scene schema disables a retained binding without retargeting it',async()=>{
 const incompatible=binding({definitionHash:'f'.repeat(64)});
 const state=await prepareWorkerControlState({sdkVersion:'0.2.0',controlSchema:schema,controlSchemaHash:schemaHash,controls:{height:1,speed:.5},controlAnimations:[incompatible]});
 assert.deepEqual(state.values(0),{height:1,speed:.5});
 assert.deepEqual(state.state(0).controlAnimations,[incompatible]);
 assert.match(state.state(0).controlAnimationIssues[0].message,/changed|incompatible/i);
});

test('scene animation evaluation retains captured intrinsics after authored code mutates prototypes',async()=>{
 const state=await prepareWorkerControlState({sdkVersion:'0.2.0',controlSchema:schema,controlSchemaHash:schemaHash,controls:{height:1,speed:.5},controlAnimations:[binding()]});
 const mapGet=Map.prototype.get,mapSet=Map.prototype.set,setAdd=Set.prototype.add,setHas=Set.prototype.has,arrayFind=Array.prototype.find,arrayMap=Array.prototype.map,arrayPush=Array.prototype.push,arrayIterator=Array.prototype[Symbol.iterator];
 let initial,changed;
 try{
  Map.prototype.get=()=>{throw Error('mutated Map.get');};
  Map.prototype.set=()=>{throw Error('mutated Map.set');};
  Set.prototype.add=()=>{throw Error('mutated Set.add');};
  Set.prototype.has=()=>{throw Error('mutated Set.has');};
  Array.prototype.find=()=>{throw Error('mutated Array.find');};
  Array.prototype.map=()=>{throw Error('mutated Array.map');};
  Array.prototype.push=()=>{throw Error('mutated Array.push');};
  Array.prototype[Symbol.iterator]=()=>{throw Error('mutated Array iterator');};
  initial=state.values(0);
  state.applyAnimations([{...binding(),amount:.5}],1,0);
  changed=state.values(0);
 }finally{
  Map.prototype.get=mapGet;Map.prototype.set=mapSet;Set.prototype.add=setAdd;Set.prototype.has=setHas;Array.prototype.find=arrayFind;Array.prototype.map=arrayMap;Array.prototype.push=arrayPush;Array.prototype[Symbol.iterator]=arrayIterator;
 }
 assert.deepEqual(initial,{height:2,speed:.5});
 assert.equal(changed.height,1.5);
});
