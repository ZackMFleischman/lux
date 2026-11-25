import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const c = new Client({ name: 'peek', version: '1' });
await c.connect(new StdioClientTransport({ command: process.execPath, args: ['scripts/studio-mcp.mjs'], cwd: process.cwd(), env: { ...process.env } }));
const r = JSON.parse((await c.callTool({ name: 'lux.studio.read', arguments: {} })).content[0].text);
console.log(Object.keys(r), JSON.stringify({ ...r, source: undefined, document: undefined }).slice(0, 600));
await c.close();
