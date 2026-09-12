import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

export async function runFixture() {
  const transcript = [];
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./fixture-server.mjs', import.meta.url))], stderr: 'pipe' });
  const client = new Client({ name: 'lux-tr01-sdk-client', version: '0.0.0' });
  const send = transport.send.bind(transport);
  transport.send = async message => {
    // Explicitly exercise the selected legacy profile, not whatever latest means later.
    if (message.method === 'initialize') message = { ...message, params: { ...message.params, protocolVersion: '2025-11-25' } };
    transcript.push({ direction: 'client->server', message });
    return send(message);
  };
  const start = transport.start.bind(transport);
  transport.start = async () => {
    const receive = transport.onmessage;
    transport.onmessage = message => { transcript.push({ direction: 'server->client', message }); receive?.(message); };
    await start();
  };
  try {
    await client.connect(transport);
    const discovery = await client.listTools();
    if (!discovery.tools.some(tool => tool.name === 'lux_fixture_image')) throw new Error('TR-01 fixture tool not discovered');
    const response = await client.callTool({ name: 'lux_fixture_image', arguments: {} });
    return { response, transcript, client: 'lux-tr01-sdk-client via stdio; automated protocol test only', imageObserved: false };
  } finally { await client.close(); }
}
