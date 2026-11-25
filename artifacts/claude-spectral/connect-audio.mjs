import { writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const c = new Client({ name: 'connect-audio', version: '1' });
const j = async (n, a = {}) => { const r = await c.callTool({ name: `lux.studio.${n}`, arguments: a }, undefined, { timeout: 120000 }); if (r.isError) throw Error(r.content[0].text); return r; };
const J = async (n, a) => JSON.parse((await j(n, a)).content[0].text);
await c.connect(new StdioClientTransport({ command: process.execPath, args: ['scripts/studio-mcp.mjs'], cwd: process.cwd(), env: { ...process.env } }));
const inputs = await J('audio.inputs', {});
console.log('inputs', JSON.stringify(inputs).slice(0, 300));
const analyzer = { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 };
try { console.log('connect', JSON.stringify(await J('audio.connect', { localDeviceId: 'lux:test-rhythm', configuration: { logicalInputId: 'primary-audio', analyzer } })).slice(0, 120)); } catch (e) { console.log('connect skipped:', e.message.slice(0, 120)); }
for (const k of [1, 2]) {
  await new Promise(r => setTimeout(r, 1300));
  const cap = await j('capture');
  await writeFile(`artifacts/claude-spectral/live${k}.png`, Buffer.from(cap.content.find(x => x.type === 'image').data, 'base64'));
}
const st = await J('status');
console.log('audioInput', JSON.stringify(st.audioInput).slice(0, 400));
await c.close();
