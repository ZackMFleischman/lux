import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { discoverVisualSdk } from '../packages/visual-sdk/src/discovery.mjs';
const server = new McpServer({ name: 'lux-studio', version: '0.1.0' });
async function call(method, params = {}) {
  const endpoint = JSON.parse(await readFile(join(process.env.APPDATA, 'Lux/Studio/agent-endpoint.json'), 'utf8'));
  const url = new URL(endpoint.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/') throw Error('Invalid local Lux endpoint');
  const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${endpoint.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id: randomUUID(), method, params }), signal: AbortSignal.timeout(75000) });
  const result = await response.json(); if (!result.ok) throw Error(result.error || 'Lux operation failed'); return result.result;
}
const text = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
server.registerTool('lux.studio.discover', { description: 'Read the exact visual SDK, example and standalone Lux capabilities. Start Lux Studio separately.', inputSchema: {} }, async () => text({ ...await discoverVisualSdk(), scope: 'standalone-studio', tools: ['read', 'build', 'capture', 'status'], resolume: false }));
server.registerTool('lux.studio.read', { description: 'Read current editor source and draft version before changing it.', inputSchema: {} }, async () => text(await call('read')));
server.registerTool('lux.studio.status', { description: 'Read actual standalone preview status.', inputSchema: {} }, async () => text(await call('status')));
server.registerTool('lux.studio.build', { description: 'Compile and preview replacement source. Read first; expectedDraftVersion prevents overwriting intervening edits. Failed builds retain the working preview.',
  inputSchema: { expectedDraftVersion: z.number().int().nonnegative(), source: z.object({ sdkVersion: z.literal('0.1.0'), entry: z.string(), files: z.record(z.string()) }).strict() } }, async input => text(await call('build', input)));
server.registerTool('lux.studio.capture', { description: 'Return an actual 1920x1080 PNG from Lux with its frame, controls and revision metadata.', inputSchema: {} }, async () => {
  const result = await call('capture'); return { content: [{ type: 'image', mimeType: 'image/png', data: result.base64 }, { type: 'text', text: JSON.stringify(result.metadata) }] };
});
await server.connect(new StdioServerTransport());
