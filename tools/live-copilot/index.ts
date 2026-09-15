import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { readConfig } from './config.ts';
import { connectMcp } from './mcp.ts';
import { createCodex } from './codex.ts';
import { startServer } from './server.ts';

const root = resolve(import.meta.dirname, '../..');
if (existsSync(join(root, '.env.local'))) loadEnvFile(join(root, '.env.local'));
const key = process.env.OPENAI_API_KEY?.trim() ?? '';
const log = (message: string) => console.log(key ? message.replaceAll(key, '[redacted]') : message);
async function main() {
  const config = readConfig(process.argv.slice(2));
  if (config.help) {
    log('Lux Copilot\nUsage: npm run copilot -- [--debug | --check-mcp]\nSet OPENAI_API_KEY in .env.local. Use your saved ChatGPT Codex login and lux-studio MCP configuration.\nOpen the printed local URL and press Start listening. Ctrl+C shuts down.'); return;
  }
  log('Lux Copilot');
  const codex = createCodex({ root, apiKey: key, log });
  const shutdown = new AbortController();
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  let resolveStop!: () => void;
  const stopped = new Promise<void>(resolve => { resolveStop = resolve; });
  const stop = () => { shutdown.abort(); resolveStop(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  const preflight = async (signal: AbortSignal) => {
    await codex.verify(signal); log('✓ Codex ChatGPT login verified');
    const configuration = await codex.mcpConfiguration(signal);
    const mcp = await connectMcp({ root, env: codex.childEnv, apiKey: key, configuration, signal });
    try {
      log('✓ Lux MCP connected');
      // Do not send full source, endpoint credentials, or other private state to a model.
      return { tools: mcp.catalog.map(tool => ({ name: tool.name, description: tool.description })),
        studioSession: mcp.status.studioSession, instruction: 'Read fresh status through lux-studio before acting.' };
    } finally { await mcp.close(); }
  };
  try {
    await preflight(shutdown.signal);
    if (config.checkMcp || shutdown.signal.aborted) return;
    server = await startServer({ apiKey: key, preflight, execute: codex.execute, log, debug: config.debug });
    log(`Open ${server.url}\nClick Start listening and allow microphone access. Ctrl+C to quit.`);
    await stopped;
  } finally {
    stop(); await server?.close(); process.off('SIGINT', stop); process.off('SIGTERM', stop);
  }
}
await main().catch(error => { log(`✗ ${error.message}`); process.exitCode = 1; });
