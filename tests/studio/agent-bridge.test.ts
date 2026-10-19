import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentBridge } from '../../apps/studio/src/agent-bridge.ts';
import { agentTransportLimits } from '../../apps/studio/src/source/agent-contract.ts';
import { formatBytes } from '../../packages/assets/src/index.mjs';
test('local agent bridge requires token, rejects browser origins and deduplicates requests', async () => {
  let calls = 0; const bridge = await createAgentBridge(async () => ({ calls: ++calls }));
  try {
    const body = JSON.stringify({ id: 'one', method: 'status', params: {} });
    assert.equal((await fetch(bridge.url, { method: 'POST', body })).status, 403);
    assert.equal((await fetch(bridge.url, { method: 'POST', body, headers: { authorization: `Bearer ${bridge.token}`, origin: 'https://example.org' } })).status, 403);
    const headers = { authorization: `Bearer ${bridge.token}` };
    for (let i = 0; i < 2; i++) assert.equal((await (await fetch(bridge.url, { method: 'POST', headers, body })).json()).result.calls, 1);
    assert.equal(calls, 1);
    assert.equal((await fetch(bridge.url, { method: 'POST', headers, body: JSON.stringify({ id: 'one', method: 'capture' }) })).status, 400);
  } finally { bridge.close(); }
});

test('local agent bridge forwards every authoring method and rejects unknown methods', async () => {
  const calls: unknown[] = [];
  const bridge = await createAgentBridge(async (method, params) => { calls.push({ method, params }); return { applied: true }; });
  try {
    const methods=['read','build','capture','status','parameters','trigger','variation','playback','restart','tempo.set','tempo.tap','story.read','story.transport','scene.save','scene.open','library.list','library.read','library.create','library.update'];
    for (const method of methods) {
      const params = { instanceId: 'runtime', expectedGeneration: 2 };
      const response = await fetch(bridge.url, { method: 'POST', headers: { authorization: `Bearer ${bridge.token}` }, body: JSON.stringify({ id: method, method, params }) });
      assert.equal(response.status, 200);
      assert.deepEqual(calls.at(-1), { method, params });
    }
    const rejected=await fetch(bridge.url,{method:'POST',headers:{authorization:`Bearer ${bridge.token}`},body:JSON.stringify({id:'unknown',method:'story.unknown',params:{}})});
    assert.equal(rejected.status,400);assert.match((await rejected.json()).error,/Invalid authoring command/);assert.equal(calls.length,methods.length);
  } finally { bridge.close(); }
});

test('local agent bridge admits a Scene v7 sized request envelope and rejects bytes above its request limit',async()=>{
 const bridge=await createAgentBridge(async(_method,params:any)=>({length:params.payload.length}));
 try{
  const headers={authorization:`Bearer ${bridge.token}`};
  const accepted='x'.repeat(9*1024*1024),response=await fetch(bridge.url,{method:'POST',headers,body:JSON.stringify({id:'large-valid',method:'build',params:{payload:accepted}})});
  assert.equal(response.status,200);assert.equal((await response.json()).result.length,accepted.length);
  const rejected=await fetch(bridge.url,{method:'POST',headers,body:JSON.stringify({id:'too-large',method:'build',params:{payload:'€'.repeat(Math.ceil(agentTransportLimits.requestBytes/3)+1)}})});
  assert.equal(rejected.status,400);assert.match((await rejected.json()).error,new RegExp(`Request exceeds ${formatBytes(agentTransportLimits.requestBytes)}`));
 }finally{bridge.close();}
});
