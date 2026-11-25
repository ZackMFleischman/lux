import OpenAI from 'openai';
import { loadEnvFile } from 'node:process';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createCodex, runCodex } from '../tools/live-copilot/codex.ts';
import { connectMcp } from '../tools/live-copilot/mcp.ts';
import { startServer } from '../tools/live-copilot/server.ts';
const root = resolve(import.meta.dirname, '..');
loadEnvFile(join(root, '.env.local'));
const key = process.env.OPENAI_API_KEY?.trim();
if (!key) throw Error('OPENAI_API_KEY is missing');
const record = {checkout:root};
const profile = 'creative-c8e73bbdb600a59b83b225c2';
const endpoint = JSON.parse(await readFile(join(process.env.APPDATA, 'Lux/Studio/profiles', profile, 'agent-endpoint.json'), 'utf8'));
if (endpoint.workspace.toLowerCase() !== root.toLowerCase() || endpoint.profile !== profile || endpoint.sessionId !== 'c5a6db070d8e1b55735dd87de0466185a89b') throw Error('Lux endpoint does not match selected main session');
const overrides = [
  '-c', `mcp_servers.lux-studio.command=${JSON.stringify(process.execPath)}`,
  '-c', `mcp_servers.lux-studio.args=${JSON.stringify([join(record.checkout, 'scripts/studio-mcp.mjs')])}`,
  '-c', `mcp_servers.lux-studio.cwd=${JSON.stringify(record.checkout)}`,
  '-c', 'mcp_servers.lux-studio.env.LUX_STUDIO_PROFILE="creative-c8e73bbdb600a59b83b225c2"',
  '-c', `mcp_servers.lux-studio.env.LUX_STUDIO_SESSION_ID=${JSON.stringify(endpoint.sessionId)}`,
];
const log = message => console.log(message.replaceAll(key, '[redacted]'));
const codex = createCodex({ root, apiKey: key, log, run: (args, options) => runCodex([...overrides, ...args], { ...options, onEvent: options.onEvent ? event => { if (process.argv.includes("--check-agent")) log(JSON.stringify(event)); options.onEvent(event); } : undefined }) });
async function preflight(signal) {
  await codex.verify(signal); log('✓ Codex ChatGPT login verified');
  const configuration = await codex.mcpConfiguration(signal);
  const mcp = await connectMcp({ root, env: codex.childEnv, apiKey: key, configuration, signal });
  try {
    log('✓ Lux MCP connected (creative)');
    return { tools: mcp.catalog.map(({name, description}) => ({name, description})), studioSession: mcp.status.studioSession };
  } finally { await mcp.close(); }
}
await preflight(new AbortController().signal);
if (process.argv.includes('--check-mcp')) process.exit(0);
if (process.argv.includes('--check-agent')) { console.log(await codex.execute('Read-only verification: use lux.studio.status to inspect the running Lux. Do not change the visual, files, playback, or any setting. Return a concise inspection result supported by the MCP call.', new AbortController().signal)); process.exit(0); }
const client = new OpenAI({apiKey:key,maxRetries:0});
const create = client.live.create.bind(client.live);
client.live.create = async (...args) => {
  try { return await create(...args); }
  catch(error) { log(JSON.stringify({stage:'OpenAI Live create',status:error.status,requestId:error.request_id,type:error.type,code:error.code,detail:error.error,message:error.message})); throw error; }
};
const server = await startServer({ apiKey: key, preflight, execute: codex.execute, log, client });
console.log(`Lux Copilot: ${server.url}`);
console.log('Click Start listening. This launch uses the creative Studio without changing global Codex configuration.');
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await server.close(); process.exit(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);



