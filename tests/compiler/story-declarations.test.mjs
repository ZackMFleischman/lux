import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {extractStoryCapability} from '../../apps/build-worker/src/story-declarations.mjs';

const source=story=>`import {defineVisual as visual} from '@lux/visual-sdk';
export default visual({controls:{},${story===null?'':`story:${story},`}async create(){throw Error('never execute');}});`;
const extract=text=>extractStoryCapability(parse(text,{sourceType:'module',plugins:['typescript']}));

test('static Story extraction returns normalized literal capability without evaluating source',()=>{
 assert.deepEqual(extract(source(`({version:1,beats:{
  arrival:({kind:'timed',seek:'direct'} as const),
  orbit:{kind:'sustained',seek:'none'},
 }} satisfies Record<string,unknown>)`)),{version:1,beats:[
  {id:'arrival',kind:'timed',seek:'direct'},
  {id:'orbit',kind:'sustained',seek:'none'},
 ]});
 assert.equal(extract(source(null)),null);
});

test('static Story extraction rejects references, calls, spreads, duplicate/computed fields and executable metadata',()=>{
 for(const story of [
  'storyCapability','makeStory()','{...storyCapability}',
  '{version:1,version:1,beats:{arrival:{kind:"timed",seek:"direct"}}}',
  '{version:1,["beats"]:{arrival:{kind:"timed",seek:"direct"}}}',
  '{version:1,get beats(){return {}}}',
  '{version:1,beats:{...beats}}',
  '{version:1,beats:{arrival:makeBeat()}}',
  '{version:1,beats:{arrival:{kind:"timed",seek:seekMode}}}',
 ]) assert.throws(()=>extract(source(story)),error=>error.code==='COMPILE_FAILED'&&/literal|duplicate|computed|reference|call|method|accessor|spread/i.test(error.message),story);
});

test('static Story extraction reports shared capability-policy failures at source locations',()=>{
 for(const story of [
  '{version:1,beats:{}}',
  '{version:1,beats:{arrival:{kind:"timed",seek:"none"}}}',
  '{version:1,beats:{"bad id":{kind:"sustained",seek:"none"}}}',
 ]) assert.throws(()=>extract(source(story)),error=>error.code==='COMPILE_FAILED'&&error.loc.line>=1&&error.loc.column>=0);
});
