import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readBoundedJson,boundedJson} from '../../apps/build-worker/src/bounded-json.mjs';
test('worker JSON reads reject over-budget bytes and malformed UTF8 before JSON parsing',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'lux-bounded-json-')),path=join(folder,'input.json');
  try {
    await writeFile(path,'{"a":1}');assert.deepEqual(await readBoundedJson(path,7),{a:1});
    await assert.rejects(readBoundedJson(path,6),{code:'QUOTA_EXCEEDED'});
    await writeFile(path,Buffer.from([0x22,0xff,0x22]));await assert.rejects(readBoundedJson(path,10),/encoded data|encoding/i);
    assert.throws(()=>boundedJson({a:'\0'},7),{code:'QUOTA_EXCEEDED'});
  } finally {await rm(folder,{recursive:true,force:true});}
});
