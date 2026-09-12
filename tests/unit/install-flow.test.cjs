const test = require('node:test'), assert = require('node:assert/strict');
const {runInstallFlow, queryResolumeProcesses} = require('../../packages/export/src/install-flow.cjs');
function fixture(overrides = {}) {
  const calls = [];
  const ports = {
    validate: async () => { calls.push('validate'); return {release:{name:'Particles',releaseId:'a'.repeat(64)}}; },
    welcome: async value => { calls.push(['welcome',value.name]); return true; },
    chooseFolder: async () => { calls.push('choose'); return 'C:/Resolume/Extra Effects'; },
    confirm: async () => { calls.push('confirm'); return true; },
    queryHosts: async () => { calls.push('hosts'); return []; },
    install: async () => { calls.push('install'); return {releaseId:'a'.repeat(64)}; },
    register: async value => { calls.push(['register',value.pluginDirectory]); return {dllPath:'source.dll'}; },
    ...overrides,
  };
  return {ports,calls};
}
test('native-dialog installation validates first and registers only the chosen folder', async () => {
  const {ports,calls} = fixture();
  const result = await runInstallFlow({packageDirectory:'C:/Export',localAppData:'C:/User/AppData/Local',ports});
  assert.equal(result.cancelled,false); assert.equal(result.registration.dllPath,'source.dll');
  assert.deepEqual(calls,['validate',['welcome','Particles'],'choose','confirm','hosts','install','hosts',['register','C:/Resolume/Extra Effects']]);
});
test('cancelling any native dialog causes no installation or registration', async () => {
  for (const override of [{welcome:async()=>false},{chooseFolder:async()=>null},{confirm:async()=>false}]) {
    const {ports,calls}=fixture(override);
    assert.equal((await runInstallFlow({packageDirectory:'C:/Export',localAppData:'C:/User',ports})).cancelled,true);
    assert.equal(calls.includes('install'),false);assert.equal(calls.some(value=>Array.isArray(value)&&value[0]==='register'),false);
  }
});
test('corruption and a running Resolume fail before any mutation', async () => {
  for (const override of [{validate:async()=>{throw Error('hash mismatch');}},{queryHosts:async()=>['Arena.exe']}]) {
    const {ports,calls}=fixture(override);
    await assert.rejects(runInstallFlow({packageDirectory:'C:/Export',localAppData:'C:/User',ports}), /hash mismatch|Close Resolume/);
    assert.equal(calls.includes('install'),false);
  }
});
test('a host that starts during installation prevents source registration', async () => {
  let queries=0;const {ports,calls}=fixture({queryHosts:async()=>++queries===1?[]:['Avenue.exe']});
  await assert.rejects(runInstallFlow({packageDirectory:'C:/Export',localAppData:'C:/User',ports}), /Close Resolume/);
  assert.equal(calls.includes('install'),true);assert.equal(calls.some(value=>Array.isArray(value)&&value[0]==='register'),false);
});
test('tasklist check is bounded, hidden, read-only and fails closed on malformed output', async () => {
  let command;
  const run = async (...args) => {command=args;return {stdout:'"System","4","Services","0","1 K"\r\n"Arena.exe","123","Console","1","3 K"',stderr:''};};
  assert.deepEqual(await queryResolumeProcesses({run,systemRoot:'C:/Windows'}),['Arena.exe']);
  assert.equal(command[0],'C:\\Windows\\System32\\tasklist.exe'); assert.deepEqual(command[1],['/FO','CSV','/NH']);
  assert.equal(command[2].windowsHide,true);assert.equal(command[2].timeout,5000);
  await assert.rejects(queryResolumeProcesses({run:async()=>({stdout:'query failed',stderr:''}),systemRoot:'C:/Windows'}),/Could not verify/);
});
