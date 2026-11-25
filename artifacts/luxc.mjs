// Temporary MCP client for the installed Lux desktop session.
// Usage: node artifacts/luxc.mjs <tool> [json | @file.json] [outPrefix]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync, writeFileSync } from 'node:fs';

const B = 'C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\3efc24e7-9f23950c\\resources\\app';
const [tool, rawArgs = '{}', out = 'artifacts/jelly/out'] = process.argv.slice(2);
const args = JSON.parse(rawArgs.startsWith('@') ? readFileSync(rawArgs.slice(1), 'utf8') : rawArgs);
const client = new Client({ name: 'lux-cli', version: '1.0.0' });
await client.connect(new StdioClientTransport({
  command: `${B}\\node.exe`,
  args: [`${B}\\runtime\\scripts\\studio-installed-mcp.mjs`],
  cwd: `${B}\\runtime`,
  env: { ...process.env, LUX_STUDIO_PROFILE: 'desktop', LUX_STUDIO_DESKTOP: '1',
    LUX_STUDIO_SESSION_ID: '8f2fc71acb5c61682f26387ed8243172c92f' },
}));
const name = tool.startsWith('lux.') ? tool : `lux.studio.${tool}`;
const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 270000 });
let i = 0;
for (const c of r.content ?? []) {
  if (c.type === 'image') { const p = `${out}-${i++}.png`; writeFileSync(p, Buffer.from(c.data, 'base64')); console.log('IMAGE', p); }
  else if (c.type === 'text') { const p = `${out}.json`; writeFileSync(p, c.text); console.log(c.text.length > 3000 ? `TEXT ${c.text.length} chars -> ${p}` : c.text); }
}
if (r.isError) process.exitCode = 1;
await client.close();
