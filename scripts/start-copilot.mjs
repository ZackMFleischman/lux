import OpenAI from 'openai';
import { loadEnvFile } from 'node:process';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createCodex, runCodex } from '../tools/live-copilot/codex.ts';
import { connectMcp } from '../tools/live-copilot/mcp.ts';
import { startServer } from '../tools/live-copilot/server.ts';
const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log('Usage: node scripts/start-copilot.mjs desktop [--no-open] [--check-mcp]'); process.exit(0); }
if ((args[0] ?? 'desktop') !== 'desktop' || args.slice(1).some(arg => !['--no-open', '--check-mcp'].includes(arg))) throw Error('Usage: node scripts/start-copilot.mjs desktop [--no-open] [--check-mcp]');
loadEnvFile(join(root, '.env.local'));
const key = process.env.OPENAI_API_KEY?.trim();
if (!key) throw Error('OPENAI_API_KEY is missing');
const installed = JSON.parse(await readFile(join(process.env.LOCALAPPDATA, 'Programs/Lux/installation.json'), 'utf8'));
const endpoint = JSON.parse(await readFile(join(process.env.APPDATA, 'Lux/Studio/profiles/desktop/agent-endpoint.json'), 'utf8'));
if (endpoint.profile !== 'desktop' || resolve(endpoint.workspace).toLowerCase() !== resolve(installed.workspace).toLowerCase() || !endpoint.sessionId) throw Error('Running Lux does not match the desktop installation. Open Lux first.');
const overrides = [
  '-c', `mcp_servers.lux-studio.command=${JSON.stringify(installed.node)}`,
  '-c', `mcp_servers.lux-studio.args=${JSON.stringify([installed.adapter])}`,
  '-c', `mcp_servers.lux-studio.cwd=${JSON.stringify(installed.workspace)}`,
  '-c', 'mcp_servers.lux-studio.env.LUX_STUDIO_PROFILE="desktop"',
  '-c', 'mcp_servers.lux-studio.env.LUX_STUDIO_DESKTOP="1"',
  '-c', `mcp_servers.lux-studio.env.LUX_STUDIO_SESSION_ID=${JSON.stringify(endpoint.sessionId)}`,
];
const log = message => console.log(message.replaceAll(key, '[redacted]'));
const codex = createCodex({ root, apiKey: key, log, run: (args, options) => runCodex([...overrides, ...args], { ...options, onEvent: options.onEvent ? event => { if (process.argv.includes("--check-agent")) log(JSON.stringify(event)); options.onEvent(event); } : undefined }) });
async function preflight(signal) {
  await codex.verify(signal); log('âœ“ Codex ChatGPT login verified');
  const configuration = await codex.mcpConfiguration(signal);
  const mcp = await connectMcp({ root, env: codex.childEnv, apiKey: key, configuration, signal });
  try {
    log('âœ“ Lux MCP connected to current desktop session');
    return { tools: mcp.catalog.map(({name, description}) => ({name, description})), studioSession: mcp.status.studioSession };
  } finally { await mcp.close(); }
}
await preflight(new AbortController().signal);
if (process.argv.includes('--check-mcp')) process.exit(0);
const client = new OpenAI({apiKey:key,maxRetries:0});
const server = await startServer({ apiKey: key, preflight, execute: codex.execute, log, client });
console.log(`Lux Copilot: ${server.url}`);
console.log('Click Start listening. Ctrl+C stops the portal. Global Codex configuration is unchanged.');
if (!args.includes('--no-open')) {
  const browser = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${server.url}'`], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', () => console.error('Open the URL above in your browser.'));
}
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await server.close(); process.exit(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);



