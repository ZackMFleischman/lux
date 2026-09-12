import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentBridge } from '../../apps/studio/src/agent-bridge.ts';
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
