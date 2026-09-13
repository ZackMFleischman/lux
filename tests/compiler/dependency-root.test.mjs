import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,symlink,rm,readFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
test('trusted dependency-root junction retains the canonical declaration boundary',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'lux-dependency-root-'));
  try {
    const alias=join(temporary,'dependencies');
    await symlink(await realpath(resolve('node_modules')),alias,'junction');
    const text=await readFile(new URL('../../packages/visual-sdk/examples/intensity.ts',import.meta.url),'utf8');
    const result=await compileVisual({source:{sdkVersion:'0.1.0',entry:'main.ts',files:{'main.ts':text}}},{dependencyRoot:alias});
    assert.equal(result.ok,true,JSON.stringify(result));
    assert(Object.keys(result.artifact.dependencyHashes).some(key=>key.startsWith('declarations/')));
  } finally { await rm(temporary,{recursive:true,force:true}); }
});
