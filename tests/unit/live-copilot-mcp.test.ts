import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectMcp } from '../../tools/live-copilot/mcp.ts';
test('MCP startup failure closes the connection and reports setup instructions', async () => {
  let closed = 0;
  const client = { connect: async () => {}, listTools: async () => ({ tools: [] }),
    callTool: async () => ({ isError: true, content: [{ type: 'text', text: 'Lux unavailable' }] }), close: async () => { closed++; } };
  await assert.rejects(connectMcp({ root: '.', client: client as never, transport: {} as never }), /Make sure Lux is running/);
  assert.equal(closed, 1);
});
test('MCP preflight reads status and respects disabled status permission', async () => {
  let calls = 0;
  const client = { connect: async () => {}, listTools: async () => ({ tools: [{ name: 'lux.studio.status', inputSchema: { type: 'object' } }] }),
    callTool: async () => { calls++; return { content: [{ type: 'text', text: '{"studioSession":{"id":"test"}}' }] }; }, close: async () => {} };
  const mcp = await connectMcp({ root: '.', client: client as never, transport: {} as never });
  assert.equal(mcp.status.studioSession.id, 'test'); await mcp.close();
  await assert.rejects(connectMcp({ root: '.', client: client as never, transport: {} as never, configuration: { disabled_tools: ['lux.studio.status'] } }), /disabled/);
  assert.equal(calls, 1);
});
