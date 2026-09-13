import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {spawnSync} from 'node:child_process';
test('cadence is exclusively 10 s under exactly 30 s supervision, validated before graphics',()=>{
 const env={...process.env};for(const name of Object.keys(env))if(name.startsWith('LUX_'))delete env[name];
 Object.assign(env,{LUX_EXPERIMENT_RUN_ID:'12345678-1234-1234-1234-123456789abc',LUX_EXPERIMENT_MODE:'hardware',LUX_EXPERIMENT_TIMEOUT_MS:'30000',LUX_STANDALONE_DURATION_MS:'10000',LUX_STANDALONE_CADENCE:'1'});
 const check=patch=>spawnSync(path.resolve('native/build/Release/lux_standalone_host.exe'),['--validate-options'],{env:{...env,...patch},encoding:'utf8',windowsHide:true,timeout:3000});
 assert.equal(check({}).status,0);
 for(const patch of [{LUX_STANDALONE_DURATION_MS:'9999'},{LUX_STANDALONE_DURATION_MS:'10001'},{LUX_EXPERIMENT_TIMEOUT_MS:'29999'},{LUX_EXPERIMENT_TIMEOUT_MS:'30001'},{LUX_STANDALONE_CADENCE:'0'},{LUX_STANDALONE_PIXEL_CONTROL:'1'},{LUX_STANDALONE_ALPHA_CONTROL:'1'},{LUX_STANDALONE_HANG_CONTROL:'1'}])assert.equal(check(patch).status,2,JSON.stringify(patch));
});
